import OpenAI from "openai";
import { randomUUID } from "crypto";

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

// In-memory conversation history storage with timestamps (threadId -> {messages, lastAccess})
const conversationHistory = new Map<string, {
  messages: ChatMessage[];
  lastAccess: number;
}>();

// Cleanup old conversations every 15 minutes
const CLEANUP_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
const MAX_CONVERSATION_AGE_MS = 60 * 60 * 1000; // 1 hour

setInterval(() => {
  const now = Date.now();
  const keysToDelete: string[] = [];
  
  Array.from(conversationHistory.entries()).forEach(([threadId, data]) => {
    if (now - data.lastAccess > MAX_CONVERSATION_AGE_MS) {
      keysToDelete.push(threadId);
    }
  });
  
  keysToDelete.forEach(key => conversationHistory.delete(key));
  
  if (keysToDelete.length > 0) {
    console.log(`🧹 Cleaned up ${keysToDelete.length} expired conversation(s)`);
  }
}, CLEANUP_INTERVAL_MS);

// System prompt for Vanessa
const VANESSA_SYSTEM_PROMPT = `
You are Vanessa, the friendly and professional AI assistant for OnSpot Workspace.
You help users by answering FAQs about OnSpot's coworking spaces, staffing, outsourcing,
and global support solutions. Always respond helpfully, conversationally, and concisely.
`.trim();

/**
 * Send a message to the OpenAI Chat API and get a response
 * Uses gpt-5 with Vanessa's system prompt (your GPT’s behavior)
 */
export async function sendMessageToAssistant(
  userMessage: string,
  threadId?: string,
): Promise<ChatResponse> {
  try {
    // Generate or use existing thread ID
    const currentThreadId = threadId || randomUUID();
    
    // Get or initialize conversation history for this thread
    const conversationData = conversationHistory.get(currentThreadId) || { messages: [], lastAccess: Date.now() };
    let history = conversationData.messages;
    
    // Update last access time
    conversationData.lastAccess = Date.now();
    
    // Add user's message to history
    history.push({ role: "user", content: userMessage });
    
    // Build messages array with system prompt and full conversation history
    const messages: any[] = [
      { role: "system", content: VANESSA_SYSTEM_PROMPT },
      ...history
    ];

    // Get response from OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.7,
    });

    const reply = completion.choices[0].message.content || "Sorry, I couldn't generate a reply.";
    
    // Add assistant's response to history
    history.push({ role: "assistant", content: reply });
    
    // Store updated history (limit to last 20 messages to prevent memory issues)
    if (history.length > 20) {
      history = history.slice(-20);
    }
    conversationData.messages = history;
    conversationHistory.set(currentThreadId, conversationData);

    return {
      message: reply,
      threadId: currentThreadId,
    };
  } catch (error) {
    console.error("❌ OpenAI Chat API error:", error);
    throw error;
  }
}

/**
 * Stream responses from Vanessa with conversation history
 */
export async function* streamMessageToAssistant(
  userMessage: string,
  threadId?: string,
): AsyncGenerator<{ type: "content" | "done" | "threadId"; data: string }> {
  try {
    // Generate or use existing thread ID
    const currentThreadId = threadId || randomUUID();
    
    // Get or initialize conversation history for this thread
    const conversationData = conversationHistory.get(currentThreadId) || { messages: [], lastAccess: Date.now() };
    let history = conversationData.messages;
    
    // Update last access time
    conversationData.lastAccess = Date.now();
    
    // Add user's message to history
    history.push({ role: "user", content: userMessage });
    
    // Build messages array with system prompt and full conversation history
    const messages: any[] = [
      { role: "system", content: VANESSA_SYSTEM_PROMPT },
      ...history
    ];

    // Stream response from OpenAI
    const stream = await openai.chat.completions.stream({
      model: "gpt-4o-mini",
      messages,
      stream: true,
      temperature: 0.7,
    });

    // Yield thread ID first
    yield { type: "threadId", data: currentThreadId };

    // Collect the full assistant response as we stream it
    let fullResponse = "";

    // Process streaming chunks
    for await (const chunk of stream) {
      const content = chunk.choices?.[0]?.delta?.content;
      if (content) {
        fullResponse += content;
        yield { type: "content", data: content };
      }
    }

    // Add assistant's response to history
    history.push({ role: "assistant", content: fullResponse });
    
    // Store updated history (limit to last 20 messages to prevent memory issues)
    if (history.length > 20) {
      history = history.slice(-20);
    }
    conversationData.messages = history;
    conversationHistory.set(currentThreadId, conversationData);

    yield { type: "done", data: "" };
  } catch (error) {
    console.error("❌ Vanessa streaming error:", error);
    throw error;
  }
}
