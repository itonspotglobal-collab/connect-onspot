import OpenAI from "openai";
import fs from "fs";
import path from "path";
import { storage } from "../storage";
import { 
  storeConversation, 
  getLatestLearningSummary,
  isCorrection,
  storeMemory,
  getAllMemories,
  deleteMemory,
  extractTopicFromCorrection,
} from "./db_manager";
import { v4 as uuidv4 } from "uuid";

// Validate required environment variables at startup
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ASSISTANT_ID = process.env.ASSISTANT_ID;

if (!OPENAI_API_KEY) {
  console.warn("⚠️ OPENAI_API_KEY not found in environment variables. VanessaChat will not work.");
}

if (!ASSISTANT_ID) {
  console.warn("⚠️ ASSISTANT_ID not found in environment variables. VanessaChat will not work.");
}

// Only initialize OpenAI client if API key is available
const openai = OPENAI_API_KEY
  ? new OpenAI({ apiKey: OPENAI_API_KEY })
  : null;

// Helper to check if services are configured
const isConfigured = () => {
  if (!openai) {
    throw new Error("OpenAI API is not configured. Please set OPENAI_API_KEY in environment variables.");
  }
  if (!ASSISTANT_ID) {
    throw new Error("Assistant is not configured. Please set ASSISTANT_ID in environment variables.");
  }
};

// Load local knowledge base at startup
const knowledgePath = path.join(process.cwd(), "resources", "vanessa_knowledge.txt");
let vanessaKnowledge = "";

try {
  if (fs.existsSync(knowledgePath)) {
    vanessaKnowledge = fs.readFileSync(knowledgePath, "utf-8");
    console.log(`✅ Loaded Vanessa knowledge base from: ${knowledgePath}`);
  } else {
    console.warn(`⚠️ Vanessa knowledge base not found at: ${knowledgePath}`);
  }
} catch (error) {
  console.error(`❌ Error loading Vanessa knowledge base:`, error);
}

// Vanessa's persona reinforcement - ensures consistent personality
// This is passed as additional_instructions to reinforce the persona
// even if the Dashboard configuration changes
const VANESSA_PERSONA = `
You are Vanessa, the friendly and helpful AI assistant for OnSpot Workspace.
Never say "as an AI assistant" or mention that you are artificial.
You provide confident, warm, and clear information about:
- OnSpot's pricing, outsourcing, and staffing solutions
- Global client services and recruitment process
- Coworking spaces and workspace solutions
Be concise, upbeat, and professional in all responses.
Note: Respond in natural conversational text, not JSON format.
`.trim();

// Build enhanced instructions with knowledge, learning insights, and memories
async function buildEnhancedInstructions(): Promise<string> {
  let instructions = vanessaKnowledge
    ? `${VANESSA_PERSONA}\n\n[Company Knowledge Base]\n${vanessaKnowledge}`
    : VANESSA_PERSONA;

  // Add stored memories (short-term corrections)
  try {
    const memories = await getAllMemories();
    if (memories.length > 0) {
      instructions += `\n\n[Remembered Corrections]\n`;
      instructions += `Here are user corrections I should remember:\n`;
      instructions += memories
        .sort((a, b) => b.timestamp - a.timestamp) // Most recent first
        .map((m, idx) => `${idx + 1}. [${m.topic}] ${m.content}`)
        .join("\n");
      console.log(`💡 Injected ${memories.length} memory correction(s) into context`);
    }
  } catch (error) {
    console.error("❌ Error loading memories:", error);
  }

  // Add latest learning insights if available
  try {
    const learningSummary = await getLatestLearningSummary();
    if (learningSummary && learningSummary.insights.length > 0) {
      instructions += `\n\n[Recent Learning Insights]\n`;
      instructions += `Based on user feedback and interactions, focus on:\n`;
      instructions += learningSummary.insights.map((i, idx) => `${idx + 1}. ${i}`).join("\n");
      
      if (learningSummary.improvementAreas.length > 0) {
        instructions += `\n\nAreas to improve:\n`;
        instructions += learningSummary.improvementAreas.map((a, idx) => `${idx + 1}. ${a}`).join("\n");
      }
    }
  } catch (error) {
    console.error("❌ Error loading learning summary:", error);
  }

  return instructions;
}

