import OpenAI from "openai";
import fs from "fs";
import path from "path";
import {
  getAllFeedback,
  getConversationHistory,
  getAllThreadIds,
  storeLearningSummary,
  storeKnowledgeSummary,
  storeLearningStatus,
  calculateLearningHealth,
  type LearningSummary,
  type KnowledgeSummary,
  type LearningStatus,
} from "./db_manager";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Constants
const KNOWLEDGE_FILE_PATH = path.join(process.cwd(), "resources", "vanessa_knowledge.txt");
const MAX_FILE_SIZE = 1024 * 1024; // 1MB limit

// ========================================
// Knowledge Ingestion
// ========================================

/**
 * Read and summarize knowledge files from /resources/knowledge/
 */
export async function ingestKnowledgeFiles(): Promise<{ success: boolean; summaries: number; errors: string[] }> {
  const knowledgeDir = path.join(process.cwd(), "resources", "knowledge");
  const errors: string[] = [];
  let summaries = 0;

  try {
    // Create knowledge directory if it doesn't exist
    if (!fs.existsSync(knowledgeDir)) {
      fs.mkdirSync(knowledgeDir, { recursive: true });
      console.log(`📁 Created knowledge directory: ${knowledgeDir}`);
      return { success: true, summaries: 0, errors: [] };
    }

    // Read all .txt files from the directory
    const files = fs.readdirSync(knowledgeDir).filter((f) => f.endsWith(".txt"));

    if (files.length === 0) {
      console.log(`⚠️ No knowledge files found in ${knowledgeDir}`);
      return { success: true, summaries: 0, errors: [] };
    }

    // Process each file
    for (const file of files) {
      try {
        const filePath = path.join(knowledgeDir, file);
        const content = fs.readFileSync(filePath, "utf-8");
        
        // Skip empty files
        if (content.trim().length === 0) {
          console.log(`⏭️ Skipping empty file: ${file}`);
          continue;
        }

        // Summarize using OpenAI
        const summary = await summarizeText(content);
        
        // Store in Replit DB
        const topic = file.replace(".txt", "").replace(/_/g, " ");
        await storeKnowledgeSummary({
          topic,
          content: content.substring(0, 2000), // Store first 2000 chars
          summary,
          lastUpdated: Date.now(),
        });

        summaries++;
        console.log(`✅ Ingested and summarized: ${file}`);
      } catch (error: any) {
        const errorMsg = `Failed to process ${file}: ${error.message}`;
        errors.push(errorMsg);
        console.error(`❌ ${errorMsg}`);
      }
    }

    return { success: true, summaries, errors };
  } catch (error: any) {
    console.error("❌ Error ingesting knowledge files:", error);
    return { success: false, summaries, errors: [error.message] };
  }
}

/**
 * Summarize text using OpenAI
 */
async function summarizeText(text: string): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that creates concise, informative summaries. Extract key points and important information.",
        },
        {
          role: "user",
          content: `Please summarize the following text, highlighting key concepts, facts, and actionable information:\n\n${text.substring(0, 8000)}`,
        },
      ],
      max_tokens: 500,
      temperature: 0.5,
    });

    return response.choices[0].message.content || "No summary available";
  } catch (error) {
    console.error("❌ Error summarizing text with OpenAI:", error);
    return "Error generating summary";
  }
}

// ========================================
// Learning Loop & Analysis
// ========================================

/**
 * Analyze feedback and conversation logs to generate learning insights
 */
