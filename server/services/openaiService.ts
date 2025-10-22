import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatResponse {
  message: string;
  threadId: string;
}

/**
 * Send a message to the OpenAI Chat API and get a response
 * Uses gpt-5 with Vanessa's system prompt (your GPT’s behavior)
 */
export async function sendMessageToAssistant(
  userMessage: string,
  threadId?: string,
): Promise<ChatResponse> {
  try {
    // Use the Chat Completions API instead of Assistants API
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1",
      messages: [
        {
          role: "system",
          content: `
You are Vanessa, the friendly and professional AI assistant for OnSpot Workspace.
You help users by answering FAQs about OnSpot's coworking spaces, staffing, outsourcing,
and global support solutions. Always respond helpfully, conversationally, and concisely.
          `,
        },
        {
          role: "user",
          content: userMessage,
        },
      ],
      temperature: 0.7,
    });

    const reply =
      completion.choices[0].message.content ||
      "Sorry, I couldn't generate a reply.";
    const newThreadId = threadId || crypto.randomUUID();

    return {
      message: reply,
      threadId: newThreadId,
    };
  } catch (error) {
    console.error("❌ OpenAI Chat API error:", error);
    throw error;
  }
}

/**
 * Stream responses from Vanessa (typing effect)
 */
export async function* streamMessageToAssistant(
  userMessage: string,
  threadId?: string,
): AsyncGenerator<{ type: "content" | "done" | "threadId"; data: string }> {
  try {
    const stream = await openai.chat.completions.stream({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: `
You are Vanessa, the friendly and professional AI assistant for OnSpot Workspace.
You help users by answering FAQs about OnSpot's coworking spaces, staffing, outsourcing,
and global support solutions. Always respond helpfully, conversationally, and concisely.
          `,
        },
        { role: "user", content: userMessage },
      ],
      stream: true,
    });

    // Return a generated thread ID for continuity
    const newThreadId = threadId || crypto.randomUUID();
    yield { type: "threadId", data: newThreadId };

    // Process streaming chunks
    for await (const chunk of stream) {
      const content = chunk.choices?.[0]?.delta?.content;
      if (content) {
        yield { type: "content", data: content };
      }
    }

    yield { type: "done", data: "" };
  } catch (error) {
    console.error("❌ Vanessa streaming error:", error);
    throw error;
  }
}
