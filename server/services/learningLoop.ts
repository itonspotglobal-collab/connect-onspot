import OpenAI from "openai";
import fs from "fs";
import path from "path";
import {
  getAllFeedback,
  getConversationHistory,
  getAllThreadIds,
  storeLearningSummary,
  storeKnowledgeSummary,
  type LearningSummary,
  type KnowledgeSummary,
} from "./db_manager";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
  console.log("🔄 Running learning loop analysis...");

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

    console.log(`✅ Learning loop completed. Insights: ${analysis.insights.length}`);
    return summary;
  } catch (error) {
    console.error("❌ Error running learning loop:", error);
    
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