export async function runLearningLoop(): Promise<LearningSummary> {
  const statusTimestamp = Date.now();
  const startedAt = new Date().toISOString();
  console.log("🔄 Running learning loop analysis...");

  // Create initial status entry
  const statusEntry: LearningStatus = {
    status: "running",
    feedbackCount: 0,
    startedAt,
  };
  await storeLearningStatus(statusEntry, statusTimestamp);

  try {
    // Gather data
    const [feedback, threadIds] = await Promise.all([
      getAllFeedback(),
      getAllThreadIds(),
    ]);

    // Calculate basic metrics
    const positiveCount = feedback.filter((f) => f.rating === "up").length;
    const negativeCount = feedback.filter((f) => f.rating === "down").length;

    // Sample recent conversations for analysis
    const recentThreadIds = threadIds.slice(0, 10); // Last 10 threads
    const conversationSamples: string[] = [];

    for (const threadId of recentThreadIds) {
      const messages = await getConversationHistory(threadId);
      if (messages.length > 0) {
        const sample = messages
          .slice(-3) // Last 3 exchanges
          .map((m) => `User: ${m.userMessage}\nVanessa: ${m.assistantResponse}`)
          .join("\n\n");
        conversationSamples.push(sample);
      }
    }

    // Gather negative feedback comments
    const negativeComments = feedback
      .filter((f) => f.rating === "down" && f.comment)
      .map((f) => f.comment)
      .slice(0, 20); // Last 20 negative comments

    // Use OpenAI to analyze patterns
    const analysis = await analyzeWithAI(
      conversationSamples.join("\n\n---\n\n"),
      negativeComments.join("\n- "),
      positiveCount,
      negativeCount
    );

    // Create learning summary
    const summaryTimestamp = Date.now();
    const summaryKey = `learning_summary:${summaryTimestamp}`;
    const summary: LearningSummary = {
      date: new Date().toISOString(),
      insights: analysis.insights,
      improvementAreas: analysis.improvementAreas,
      topPositiveTopics: analysis.topPositiveTopics,
      commonIssues: analysis.commonIssues,
      totalFeedback: feedback.length,
      positiveCount,
      negativeCount,
    };

    // Store the summary
    await storeLearningSummary(summary);

    // Auto-update knowledge base file
    await updateKnowledgeBase(summary);

    // Update status entry to success
    const completedAt = new Date().toISOString();
    await storeLearningStatus({
      status: "success",
      feedbackCount: feedback.length,
      summaryKey,
      startedAt,
      completedAt,
    }, statusTimestamp);

    // Update health metrics
    await calculateLearningHealth();

    console.log(`\n✅ Vanessa Learning Summary Updated (${new Date().toISOString()})`);
    console.log(`   📊 Analyzed ${feedback.length} feedback entries`);
    console.log(`   💡 Generated ${analysis.insights.length} insights`);
    
    return summary;
  } catch (error: any) {
    const completedAt = new Date().toISOString();
    const errorMessage = error.message || "Unknown error";
    
    console.error(`❌ Learning Failed: ${errorMessage}`);
    
    // Update status entry to failed
    await storeLearningStatus({
      status: "failed",
      feedbackCount: 0,
      startedAt,
      completedAt,
      error: errorMessage,
    }, statusTimestamp);

    // Update health metrics
    await calculateLearningHealth();
    
    // Return empty summary on error
    return {
      date: new Date().toISOString(),
      insights: [],
      improvementAreas: [],
      topPositiveTopics: [],
      commonIssues: [],
      totalFeedback: 0,
      positiveCount: 0,
      negativeCount: 0,
    };
  }
}

/**
 * Use OpenAI to analyze conversation patterns and feedback
 */
async function analyzeWithAI(
  conversations: string,
  negativeComments: string,
  positiveCount: number,
  negativeCount: number
): Promise<{
  insights: string[];
  improvementAreas: string[];
  topPositiveTopics: string[];
  commonIssues: string[];
}> {
  try {
    const prompt = `You are analyzing user interactions with Vanessa, an AI assistant for OnSpot Global.

FEEDBACK METRICS:
- Positive feedback: ${positiveCount}
- Negative feedback: ${negativeCount}

RECENT CONVERSATION SAMPLES:
${conversations.substring(0, 4000)}

NEGATIVE FEEDBACK COMMENTS:
${negativeComments.substring(0, 2000)}

Based on this data, provide analysis in the following JSON format:
{
  "insights": ["insight 1", "insight 2", ...],
  "improvementAreas": ["area 1", "area 2", ...],
  "topPositiveTopics": ["topic 1", "topic 2", ...],
  "commonIssues": ["issue 1", "issue 2", ...]
}

Focus on:
1. Patterns in user questions
2. Response quality and accuracy
3. Topics users find most helpful
4. Common pain points or confusion
5. Specific areas where responses could improve`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are an AI performance analyst. Provide structured JSON responses only.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const content = response.choices[0].message.content || "{}";
    const analysis = JSON.parse(content);

    return {
      insights: Array.isArray(analysis.insights) ? analysis.insights : [],
      improvementAreas: Array.isArray(analysis.improvementAreas) ? analysis.improvementAreas : [],
      topPositiveTopics: Array.isArray(analysis.topPositiveTopics) ? analysis.topPositiveTopics : [],
      commonIssues: Array.isArray(analysis.commonIssues) ? analysis.commonIssues : [],
    };
  } catch (error) {
    console.error("❌ Error analyzing with AI:", error);
    return {
      insights: [],
      improvementAreas: [],
      topPositiveTopics: [],
      commonIssues: [],
    };
  }
}

// ========================================
// Auto-Update Knowledge Base
// ========================================

/**
 * Extract main topics from learning summary using OpenAI
 */
async function extractTopicsFromSummary(summary: LearningSummary): Promise<string[]> {
  try {
    const summaryText = [
      ...summary.insights,
      ...summary.improvementAreas,
      ...summary.commonIssues
    ].join(" ");

    if (!summaryText.trim()) {
      return [];
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a topic extraction expert. Extract 1-3 main topics from the learning summary. Return JSON only.",
        },
        {
          role: "user",
          content: `Extract the main topics from this learning summary. Focus on concrete topics like "CEO Information", "Pricing Model", "Services", "Hiring Process", etc.

Summary:
${summaryText.substring(0, 2000)}

Return JSON: { "topics": ["Topic 1", "Topic 2", ...] }`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 150,
    });

    const content = response.choices[0].message.content || "{}";
    const result = JSON.parse(content);
    return Array.isArray(result.topics) ? result.topics : [];
  } catch (error) {
    console.error("❌ Error extracting topics:", error);
    return [];
  }
}

