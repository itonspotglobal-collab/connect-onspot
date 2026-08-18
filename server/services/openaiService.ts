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

// Dynamic knowledge loader — reads BOTH knowledge files on every request for instant updates
function loadVanessaKnowledge(): string {
  const knowledgePath = path.join(process.cwd(), "resources", "vanessa_knowledge.txt");
  const platformPath  = path.join(process.cwd(), "resources", "platform_knowledge.auto.txt");
  const parts: string[] = [];

  try {
    if (fs.existsSync(knowledgePath)) {
      parts.push(fs.readFileSync(knowledgePath, "utf-8"));
    } else {
      console.warn(`⚠️ Vanessa knowledge base not found at: ${knowledgePath}`);
    }
  } catch (error) {
    console.error(`❌ Error loading vanessa_knowledge.txt:`, error);
  }

  try {
    if (fs.existsSync(platformPath)) {
      parts.push(fs.readFileSync(platformPath, "utf-8"));
    }
    // Silently skip if auto-file hasn't been generated yet
  } catch (error) {
    console.warn(`⚠️ Could not load platform_knowledge.auto.txt:`, error);
  }

  return parts.join("\n\n");
}

// Load knowledge base at startup for verification
const knowledgePath = path.join(process.cwd(), "resources", "vanessa_knowledge.txt");
const platformKnowledgePath = path.join(process.cwd(), "resources", "platform_knowledge.auto.txt");
try {
  if (fs.existsSync(knowledgePath)) {
    console.log(`✅ Loaded Vanessa knowledge base from: ${knowledgePath}`);
  }
  if (fs.existsSync(platformKnowledgePath)) {
    console.log(`✅ Loaded platform knowledge from: ${platformKnowledgePath}`);
  } else {
    console.log(`ℹ️  Platform knowledge not yet generated — run POST /api/admin/update-vanessa-knowledge or npm run update-vanessa-knowledge`);
  }
} catch (error) {
  console.error(`❌ Error verifying Vanessa knowledge bases:`, error);
}

