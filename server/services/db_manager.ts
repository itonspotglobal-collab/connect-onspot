import Database from "@replit/database";

const db = new Database();

// ========================================
// Type Definitions
// ========================================

export interface ConversationMessage {
  threadId: string;
  userMessage: string;
  assistantResponse: string;
  timestamp: number;
  messageId: string;
}

export interface FeedbackEntry {
  messageId: string;
  threadId: string;
  rating: "up" | "down";
  comment?: string;
  timestamp: number;
}

export interface KnowledgeSummary {
  topic: string;
  content: string;
  summary: string;
  lastUpdated: number;
}

export interface LearningSummary {
  date: string;
  insights: string[];
  improvementAreas: string[];
  topPositiveTopics: string[];
  commonIssues: string[];
  totalFeedback: number;
  positiveCount: number;
  negativeCount: number;
}

export interface UserMemory {
  userId: string;
  lastInteraction: number;
  conversationCount: number;
  preferences: Record<string, any>;
  context: string;
}

// ========================================
// Conversation History Management
// ========================================

/**
 * Store a conversation message in Replit DB
 * Key format: `thread:<threadId>:messages`
 */
export async function storeConversation(message: ConversationMessage): Promise<void> {
  try {
    const key = `thread:${message.threadId}:messages`;
    
    // Get existing messages or initialize empty array
    const result = await db.get(key);
    const existing = result.ok ? result.value : null;
    const messages: ConversationMessage[] = Array.isArray(existing) ? existing : [];
    
    // Limit stored messages to prevent size issues (keep last 100 per thread)
    if (messages.length >= 100) {
      messages.shift(); // Remove oldest message
    }
    
    messages.push({
      ...message,
      // Truncate very long messages to prevent storage issues
      userMessage: truncateText(message.userMessage, 2000),
      assistantResponse: truncateText(message.assistantResponse, 4000),
    });
    
    await db.set(key, messages);
    console.log(`✅ Stored conversation message in thread: ${message.threadId}`);
  } catch (error) {
    console.error("❌ Error storing conversation:", error);
    throw error;
  }
}

/**
 * Retrieve conversation history for a specific thread
 */
export async function getConversationHistory(threadId: string): Promise<ConversationMessage[]> {
  try {
    const key = `thread:${threadId}:messages`;
    const result = await db.get(key);
    const messages = (result.ok && result.value) ? result.value : null;
    return Array.isArray(messages) ? messages : [];
  } catch (error) {
    console.error(`❌ Error retrieving conversation history for ${threadId}:`, error);
    return [];
  }
}

/**
 * Get all conversation threads (for admin dashboard)
 */
export async function getAllThreadIds(): Promise<string[]> {
  try {
    const result = await db.list("thread:");
    const keys = result.ok ? result.value : [];
    
    const threadIds = keys
      .filter((key: string) => key.includes(":messages"))
      .map((key: string) => {
        const match = key.match(/^thread:([^:]+):/);
        return match ? match[1] : null;
      })
      .filter((id: string | null) => id !== null) as string[];
    
    return Array.from(new Set(threadIds)); // Remove duplicates
  } catch (error) {
    console.error("❌ Error getting all thread IDs:", error);
    return [];
  }
}

// ========================================
// Feedback Management
// ========================================

/**
 * Store user feedback for a message
 * Key format: `feedback:<messageId>`
 */
export async function storeFeedback(feedback: FeedbackEntry): Promise<void> {
  try {
    const key = `feedback:${feedback.messageId}`;
    
    // Sanitize input
    const sanitizedFeedback = {
      ...feedback,
      comment: feedback.comment ? sanitizeText(feedback.comment) : undefined,
    };
    
    await db.set(key, sanitizedFeedback);
    
    // Also maintain a feedback index for the thread
    const threadFeedbackKey = `thread:${feedback.threadId}:feedback`;
    const result = await db.get(threadFeedbackKey);
    const existing = result.ok ? result.value : null;
    const feedbackList: Array<{ messageId: string; rating: string; timestamp: number }> = Array.isArray(existing) ? existing : [];
    
    feedbackList.push({
      messageId: feedback.messageId,
      rating: feedback.rating,
      timestamp: feedback.timestamp,
    });
    
    await db.set(threadFeedbackKey, feedbackList);
    
    console.log(`✅ Stored feedback for message: ${feedback.messageId}`);
  } catch (error) {
    console.error("❌ Error storing feedback:", error);
    throw error;
  }
}

