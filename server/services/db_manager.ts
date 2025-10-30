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
// Memory Management (Short-Term Learning)
// ========================================

/**
 * Extract topic from a user correction message
 * Returns the main subject of the correction
 */
export function extractTopicFromCorrection(text: string): string {
  // Common stopwords to filter out
  const stopwords = new Set([
    "the", "is", "at", "which", "on", "a", "an", "and", "or", "but",
    "in", "with", "to", "for", "of", "as", "by", "from", "about",
    "should", "would", "could", "can", "will", "be", "are", "was",
    "were", "been", "have", "has", "had", "do", "does", "did",
    "this", "that", "these", "those", "it", "its", "they", "them",
    "their", "i", "you", "we", "he", "she", "my", "your", "our",
    "actually", "remember", "correct", "wrong", "answer", "know",
    "change", "only", "just", "say"
  ]);

  // Extract meaningful words
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !stopwords.has(word));

  // Return first meaningful word as topic
  return words.length > 0 ? words[0] : "general";
}

/**
 * Clean a correction message to extract the actual fact
 * Removes correction patterns and keeps only the corrected statement
 */
export function cleanCorrectionText(text: string): string {
  // Remove correction pattern prefixes
  let cleaned = text
    .replace(/you should say/gi, "")
    .replace(/you should/gi, "")
    .replace(/that'?s wrong,?/gi, "")
    .replace(/actually,?/gi, "")
    .replace(/the correct answer is/gi, "")
    .replace(/remember that/gi, "")
    .replace(/let me correct you,?/gi, "")
    .replace(/correction:/gi, "")
    .replace(/fix that,?/gi, "")
    .replace(/not quite,?/gi, "")
    .replace(/change it to/gi, "")
    .replace(/change that to/gi, "")
    .replace(/it should be/gi, "")
    .replace(/only$/gi, "") // Remove trailing "only"
    .replace(/^["']|["']$/g, "") // Remove quotes at start/end
    .trim();
  
  return cleaned;
}

/**
 * Check if a message contains a correction pattern
 */
export function isCorrection(message: string): boolean {
  const correctionPatterns = [
    /you should/i,
    /that'?s wrong/i,
    /actually/i,
    /the correct answer is/i,
    /remember that/i,
    /let me correct/i,
    /correction:/i,
    /fix that/i,
    /not quite/i,
    /change it to/i,
    /change that to/i,
    /it should be/i,
  ];

  return correctionPatterns.some((pattern) => pattern.test(message));
}

/**
 * Store a memory/correction in Replit DB
 * Key format: `memory:<topic>`
 */
export async function storeMemory(topic: string, content: string): Promise<void> {
  try {
    const key = `memory:${topic}`;
    const memory = {
      topic,
      content: truncateText(content, 1000),
      timestamp: Date.now(),
    };
    
    await db.set(key, memory);
    console.log(`🧠 Memory saved for topic: ${topic}`);
  } catch (error) {
    console.error(`❌ Error storing memory for topic ${topic}:`, error);
    throw error;
  }
}

/**
 * Retrieve all stored memories
 * Returns array of memory objects
 */
export async function getAllMemories(): Promise<Array<{ topic: string; content: string; timestamp: number }>> {
  try {
    const result = await db.list("memory:");
    const keys = result.ok ? result.value : [];
    
    const memories = await Promise.all(
      keys.map(async (key: string) => {
        const data = await db.get(key);
        return data.ok ? data.value : null;
      })
    );
    
    return memories.filter((m) => m !== null) as Array<{ topic: string; content: string; timestamp: number }>;
  } catch (error) {
    console.error("❌ Error retrieving all memories:", error);
    return [];
  }
}

/**
 * Delete a specific memory by topic
 * Key format: `memory:<topic>`
 */
export async function deleteMemory(topic: string): Promise<boolean> {
  try {
    const key = `memory:${topic}`;
    await db.delete(key);
    console.log(`🗑️ Memory deleted for topic: ${topic}`);
    return true;
  } catch (error) {
    console.error(`❌ Error deleting memory for topic ${topic}:`, error);
    return false;
  }
}

/**
 * Clear all memories (for admin use)
 */
export async function clearAllMemories(): Promise<number> {
  try {
    const result = await db.list("memory:");
    const keys = result.ok ? result.value : [];
    
    for (const key of keys) {
      await db.delete(key);
    }
    
    console.log(`🗑️ Cleared ${keys.length} memories`);
    return keys.length;
  } catch (error) {
    console.error("❌ Error clearing all memories:", error);
    return 0;
  }
}

// ========================================
// Feedback Management
// ========================================

/**
 * Extract main topics/keywords from feedback comment
 * Returns array of keywords (lowercased, filtered)
 */
function extractTopicsFromFeedback(comment: string | undefined): string[] {
  if (!comment || comment.trim().length === 0) {
    return [];
  }

  // Common stopwords to filter out
  const stopwords = new Set([
    "the", "is", "at", "which", "on", "a", "an", "and", "or", "but",
    "in", "with", "to", "for", "of", "as", "by", "from", "about",
    "should", "would", "could", "can", "will", "be", "are", "was",
    "were", "been", "have", "has", "had", "do", "does", "did",
    "this", "that", "these", "those", "it", "its", "they", "them",
    "their", "i", "you", "we", "he", "she", "my", "your", "our"
  ]);

  // Split into words, filter, and normalize
  const words = comment
    .toLowerCase()
    .replace(/[^\w\s]/g, " ") // Remove punctuation
    .split(/\s+/)
    .filter((word) => word.length > 2 && !stopwords.has(word));

  // Get unique words
  return Array.from(new Set(words)).slice(0, 5); // Limit to top 5 keywords
}

/**
 * Get feedback count for a specific topic
 * Key format: `feedback_topic:<topic>`
 */
async function getFeedbackCountForTopic(topic: string): Promise<number> {
  try {
    const key = `feedback_topic:${topic}`;
    const result = await db.get(key);
    if (result.ok && result.value && Array.isArray(result.value)) {
      return result.value.length;
    }
    return 0;
  } catch (error) {
    console.error(`❌ Error getting feedback count for topic ${topic}:`, error);
    return 0;
  }
}

/**
 * Track feedback by topic
 * Key format: `feedback_topic:<topic>`
 */
async function trackFeedbackByTopic(topic: string, feedback: FeedbackEntry): Promise<void> {
  try {
    const key = `feedback_topic:${topic}`;
    const result = await db.get(key);
    const existing = result.ok && result.value ? result.value : [];
    const feedbackList = Array.isArray(existing) ? existing : [];

    feedbackList.push({
      messageId: feedback.messageId,
      comment: feedback.comment,
      rating: feedback.rating,
      timestamp: feedback.timestamp,
    });

    await db.set(key, feedbackList);
  } catch (error) {
    console.error(`❌ Error tracking feedback by topic ${topic}:`, error);
  }
}

/**
 * Store user feedback for a message
 * Key format: `feedback:<messageId>`
 * Also tracks total count, history, and checks for similar feedback
 */
export async function storeFeedback(feedback: FeedbackEntry): Promise<{
  stored: boolean;
  shouldTriggerLearning: boolean;
  topics: string[];
  totalCount: number;
}> {
  try {
    const key = `feedback:${feedback.messageId}`;
    
    // Sanitize input
    const sanitizedFeedback = {
      ...feedback,
      comment: feedback.comment ? sanitizeText(feedback.comment) : undefined,
    };
    
    await db.set(key, sanitizedFeedback);
    
    // Increment feedback counter
    const countResult = await db.get("feedback_count");
    const currentCount = (countResult.ok && typeof countResult.value === "number") 
      ? countResult.value 
      : 0;
    const newCount = currentCount + 1;
    await db.set("feedback_count", newCount);
    
    // Add to feedback history
    const historyResult = await db.get("feedback_history");
    const history = (historyResult.ok && Array.isArray(historyResult.value))
      ? historyResult.value
      : [];
    
    history.push({
      messageId: feedback.messageId,
      rating: feedback.rating,
      comment: sanitizedFeedback.comment,
      timestamp: feedback.timestamp,
    });
    
    // Keep last 1000 feedback entries in history
    if (history.length > 1000) {
      history.shift();
    }
    
    await db.set("feedback_history", history);
    
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
    
    // Extract topics from feedback comment
    const topics = extractTopicsFromFeedback(sanitizedFeedback.comment);
    
    // Track feedback by topic and check for similar feedback
    let shouldTriggerLearning = false;
    
    if (topics.length > 0) {
      // Track by each topic
      for (const topic of topics) {
        await trackFeedbackByTopic(topic, sanitizedFeedback);
        const topicCount = await getFeedbackCountForTopic(topic);
        
        // If we have 2 or more similar feedbacks on this topic, trigger learning
        if (topicCount >= 2) {
          shouldTriggerLearning = true;
          console.log(`⚙️ Detected ${topicCount} similar feedbacks (topic: ${topic})`);
        }
      }
    }
    
    console.log(`🧠 Feedback stored: "${sanitizedFeedback.comment || '(no comment)'}"`);
    console.log(`📝 Current total: ${newCount} feedbacks`);
    
    if (topics.length > 0) {
      console.log(`🏷️ Topics extracted: ${topics.join(", ")}`);
    }
    
    return {
      stored: true,
      shouldTriggerLearning,
      topics,
      totalCount: newCount,
    };
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

/**
 * Get total feedback count
 */
export async function getFeedbackCount(): Promise<number> {
  try {
    const result = await db.get("feedback_count");
    return (result.ok && typeof result.value === "number") ? result.value : 0;
  } catch (error) {
    console.error("❌ Error getting feedback count:", error);
    return 0;
  }
}

/**
 * Get feedback history
 */
export async function getFeedbackHistory(): Promise<any[]> {
  try {
    const result = await db.get("feedback_history");
    return (result.ok && Array.isArray(result.value)) ? result.value : [];
  } catch (error) {
    console.error("❌ Error getting feedback history:", error);
    return [];
  }
}

/**
 * Get feedback statistics
 */
export async function getFeedbackStats(): Promise<{
  totalCount: number;
  positiveCount: number;
  negativeCount: number;
  recentFeedback: any[];
}> {
  try {
    const history = await getFeedbackHistory();
    const totalCount = await getFeedbackCount();
    
    const positiveCount = history.filter((f) => f.rating === "up").length;
    const negativeCount = history.filter((f) => f.rating === "down").length;
    const recentFeedback = history.slice(-10).reverse();
    
    return {
      totalCount,
      positiveCount,
      negativeCount,
      recentFeedback,
    };
  } catch (error) {
    console.error("❌ Error getting feedback stats:", error);
    return {
      totalCount: 0,
      positiveCount: 0,
      negativeCount: 0,
      recentFeedback: [],
    };
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
// Learning Status Management
// ========================================

export interface LearningStatus {
  status: "running" | "success" | "failed";
  feedbackCount: number;
  summaryKey?: string;
  startedAt: string;
  completedAt?: string;
  error?: string;
}

/**
 * Store a learning status entry
 * Key format: `learning_status:<timestamp>`
 */
export async function storeLearningStatus(status: LearningStatus, timestamp?: number): Promise<string> {
  try {
    const ts = timestamp || Date.now();
    const key = `learning_status:${ts}`;
    await db.set(key, status);
    console.log(`✅ Stored learning status: ${status.status}`);
    return key;
  } catch (error) {
    console.error("❌ Error storing learning status:", error);
    throw error;
  }
}

/**
 * Get the N most recent learning status entries
 */
export async function getRecentLearningStatuses(limit: number = 5): Promise<LearningStatus[]> {
  try {
    const result = await db.list("learning_status:");
    const keys = result.ok ? result.value : [];
    
    // Sort keys by timestamp (descending)
    const sortedKeys = keys.sort((a: string, b: string) => {
      const timestampA = parseInt(a.split(":")[1] || "0");
      const timestampB = parseInt(b.split(":")[1] || "0");
      return timestampB - timestampA;
    });
    
    // Get the most recent N entries
    const recentKeys = sortedKeys.slice(0, limit);
    const statusPromises = recentKeys.map((key: string) => db.get(key));
    const statusResults = await Promise.all(statusPromises);
    
    const statuses = statusResults
      .filter((r: any) => r.ok && r.value && typeof r.value === 'object')
      .map((r: any) => r.value as LearningStatus);
    
    return statuses;
  } catch (error) {
    console.error("❌ Error getting recent learning statuses:", error);
    return [];
  }
}

/**
 * Calculate learning health metrics (only counts finalized runs, excludes "running" status)
 */
export async function calculateLearningHealth(): Promise<{
  totalRuns: number;
  successRuns: number;
  failedRuns: number;
  successRate: number;
}> {
  try {
    const result = await db.list("learning_status:");
    const keys = result.ok ? result.value : [];
    
    const statusPromises = keys.map((key: string) => db.get(key));
    const statusResults = await Promise.all(statusPromises);
    
    // Only count finalized runs (success or failed, exclude running)
    const statuses = statusResults
      .filter((r: any) => r.ok && r.value && typeof r.value === 'object')
      .map((r: any) => r.value as LearningStatus)
      .filter(s => s.status !== "running");
    
    const totalRuns = statuses.length;
    const successRuns = statuses.filter(s => s.status === "success").length;
    const failedRuns = statuses.filter(s => s.status === "failed").length;
    const successRate = totalRuns > 0 ? Math.round((successRuns / totalRuns) * 100) : 0;
    
    const health = {
      totalRuns,
      successRuns,
      failedRuns,
      successRate,
    };
    
    // Cache the health metrics
    await db.set("learning_health:latest", health);
    
    return health;
  } catch (error) {
    console.error("❌ Error calculating learning health:", error);
    return {
      totalRuns: 0,
      successRuns: 0,
      failedRuns: 0,
      successRate: 0,
    };
  }
}

/**
 * Get cached learning health metrics
 */
export async function getLearningHealth(): Promise<{
  totalRuns: number;
  successRuns: number;
  failedRuns: number;
  successRate: number;
} | null> {
  try {
    const result = await db.get("learning_health:latest");
    return (result.ok && result.value) ? result.value as any : null;
  } catch (error) {
    console.error("❌ Error getting learning health:", error);
    return null;
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