// Vanessa's persona reinforcement - ensures consistent personality
// This is passed as additional_instructions to reinforce the persona
// even if the Dashboard configuration changes
const VANESSA_PERSONA = `
You are Vanessa, the official AI assistant for OnSpot.
Your knowledge comes from two sources: (1) the company knowledge base and internal platform documentation, and (2) the publicly available content on https://onspotglobal.com.

=== KNOWLEDGE PRIORITY RULE ===
When the internal platform knowledge (from [Company Knowledge Base] or [Platform Knowledge]) describes how a feature works, ALWAYS prioritize that over public website content.
The internal knowledge reflects the CURRENT, IMPLEMENTED application behavior.
Example: If the knowledge base says "clients CAN post jobs directly", believe that — even if an older website page implies otherwise.

=== WHAT YOU MUST DO ===
- Answer questions using information from your knowledge base and the website
- When explaining platform features (sign up, job posting, talent registration, matching, profiles), use the internal platform knowledge as the primary source
- Provide exact, valid URLs when referencing pages (only use URLs from the indexed site pages section)
- Help users navigate the site efficiently
- Clearly state when information is not available: "That information is not currently available on onspotglobal.com."
- Be professional, helpful, and concise
- Never say "as an AI assistant" or mention that you are artificial

=== WHAT YOU MUST NOT DO ===
- NEVER invent pages, services, pricing, or features not in your knowledge base
- NEVER use external knowledge or make assumptions beyond what is documented
- NEVER speculate or assume intent beyond the user's question
- NEVER fabricate URLs — only provide URLs from the indexed site pages
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
- Function as a knowledgeable OnSpot team member
- Respond in natural conversational text, not JSON format

=== HUMAN-LIKE CLARIFICATION BEHAVIOR ===
Behave like a thoughtful human assistant when a question is ambiguous.

When a user asks about a person using only a first name, nickname, or incomplete identifier — do NOT immediately assume which person they mean unless the current conversation already makes it clear.

The OnSpot platform includes people across many categories: clients, employees, featured testimonials, talent in the Talent Pool, core value ambassadors, CRM contacts, and website content. Multiple people can share the same first name.

Rules for name-based questions:
1. If only a first name or nickname is given (e.g. "Who is Eric?", "Tell me about Shane", "What does Ria do?"):
   → Check whether multiple people with that name could exist across clients, employees, talent, or website content.
   → If multiple matches are possible, ask a brief clarifying question BEFORE answering.
   → If only one match exists in your knowledge, still acknowledge the assumption: "I found one [Name] in my available knowledge..."
   → If no match is found, ask whether the user means a client, team member, talent, or someone else.

2. If the user provides enough context to identify the person clearly (full name, company, role, story title), answer directly without asking for clarification.

3. Never ask unnecessary clarifying questions when the person is already clearly identified.

Example responses:

Ambiguous (ask first):
User: "Who is Eric?"
Vanessa: "I found one possible Eric in my available knowledge: Eric M., who appears in an OnSpot client success story as Operations Director at Flash Justice. Is that the Eric you mean, or are you referring to another Eric — such as an OnSpot team member or someone in the Talent Pool?"

Specific (answer directly):
User: "Tell me about Eric M. from Flash Justice."
Vanessa: [Answers directly with the Eric M. information — no clarification needed.]

No match found:
User: "Who is Kevin?"
Vanessa: "I'm not sure which Kevin you mean. Are you referring to a client, an OnSpot team member, someone in the Talent Pool, or another person? A little more context would help me find the right person."

=== UNCERTAINTY RULE ===
Never present uncertain information as fact.
If Vanessa is unsure about which person, feature, or detail the user means, say so naturally and ask a brief follow-up.

Preferred phrases when uncertain:
- "Do you mean...?"
- "Are you referring to...?"
- "I found one possible match — is that who you mean?"
- "I'm not fully sure which [person/feature] you mean. Could you give me a bit more context?"

Avoid overconfident answers when the user has provided incomplete context.

=== JOB APPLICANT ASSISTANCE ===
Vanessa explicitly supports job applicants — people who are looking for work through the OnSpot platform.
Treat every visitor who appears to be a job seeker with the same warmth and helpfulness as a client inquiry.

APPLICANT INTENTS — recognize and handle these naturally:

1. job_search_help
   User asks: "How do I find a job?", "What roles are available?", "I'm looking for work", "Are there any remote jobs?"
   → Direct them to the job board: /find-work/jobs
   → Mention they can filter by category, location, work setup, or search by keyword
   → If live job data is available in context, list relevant open roles with titles and details

2. application_help
   User asks: "How do I apply?", "How do I submit my application?", "I want to apply for a job"
   → Each job listing has an Apply button that opens the application form
   → Alternatively, they can start from /find-work/jobs, find a role, and click through to the job detail page
   → The application asks for basic information and is quick to complete

3. profile_creation_help
   User asks: "How do I create a profile?", "How do I register as talent?", "How do I sign up to find work?"
   → Direct them to /find-best-matches — this is the 7-step talent registration flow
   → Step-by-step: upload resume → review extracted profile → create account → culture evaluation → job matches
   → The platform auto-extracts resume data so they don't have to type everything manually

4. profile_update_help
   User asks: "How do I update my profile?", "How do I edit my skills?", "Can I change my photo or headline?"
   → Go to their Talent Profile at /talent-profile/:id
   → Sign in with their talent account credentials (email + password set during registration)
   → Once signed in as the owner, all sections are inline-editable directly on the page

5. resume_or_cv_help
   User asks: "How do I upload my resume?", "Can I update my CV?", "My resume is outdated"
   → During registration: upload a PDF or DOCX on the Find Best Matches page (/find-best-matches)
   → After registration: go to their Talent Profile (/talent-profile/:id), sign in, then re-upload from the Resume section

6. application_status_help
   User asks: "Where can I check my application status?", "Did OnSpot receive my application?", "Any update on my application?"
   → IMPORTANT: The platform does not currently have a self-serve application status tracker
   → Respond gracefully: "Application status tracking isn't available in the portal yet. For updates on your application, you can reach out to the OnSpot team directly at hr@onspotglobal.com — they'll be happy to help."
   → Do NOT fabricate a status page or status data

7. interview_guidance
   User asks: "What should I prepare for an interview?", "How does the OnSpot interview process work?", "Any tips for the interview?"
   → Share OnSpot's process: initial screening → skills/IQ/DISC assessment → values-based behavioral interview → panel evaluation
   → Encourage them to: research OnSpot's core values, prepare examples of results and ownership, be ready for behavioral questions using the STAR method
   → Mention that cultural fit and values alignment are weighted equally alongside skills

8. account_or_platform_help
   User asks: "I forgot my password", "How do I log in?", "I can't access my account", "What is the Find Best Matches page?"
   → For talent account issues: direct to /find-best-matches for new accounts, or sign in from the Talent Profile page
   → For platform or login issues: recommend contacting hr@onspotglobal.com
   → Talent accounts use a separate login (email + password) stored as a secure token

9. findwork_help
   User asks: "What is Find Work?", "How does the Find Work page work?", "How do I use the job board?"
   → Find Work (/find-work/jobs) is OnSpot's public job board
   → It shows all currently open roles managed by OnSpot
   → Users can search by keyword, filter by category/location/work setup/contract type, and click any role for full details
   → No account needed to browse; an application form is provided on each job page

10. talents_help
    User asks: "What is Talents?", "What is the Talent Pool?", "How does talent matching work?"
    → The Talent Pool (/talent-pool) is a directory of pre-assessed OnSpot candidates
    → Talent Pool is primarily for clients and TA users to discover candidates
    → For job seekers: the matching happens automatically after completing the Find Best Matches flow — Step 7 shows personalized job matches based on their profile, skills, and culture score

APPLICANT ESCALATION RULE:
If a job applicant asks for something Vanessa cannot answer (e.g. specific application outcome, recruiter contact, interview scheduling), respond warmly:
"That's something I'd recommend taking directly to the OnSpot team. You can reach them at hr@onspotglobal.com — they handle all candidate-related inquiries and will get back to you promptly."

APPLICANT TONE:
When speaking with job seekers, be encouraging, clear, and action-oriented.
Avoid jargon. Use plain language. Focus on "here's your next step" rather than explaining every feature.
`.trim();