/**
 * Get all feedback entries
 */
export async function getAllFeedback(): Promise<FeedbackEntry[]> {
  try {
    const result = await db.list("feedback:");
    const keys = result.ok ? result.value : [];
    
    const feedbackPromises = keys.map((key: string) => db.get(key));
    const feedbackResults = await Promise.all(feedbackPromises);
    
    const feedbackEntries = feedbackResults
      .filter((r: any) => r.ok && r.value && typeof r.value === 'object')
      .map((r: any) => r.value as FeedbackEntry);
    
    return feedbackEntries.sort((a: FeedbackEntry, b: FeedbackEntry) => b.timestamp - a.timestamp);
  } catch (error) {
    console.error("❌ Error getting all feedback:", error);
    return [];
  }
}

/**
 * Get feedback for a specific thread
 */
export async function getThreadFeedback(threadId: string): Promise<any[]> {
  try {
    const key = `thread:${threadId}:feedback`;
    const result = await db.get(key);
    const feedback = (result.ok && result.value) ? result.value : null;
    return Array.isArray(feedback) ? feedback : [];
  } catch (error) {
    console.error(`❌ Error getting feedback for thread ${threadId}:`, error);
    return [];
  }
}

// ========================================
// Knowledge Management
// ========================================

/**
 * Store a knowledge summary
 * Key format: `knowledge:<topic>`
 */
export async function storeKnowledgeSummary(knowledge: KnowledgeSummary): Promise<void> {
  try {
    const key = `knowledge:${sanitizeKey(knowledge.topic)}`;
    await db.set(key, {
      ...knowledge,
      lastUpdated: Date.now(),
    });
    console.log(`✅ Stored knowledge summary for topic: ${knowledge.topic}`);
  } catch (error) {
    console.error("❌ Error storing knowledge summary:", error);
    throw error;
  }
}

/**
 * Get knowledge summary for a specific topic
 */
export async function getKnowledgeSummary(topic: string): Promise<KnowledgeSummary | null> {
  try {
    const key = `knowledge:${sanitizeKey(topic)}`;
    const result = await db.get(key);
    return (result.ok && result.value) ? result.value as KnowledgeSummary : null;
  } catch (error) {
    console.error(`❌ Error getting knowledge summary for ${topic}:`, error);
    return null;
  }
}

/**
 * Get all knowledge summaries
 */
export async function getAllKnowledge(): Promise<KnowledgeSummary[]> {
  try {
    const result = await db.list("knowledge:");
    const keys = result.ok ? result.value : [];
    
    const knowledgePromises = keys.map((key: string) => db.get(key));
    const knowledgeResults = await Promise.all(knowledgePromises);
    
    const knowledgeEntries = knowledgeResults
      .filter((r: any) => r.ok && r.value && typeof r.value === 'object')
      .map((r: any) => r.value as KnowledgeSummary);
    
    return knowledgeEntries.sort((a: KnowledgeSummary, b: KnowledgeSummary) => b.lastUpdated - a.lastUpdated);
  } catch (error) {
    console.error("❌ Error getting all knowledge:", error);
    return [];
  }
}

// ========================================
// Learning Summary Management
// ========================================

/**
 * Store a learning summary
 * Key format: `learning_summary:<timestamp>`
 */
export async function storeLearningSummary(summary: LearningSummary): Promise<void> {
  try {
    const timestamp = Date.now();
    const key = `learning_summary:${timestamp}`;
    
    await db.set(key, summary);
    
    // Also update the "latest" pointer for quick access
    await db.set("learning_summary:latest", {
      ...summary,
      timestamp,
    });
    
    console.log(`✅ Stored learning summary for ${summary.date}`);
  } catch (error) {
    console.error("❌ Error storing learning summary:", error);
    throw error;
  }
}

/**
 * Get the latest learning summary
 */
export async function getLatestLearningSummary(): Promise<(LearningSummary & { timestamp?: number }) | null> {
  try {
    const result = await db.get("learning_summary:latest");
    return (result.ok && result.value) ? result.value as (LearningSummary & { timestamp?: number }) : null;
  } catch (error) {
    console.error("❌ Error getting latest learning summary:", error);
    return null;
  }
}

/**
 * Get all learning summaries
 */
