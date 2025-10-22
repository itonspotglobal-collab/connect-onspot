import OpenAI from "openai";

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

export interface ChatResponse {
  message: string;
  threadId: string;
}

/**
 * Stream responses from the OpenAI Assistant with conversation continuity
 * Uses the Assistant API with threads for natural conversation flow
 */
export async function* streamWithAssistant(
  userMessage: string,
  threadId?: string,
): AsyncGenerator<{ type: "content" | "done" | "threadId"; data: string }> {
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
    }

    // Yield the thread ID first so the client can track it
    yield { type: "threadId", data: currentThreadId };

    // Add the user's message to the thread
    await client.beta.threads.messages.create(currentThreadId, {
      role: "user",
      content: userMessage,
    });

    // Start a streaming run with the assistant
    const stream = await client.beta.threads.runs.stream(currentThreadId, {
      assistant_id: assistantId,
    });

    // Process the streaming response
    for await (const event of stream) {
      // Handle text delta events (streaming tokens)
      if (event.event === "thread.message.delta") {
        const delta = event.data.delta;
        if (delta.content && delta.content[0]?.type === "text") {
          const textDelta = delta.content[0].text?.value;
          if (textDelta) {
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
    }

    // Add the user's message to the thread
    await client.beta.threads.messages.create(currentThreadId, {
      role: "user",
      content: userMessage,
    });

    // Run the assistant (non-streaming)
    const run = await client.beta.threads.runs.createAndPoll(currentThreadId, {
      assistant_id: assistantId,
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