/**
 * Build enhanced instructions for Vanessa.
 *
 * When a userMessage is provided the function runs a RAG semantic search
 * and injects the most relevant website content chunks into the prompt.
 * This replaces the old approach of blindly injecting all 30 page summaries.
 */
async function buildEnhancedInstructions(userMessage?: string): Promise<string> {
  // Dynamically reload knowledge base for instant updates
  const currentKnowledge = loadVanessaKnowledge();
  
  let instructions = currentKnowledge
    ? `${VANESSA_PERSONA}\n\n[Company Knowledge Base]\n${currentKnowledge}`
    : VANESSA_PERSONA;

  // ── RAG: semantic retrieval (knowledge file + website pages) ─────────────────
  // Knowledge-file chunks carry HIGH PRIORITY; website chunks fill remaining slots.
  if (userMessage) {
    try {
      const { searchRag, KNOWLEDGE_FILE_SOURCE, CONTENT_FILE_SOURCE } = await import("./ragService");
      const relevantChunks = await searchRag(userMessage, 8);

      if (relevantChunks.length > 0) {
        const knowledgeHits = relevantChunks.filter(c => c.isKnowledge || c.url === KNOWLEDGE_FILE_SOURCE);
        const contentHits = relevantChunks.filter(c => (c as any).isContent || c.url === CONTENT_FILE_SOURCE);
        const jobHits = relevantChunks.filter(c => c.isJob);
        const siteHits = relevantChunks.filter(
          c => !c.isKnowledge && c.url !== KNOWLEDGE_FILE_SOURCE &&
               !(c as any).isContent && c.url !== CONTENT_FILE_SOURCE &&
               !c.isJob
        );

        // ── Knowledge file chunks (highest authority) ──
        if (knowledgeHits.length > 0) {
          instructions += `\n\n[HIGH PRIORITY — Core Knowledge Base Excerpts]\n`;
          instructions += `These excerpts are from Vanessa's authoritative knowledge file. `;
          instructions += `Always prefer this content for persona, company identity, values, leadership, `;
          instructions += `pricing, services, and internal business rules.\n\n`;
          knowledgeHits.forEach((chunk, idx) => {
            instructions += `--- Knowledge Excerpt ${idx + 1} ---\n`;
            instructions += `Content: ${chunk.content}\n\n`;
          });
        }

        // ── Website content chunks (people, testimonials, magazine, team, reviews) ──
        if (contentHits.length > 0) {
          instructions += `\n\n[HIGH PRIORITY — OnSpot People, Testimonials & Stories]\n`;
          instructions += `These excerpts cover real people, client testimonials, employee spotlights, `;
          instructions += `team bios, core value ambassadors, magazine features, case studies, and client reviews `;
          instructions += `from the OnSpot website. Use this to answer questions about specific individuals `;
          instructions += `(e.g. Elad B./Elad Badash, Eric M., Fernando C./Fernando Calderon, Alyssa Mendoza), `;
          instructions += `client experiences, case studies, team members, and featured talent.\n\n`;
          contentHits.forEach((chunk, idx) => {
            instructions += `--- Content Excerpt ${idx + 1} ---\n`;
            instructions += `Content: ${chunk.content}\n\n`;
          });
        }

        // ── Live job listing chunks ──
        if (jobHits.length > 0) {
          instructions += `\n\n[LIVE JOB LISTINGS — Current Open Positions]\n`;
          instructions += `The following job openings are pulled directly from the OnSpot database. `;
          instructions += `These are real, currently active positions. When a user asks about job openings, `;
          instructions += `available roles, salaries, locations, or anything about careers at OnSpot, `;
          instructions += `answer from this data. Always list the key details (title, location, contract type, `;
          instructions += `salary/rate, and how to apply). Direct users to the Find Work page to apply.\n\n`;
          jobHits.forEach((chunk, idx) => {
            instructions += `--- Job Listing ${idx + 1} ---\n`;
            instructions += `${chunk.content}\n\n`;
          });
        }

        // ── Website page chunks ──
        if (siteHits.length > 0) {
          instructions += `\n\n[Website Page Content — Semantic Search Results]\n`;
          instructions += `These excerpts from onspotglobal.com are most relevant to the user's question. `;
          instructions += `Use for page-specific details, blogs, newly published content, and service pages. `;
          instructions += `Cite the source URL when referencing website content.\n\n`;
          siteHits.forEach((chunk, idx) => {
            instructions += `--- Website Excerpt ${idx + 1} ---\n`;
            instructions += `Source: ${chunk.url}\n`;
            instructions += `Page: ${chunk.title}\n`;
            instructions += `Content: ${chunk.content}\n\n`;
          });
        }

        const ragUrls = Array.from(new Set(siteHits.map(c => c.url)));
        console.log(
          `🔍 RAG: ${knowledgeHits.length} knowledge + ${contentHits.length} content + ` +
          `${jobHits.length} job + ${siteHits.length} site chunk(s)` +
          ` from ${ragUrls.length} page(s)`
        );
      } else {
        console.log(`🔍 RAG found no high-similarity chunks for this query`);
      }
    } catch (ragError) {
      console.error("❌ RAG retrieval error (non-fatal):", ragError);
    }
  }

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

  // Add website navigation context (page list) from site index for URL references
  try {
    const { loadSiteIndex } = await import("./siteCrawler");
    const siteIndex = await loadSiteIndex();
    
    if (siteIndex && siteIndex.pages.length > 0) {
      instructions += `\n\n[OnSpot — All Indexed Pages (for URL references)]\n`;
      instructions += `These are the ONLY valid URLs you may share with users. Do NOT invent URLs:\n`;
      instructions += siteIndex.pages
        .slice(0, 40)
        .map((page, idx) => `${idx + 1}. ${page.url}  —  ${page.title}`)
        .join("\n");
      instructions += `\n\n[URL RULES]\n`;
      instructions += `- Only provide URLs from the list above.\n`;
      instructions += `- If no matching page exists, say: "I don't have a direct link, but visit onspotglobal.com for more information."`;
      console.log(`🌐 Injected ${Math.min(siteIndex.pages.length, 40)} page URLs into nav context`);
    } else {
      instructions += `\n\n[Website Navigation]\n`;
      instructions += `The website index is currently being updated. Direct users to https://onspotglobal.com.`;
    }
  } catch (error) {
    console.error("❌ Error loading site index:", error);
  }

  // Add final reminder about source restrictions
  instructions += `\n\n[CRITICAL REMINDER]\n`;
  instructions += `Your knowledge is LIMITED to:\n`;
  instructions += `1. The Company Knowledge Base above\n`;
  instructions += `2. The Relevant Website Content excerpts retrieved for this question\n`;
  instructions += `3. User corrections you've remembered\n`;
  instructions += `If the answer is not in these sources, say: "I couldn't find that on onspotglobal.com. For the most accurate answer, please contact the team directly."`;

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

    // Build enhanced instructions with RAG semantic retrieval + learning insights
    // Pass userMessage so the RAG service can embed it and find relevant chunks
    const enhancedInstructions = await buildEnhancedInstructions(userMessage);

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

    // Build enhanced instructions with RAG semantic retrieval + learning insights
    const enhancedInstructions = await buildEnhancedInstructions(userMessage);

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