export async function getAllLearningSummaries(): Promise<LearningSummary[]> {
  try {
    const result = await db.list("learning_summary:");
    const keys = result.ok ? result.value : [];
    
    const summaryPromises = keys
      .filter((key: string) => key !== "learning_summary:latest")
      .map((key: string) => db.get(key));
    
    const summaryResults = await Promise.all(summaryPromises);
    
    const summaries = summaryResults
      .filter((r: any) => r.ok && r.value && typeof r.value === 'object')
      .map((r: any) => r.value as LearningSummary);
    
    return summaries.sort((a: any, b: any) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return dateB - dateA;
    });
  } catch (error) {
    console.error("❌ Error getting all learning summaries:", error);
    return [];
  }
}

// ========================================
// User Memory Management
// ========================================

/**
 * Update user memory (context, preferences)
 * Key format: `user:<userId>:memory`
 */
export async function updateUserMemory(memory: UserMemory): Promise<void> {
  try {
    const key = `user:${memory.userId}:memory`;
    await db.set(key, {
      ...memory,
      lastInteraction: Date.now(),
    });
    console.log(`✅ Updated memory for user: ${memory.userId}`);
  } catch (error) {
    console.error("❌ Error updating user memory:", error);
    throw error;
  }
}

/**
 * Get user memory
 */
export async function getUserMemory(userId: string): Promise<UserMemory | null> {
  try {
    const key = `user:${userId}:memory`;
    const result = await db.get(key);
    return (result.ok && result.value) ? result.value as UserMemory : null;
  } catch (error) {
    console.error(`❌ Error getting user memory for ${userId}:`, error);
    return null;
  }
}

// ========================================
// Utility Functions
// ========================================

/**
 * Truncate text to a maximum length
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "...";
}

/**
 * Sanitize text to prevent injection attacks
 */
function sanitizeText(text: string): string {
  // Remove potentially dangerous characters
  return text
    .replace(/<script[^>]*>.*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, "")
    .trim()
    .substring(0, 1000); // Limit comment length
}

/**
 * Sanitize database key names
 */
function sanitizeKey(key: string): string {
  return key
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "_")
    .substring(0, 50);
}

/**
 * Get database statistics for admin dashboard
 */
export async function getDatabaseStats(): Promise<{
  totalThreads: number;
  totalFeedback: number;
  totalKnowledge: number;
  totalLearningSummaries: number;
}> {
  try {
    const [threads, feedbackResult, knowledgeResult, summaryResult] = await Promise.all([
      getAllThreadIds(),
      db.list("feedback:"),
      db.list("knowledge:"),
      db.list("learning_summary:"),
    ]);
    
    const feedbackKeys = feedbackResult.ok ? feedbackResult.value : [];
    const knowledgeKeys = knowledgeResult.ok ? knowledgeResult.value : [];
    const summaryKeys = summaryResult.ok ? summaryResult.value : [];
    
    return {
      totalThreads: threads.length,
      totalFeedback: feedbackKeys.length,
      totalKnowledge: knowledgeKeys.length,
      totalLearningSummaries: summaryKeys.filter((k: string) => k !== "learning_summary:latest").length,
    };
  } catch (error) {
    console.error("❌ Error getting database stats:", error);
    return {
      totalThreads: 0,
      totalFeedback: 0,
      totalKnowledge: 0,
      totalLearningSummaries: 0,
    };
  }
}

/**
 * Clear old data to prevent database bloat (optional maintenance function)
 */
export async function clearOldData(daysToKeep: number = 90): Promise<void> {
  try {
    const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
    
    // Clear old conversations
    const threadIds = await getAllThreadIds();
    for (const threadId of threadIds) {
      const messages = await getConversationHistory(threadId);
      const recentMessages = messages.filter((msg) => msg.timestamp > cutoffTime);
      
      if (recentMessages.length === 0) {
        // Delete entire thread if no recent messages
        await db.delete(`thread:${threadId}:messages`);
        await db.delete(`thread:${threadId}:feedback`);
      } else if (recentMessages.length < messages.length) {
        // Update with only recent messages
        await db.set(`thread:${threadId}:messages`, recentMessages);
      }
    }
    
    console.log(`✅ Cleared data older than ${daysToKeep} days`);
  } catch (error) {
    console.error("❌ Error clearing old data:", error);
  }
}