/**
 * Sanitize text to prevent injection attacks and clean special characters
 */
function sanitizeText(text: string): string {
  return text
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
    .trim();
}

/**
 * Update knowledge base file with new learning insights
 */
async function updateKnowledgeBase(summary: LearningSummary): Promise<void> {
  try {
    // Skip if no meaningful insights
    const hasInsights = summary.insights.length > 0 || 
                       summary.improvementAreas.length > 0 || 
                       summary.commonIssues.length > 0;
    
    if (!hasInsights) {
      console.log("⚠️ No new insights to add to knowledge base — skipping update");
      return;
    }

    // Extract topics
    const topics = await extractTopicsFromSummary(summary);
    if (topics.length === 0) {
      console.log("⚠️ No topics extracted from summary — skipping knowledge update");
      return;
    }

    // Read existing knowledge file
    let existingContent = "";
    if (fs.existsSync(KNOWLEDGE_FILE_PATH)) {
      existingContent = fs.readFileSync(KNOWLEDGE_FILE_PATH, "utf-8");
    }

    // Check file size limit
    if (existingContent.length >= MAX_FILE_SIZE) {
      console.error("⚠️ Knowledge file exceeds 1MB limit — skipping update");
      return;
    }

    // Build new knowledge sections as a Map (topic → section content)
    const timestamp = new Date().toISOString().split('T')[0];
    const topicSections = new Map<string, string>();

    for (const topic of topics) {
      const sanitizedTopic = sanitizeText(topic);
      const sectionHeader = `=== ${sanitizedTopic} (Learned ${timestamp}) ===`;
      
      const content: string[] = [];
      
      // Add relevant insights
      const relevantInsights = summary.insights.filter(i => 
        i.toLowerCase().includes(topic.toLowerCase().split(' ')[0])
      );
      if (relevantInsights.length > 0) {
        content.push("Insights:");
        relevantInsights.forEach(insight => {
          content.push(`- ${sanitizeText(insight)}`);
        });
      }
      
      // Add relevant improvement areas
      const relevantImprovements = summary.improvementAreas.filter(i => 
        i.toLowerCase().includes(topic.toLowerCase().split(' ')[0])
      );
      if (relevantImprovements.length > 0) {
        content.push("\nImprovement Areas:");
        relevantImprovements.forEach(area => {
          content.push(`- ${sanitizeText(area)}`);
        });
      }

      // Only add if there's content for this topic
      if (content.length > 0) {
        const sectionContent = `\n${sectionHeader}\n${content.join("\n")}\n`;
        topicSections.set(sanitizedTopic.toLowerCase(), sectionContent);
      }
    }

    if (topicSections.size === 0) {
      console.log("⚠️ No relevant content to add to knowledge base");
      return;
    }

    // Check if we should replace existing sections or append
    let updatedContent = existingContent;
    let updatedCount = 0;
    let appendedCount = 0;
    const processedTopics = new Set<string>();

    // Process each topic with its corresponding section
    for (const [topicKey, sectionContent] of Array.from(topicSections.entries())) {
      // Get the original topic name (not lowercased) for display
      const topic = topics.find(t => sanitizeText(t).toLowerCase() === topicKey);
      if (!topic) continue;
      
      const sanitizedTopic = sanitizeText(topic);
      
      // Check if a section header exists for this topic
      const headerRegex = new RegExp(
        `^===\\s*${sanitizedTopic.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^=]*===`,
        'im'
      );
      
      const hasHeader = headerRegex.test(updatedContent);
      
      if (hasHeader) {
        // Section exists - replace the entire section
        const sectionRegex = new RegExp(
          `(^===\\s*${sanitizedTopic.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^=]*===)([^]*?)(?=^===|$)`,
          'im'
        );
        
        updatedContent = updatedContent.replace(sectionRegex, sectionContent.trim());
        updatedCount++;
        processedTopics.add(topicKey);
        console.log(`✅ Updated existing section: ${sanitizedTopic}`);
      } else {
        // Section doesn't exist - append it
        updatedContent += sectionContent;
        appendedCount++;
        processedTopics.add(topicKey);
        console.log(`✅ Appended new section: ${sanitizedTopic}`);
      }
    }

    // Check final size
    if (updatedContent.length > MAX_FILE_SIZE) {
      console.error("⚠️ Updated content exceeds 1MB limit — skipping write");
      return;
    }

    // Write back to file
    fs.writeFileSync(KNOWLEDGE_FILE_PATH, updatedContent, "utf-8");
    
    console.log(`\n✅ Knowledge base updated successfully!`);
    console.log(`   📝 Updated sections: ${updatedCount}`);
    console.log(`   ➕ New sections: ${appendedCount}`);
    console.log(`   📁 Topics: ${topics.join(", ")}`);
    console.log(`   📊 File size: ${(updatedContent.length / 1024).toFixed(2)} KB`);
    
  } catch (error: any) {
    console.error(`❌ Error updating knowledge base: ${error.message}`);
  }
}