export interface ChatResponse {
  message: string;
  threadId: string;
}

/**
 * Wait for any active runs on a thread to complete before adding new messages
 * This prevents the "can't add messages while a run is active" error
 */
async function waitForRunCompletion(client: OpenAI, threadId: string): Promise<void> {
  const checkInterval = 1000; // Check every 1 second
  const maxWaitTime = 30000; // Maximum 30 seconds wait
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitTime) {
    try {
      const runs = await client.beta.threads.runs.list(threadId, { limit: 10 });
      const activeRun = runs.data.find((r) =>
        ["in_progress", "queued", "requires_action"].includes(r.status)
      );
      
      if (!activeRun) {
        return; // No active runs, safe to proceed
      }
      
      console.log(`⏳ Waiting for active run ${activeRun.id} (status: ${activeRun.status}) to complete...`);
      await new Promise((resolve) => setTimeout(resolve, checkInterval));
    } catch (error) {
      console.error("❌ Error checking run status:", error);
      return; // Continue anyway if there's an error checking
    }
  }
  
  console.warn(`⚠️ Timeout waiting for active run to complete on thread ${threadId}`);
}

/**
 * Stream responses from the OpenAI Assistant with conversation continuity
 * Uses the Assistant API with threads for natural conversation flow
 * Also handles instant memory corrections and forget commands
 */
export async function* streamWithAssistant(
  userMessage: string,
  threadId?: string,
): AsyncGenerator<{ type: "content" | "done" | "threadId" | "memory"; data: string }> {
  try {
    // Check if OpenAI and Assistant are configured
    isConfigured();
    
    // Type assertions - isConfigured() ensures these are not null
    const client = openai!;
    const assistantId = ASSISTANT_ID!;

    // Create a new thread or use the existing one
    let currentThreadId = threadId;
    
    if (!currentThreadId) {
      const thread = await client.beta.threads.create();
      currentThreadId = thread.id;
      console.log(`📝 Created new thread: ${currentThreadId}`);
    } else {
      console.log(`📝 Reusing thread: ${currentThreadId}`);
      // Wait for any active runs to complete before adding new message
      await waitForRunCompletion(client, currentThreadId);
    }

    // Yield the thread ID first so the client can track it
    yield { type: "threadId", data: currentThreadId };

    // Check for forget command
    if (/forget/i.test(userMessage)) {
      const topic = extractTopicFromCorrection(userMessage);
      const deleted = await deleteMemory(topic);
      
      if (deleted) {
        const response = `I've forgotten everything about ${topic}.`;
        yield { type: "memory", data: response };
        yield { type: "content", data: response };
        yield { type: "done", data: "" };
        
        // Log the interaction
        await storage.createVanessaLog({
          threadId: currentThreadId,
          userMessage,
          assistantResponse: response,
        });
        
        return;
      }
    }

    // Check for correction pattern and store as instant memory
    if (isCorrection(userMessage)) {
      const topic = extractTopicFromCorrection(userMessage);
      await storeMemory(topic, userMessage);
      
      const acknowledgment = "Understood, I've updated my memory with that information.";
      yield { type: "memory", data: acknowledgment };
      yield { type: "content", data: acknowledgment };
      yield { type: "done", data: "" };
      
      // Log the correction
      await storage.createVanessaLog({
        threadId: currentThreadId,
        userMessage,
        assistantResponse: acknowledgment,
      });
      
      return;
    }

    // Add the user's message to the thread
    await client.beta.threads.messages.create(currentThreadId, {
      role: "user",
      content: userMessage,
    });

    // Build enhanced instructions with learning insights
    const enhancedInstructions = await buildEnhancedInstructions();

    // Start a streaming run with the assistant
    // Use additional_instructions to reinforce Vanessa's persona and inject local knowledge + learning
    const stream = await client.beta.threads.runs.stream(currentThreadId, {
      assistant_id: assistantId,
      additional_instructions: enhancedInstructions,
    });
    
    console.log(`🧠 Started Vanessa run for thread: ${currentThreadId}`);

    // Accumulate the assistant's response for logging
    let assistantResponse = "";

    // Process the streaming response
    for await (const event of stream) {
      // Handle text delta events (streaming tokens)
      if (event.event === "thread.message.delta") {
        const delta = event.data.delta;
        if (delta.content && delta.content[0]?.type === "text") {
          const textDelta = delta.content[0].text?.value;
          if (textDelta) {
            assistantResponse += textDelta;
            yield { type: "content", data: textDelta };
          }
        }
      }
      
      // Handle completion
      if (event.event === "thread.run.completed") {
        console.log(`✅ Assistant run completed for thread: ${currentThreadId}`);
      }

      // Handle errors
      if (event.event === "thread.run.failed") {
        console.error(`❌ Assistant run failed for thread: ${currentThreadId}`, event.data);
        throw new Error("Assistant run failed");
      }
    }

    // Log the conversation to both PostgreSQL and Replit DB
    try {
      // PostgreSQL logging (existing)
      await storage.createVanessaLog({
        threadId: currentThreadId,
        userMessage,
        assistantResponse,
      });
      console.log(`💾 Logged conversation to PostgreSQL: ${currentThreadId}`);

      // Replit DB logging (for learning system)
      await storeConversation({
        threadId: currentThreadId,
        userMessage,
        assistantResponse,
        timestamp: Date.now(),
        messageId: uuidv4(),
      });
      console.log(`💾 Logged conversation to Replit DB: ${currentThreadId}`);
    } catch (logError) {
      console.error("❌ Error logging conversation:", logError);
    }

    yield { type: "done", data: "" };
  } catch (error) {
    console.error("❌ OpenAI Assistant streaming error:", error);
    throw error;
  }
}

