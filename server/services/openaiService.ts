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

// Dynamic knowledge loader - reads file on every request for instant updates
function loadVanessaKnowledge(): string {
  const knowledgePath = path.join(process.cwd(), "resources", "vanessa_knowledge.txt");
  
  try {
    if (fs.existsSync(knowledgePath)) {
      return fs.readFileSync(knowledgePath, "utf-8");
    } else {
      console.warn(`⚠️ Vanessa knowledge base not found at: ${knowledgePath}`);
      return "";
    }
  } catch (error) {
    console.error(`❌ Error loading Vanessa knowledge base:`, error);
    return "";
  }
}

// Load knowledge base at startup for verification
const knowledgePath = path.join(process.cwd(), "resources", "vanessa_knowledge.txt");
try {
  const initialKnowledge = loadVanessaKnowledge();
  if (initialKnowledge) {
    console.log(`✅ Loaded Vanessa knowledge base from: ${knowledgePath}`);
  }
} catch (error) {
  console.error(`❌ Error verifying Vanessa knowledge base:`, error);
}

// Vanessa's persona reinforcement - ensures consistent personality
// This is passed as additional_instructions to reinforce the persona
// even if the Dashboard configuration changes
const VANESSA_PERSONA = `
You are Vanessa, the official AI assistant for OnSpot Global.
Your sole source of knowledge is the publicly available content on https://onspotglobal.com and the company knowledge base provided below.

=== WHAT YOU MUST DO ===
- Answer questions using ONLY information found on the website or in the knowledge base
- Provide exact, valid URLs when referencing pages (only use URLs from the [OnSpotGlobal.com Website Pages] section)
- Help users navigate the site efficiently
- Clearly state when information is not available: "That information is not currently available on onspotglobal.com."
- Be professional, helpful, and concise
- Never say "as an AI assistant" or mention that you are artificial

=== WHAT YOU MUST NOT DO ===
- NEVER invent pages, services, pricing, or features not in your knowledge base
- NEVER use external knowledge or make assumptions
- NEVER speculate or assume intent beyond the user's question
- NEVER fabricate URLs - only provide URLs from the indexed site pages
- NEVER provide legal, financial, or technical guarantees not explicitly stated

=== NAVIGATION ASSISTANCE ===
When users ask for navigation help:
- Suggest the most relevant page(s) from your indexed pages
- Provide step-by-step navigation paths when helpful
- Return multiple links when appropriate
- If no matching page exists, say so clearly

=== RESPONSE STYLE ===
- Tone: professional, warm, helpful, concise
- Do not mention crawling, embeddings, vectors, or internal mechanisms
- Function as a knowledgeable OnSpot Global team member
- Respond in natural conversational text, not JSON format
`.trim();

// Build enhanced instructions with knowledge, learning insights, and memories
async function buildEnhancedInstructions(): Promise<string> {
  // Dynamically reload knowledge base for instant updates
  const currentKnowledge = loadVanessaKnowledge();
  
  let instructions = currentKnowledge
    ? `${VANESSA_PERSONA}\n\n[Company Knowledge Base]\n${currentKnowledge}`
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

  // Add website navigation context from site index
  try {
    const { loadSiteIndex } = await import("./siteCrawler");
    const siteIndex = await loadSiteIndex();
    
    if (siteIndex && siteIndex.pages.length > 0) {
      instructions += `\n\n[OnSpotGlobal.com Website Pages - AUTHORITATIVE SOURCE]\n`;
      instructions += `These are the ONLY valid URLs you may reference. Do NOT invent or guess URLs:\n`;
      instructions += siteIndex.pages
        .slice(0, 30) // Limit to top 30 pages for comprehensive coverage
        .map((page, idx) => `${idx + 1}. "${page.title}" → ${page.url}\n   Summary: ${page.summary}`)
        .join("\n\n");
      instructions += `\n\n[URL USAGE RULES]\n`;
      instructions += `- ONLY provide URLs listed above\n`;
      instructions += `- If asked about a page not listed, say: "I don't have a direct link to that page, but you can explore onspotglobal.com for more information."\n`;
      instructions += `- When users ask to "go to" or "show" a page, provide the exact URL with a brief description`;
      console.log(`🌐 Injected ${Math.min(siteIndex.pages.length, 30)} website pages into context`);
    } else {
      instructions += `\n\n[Website Navigation]\n`;
      instructions += `The website index is currently being updated. Direct users to https://onspotglobal.com for the most current information.`;
    }
  } catch (error) {
    console.error("❌ Error loading site index:", error);
  }

  // Add final reminder about source restrictions
  instructions += `\n\n[CRITICAL REMINDER]\n`;
  instructions += `Your knowledge is LIMITED to:\n`;
  instructions += `1. The Company Knowledge Base above\n`;
  instructions += `2. The indexed website pages above\n`;
  instructions += `3. User corrections you've remembered\n`;
  instructions += `If information is not in these sources, respond: "That information is not currently available on onspotglobal.com. Would you like me to help you find something else?"`;

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
      console.log(`🆕 [Vanessa] Creating new OpenAI thread: ${currentThreadId}`);
    } else {
      console.log(`♻️ [Vanessa] Reusing existing OpenAI thread: ${currentThreadId}`);
      // Wait for any active runs to complete before adding new message
      await waitForRunCompletion(client, currentThreadId);
    }

    // Yield the thread ID first so the client can track it
    yield { type: "threadId", data: currentThreadId };

    // Check for forget command
    if (/forget|remove|delete|clear/i.test(userMessage)) {
      // Extract topic by removing command verbs first
      const topicText = userMessage
        .replace(/\b(forget|remove|delete|clear|about|the|that|this|everything)\b/gi, " ")
        .trim();
      
      const topic = extractTopicFromCorrection(topicText);
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
      const { cleanCorrectionText } = await import("./db_manager");
      const cleanedCorrection = cleanCorrectionText(userMessage);
      
      // Store in memory with cleaned text
      await storeMemory(topic, cleanedCorrection);
      
      // Update knowledge base file
      try {
        const fs = await import("fs/promises");
        const path = await import("path");
        const knowledgeFilePath = path.join(process.cwd(), "resources", "vanessa_knowledge.txt");
        
        const timestamp = new Date().toISOString();
        const correctionSection = `\n\n=== Admin Training Update (${timestamp}) ===\nTopic: ${topic}\nCorrect statement: ${cleanedCorrection}\n=== End Update ===\n`;
        
        await fs.appendFile(knowledgeFilePath, correctionSection);
        console.log(`✅ Vanessa knowledge file updated with correction for topic: ${topic}`);
      } catch (fileError: any) {
        console.error(`⚠️ Failed to update knowledge file:`, fileError);
        // Continue even if file update fails - memory is already updated
      }
      
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
