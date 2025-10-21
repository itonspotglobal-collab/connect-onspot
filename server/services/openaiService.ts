import OpenAI from "openai";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Assistant ID from OpenAI dashboard
const ASSISTANT_ID = "asst_l95RxbCxER9j1TZLiJQzEpt2";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatResponse {
  message: string;
  threadId: string;
}

/**
 * Send a message to the OpenAI Assistant and get a response
 * Uses OpenAI Assistants API for stateful conversations
 */
export async function sendMessageToAssistant(
  userMessage: string,
  threadId?: string
): Promise<ChatResponse> {
  try {
    // Create or use existing thread
    let thread;
    if (threadId) {
      thread = { id: threadId };
    } else {
      thread = await openai.beta.threads.create();
    }

    // Add user message to thread
    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: userMessage,
    });

    // Run the assistant
    const run = await openai.beta.threads.runs.createAndPoll(thread.id, {
      assistant_id: ASSISTANT_ID,
    });

    // Check run status
    if (run.status === "completed") {
      // Get the assistant's messages
      const messages = await openai.beta.threads.messages.list(thread.id);
      
      // Find the latest assistant message
      const assistantMessage = messages.data.find(
        (msg) => msg.role === "assistant" && msg.run_id === run.id
      );

      if (assistantMessage && assistantMessage.content[0].type === "text") {
        return {
          message: assistantMessage.content[0].text.value,
          threadId: thread.id,
        };
      }
    }

    throw new Error(`Assistant run failed with status: ${run.status}`);
  } catch (error) {
    console.error("❌ OpenAI Assistant error:", error);
    throw error;
  }
}

/**
 * Send a message with streaming support
 * Returns an async generator that yields message chunks
 */
export async function* streamMessageToAssistant(
  userMessage: string,
  threadId?: string
): AsyncGenerator<{ type: "content" | "done" | "threadId"; data: string }> {
  try {
    // Create or use existing thread
    let thread;
    if (threadId) {
      thread = { id: threadId };
    } else {
      thread = await openai.beta.threads.create();
      yield { type: "threadId", data: thread.id };
    }

    // Add user message to thread
    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: userMessage,
    });

    // Run the assistant with streaming
    const stream = await openai.beta.threads.runs.stream(thread.id, {
      assistant_id: ASSISTANT_ID,
    });

    // Process streaming events
    for await (const event of stream) {
      // Handle text delta events
      if (
        event.event === "thread.message.delta" &&
        event.data.delta.content &&
        event.data.delta.content[0]?.type === "text"
      ) {
        const textDelta = event.data.delta.content[0].text?.value;
        if (textDelta) {
          yield { type: "content", data: textDelta };
        }
      }

      // Handle completion
      if (event.event === "thread.run.completed") {
        yield { type: "done", data: "" };
      }
    }
  } catch (error) {
    console.error("❌ OpenAI Streaming error:", error);
    throw error;
  }
}