/**
 * Non-streaming version of the Assistant API call
 */
export async function sendMessageToAssistant(
  userMessage: string,
  threadId?: string,
): Promise<ChatResponse> {
  try {
    // Check if OpenAI and Assistant are configured
    isConfigured();
    
    // Type assertions - isConfigured() ensures these are not null
    const client = openai!;
    const assistantId = ASSISTANT_ID!;

    // Create a new thread or use the existing one
    let currentThreadId = threadId;
    
    if (!currentThreadId) {
      const thread = await client.beta.threads.create();
      currentThreadId = thread.id;
    } else {
      // Wait for any active runs to complete before adding new message
      await waitForRunCompletion(client, currentThreadId);
    }

    // Build enhanced instructions with learning insights
    const enhancedInstructions = await buildEnhancedInstructions();

    // Add the user's message to the thread
    await client.beta.threads.messages.create(currentThreadId, {
      role: "user",
      content: userMessage,
    });

    // Run the assistant (non-streaming)
    // Use additional_instructions to reinforce Vanessa's persona and inject local knowledge + learning
    const run = await client.beta.threads.runs.createAndPoll(currentThreadId, {
      assistant_id: assistantId,
      additional_instructions: enhancedInstructions,
    });

    if (run.status === "completed") {
      // Get the assistant's response
      const messages = await client.beta.threads.messages.list(currentThreadId);
      const lastMessage = messages.data[0];
      
      if (lastMessage.role === "assistant" && lastMessage.content[0]?.type === "text") {
        return {
          message: lastMessage.content[0].text.value,
          threadId: currentThreadId,
        };
      }
    }

    throw new Error(`Assistant run failed with status: ${run.status}`);
  } catch (error) {
    console.error("❌ OpenAI Assistant API error:", error);
    throw error;
  }
}

// Legacy export for backward compatibility (maps to new Assistant API)
export const streamMessageToAssistant = streamWithAssistant;
