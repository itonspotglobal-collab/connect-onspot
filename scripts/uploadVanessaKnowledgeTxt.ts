import OpenAI from "openai";
import fs from "fs";

async function uploadVanessaKnowledge() {
  console.log("🚀 Uploading Vanessa knowledge base...");

  if (!process.env.OPENAI_API_KEY) {
    console.error("❌ OPENAI_API_KEY not found in environment variables");
    process.exit(1);
  }

  if (!process.env.ASSISTANT_ID) {
    console.error("❌ ASSISTANT_ID not found in environment variables");
    process.exit(1);
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const ASSISTANT_ID = process.env.ASSISTANT_ID;

  try {
    // 1️⃣ Create a vector store
    console.log("📦 Creating vector store...");
    const vectorStore = await (openai.beta as any).vectorStores.create({
      name: "Vanessa Knowledge Text Store",
    });
    console.log(`✅ Vector store created: ${vectorStore.id}`);

    // 2️⃣ Upload the TXT file
    console.log("📄 Uploading knowledge file...");
    const file = fs.createReadStream("resources/vanessa_knowledge.txt");
    await (openai.beta as any).vectorStores.fileBatches.uploadAndPoll(vectorStore.id, {
      files: [file],
    });
    console.log("✅ Knowledge file uploaded successfully");

    // 3️⃣ Attach to the Assistant
    console.log("🔗 Attaching vector store to Assistant...");
    await openai.beta.assistants.update(ASSISTANT_ID, {
      instructions:
        "You are Vanessa, OnSpot's AI Assistant. Use the attached knowledge file for detailed company, HR, and framework information about OnSpot. Speak with warmth, confidence, and professionalism like a friendly HR specialist. Always represent OnSpot's core values: People-Centric, Integrity, Beat Yesterday, Efficiency, Extreme Ownership, and Intrapreneurial. Guide users to appropriate resources and provide clear, actionable information.",
      tools: [{ type: "file_search" }],
      tool_resources: { file_search: { vector_store_ids: [vectorStore.id] } },
    });

    console.log("✅ Vanessa knowledge base successfully linked!");
    console.log(`📊 Vector Store ID: ${vectorStore.id}`);
    console.log(`🤖 Assistant ID: ${ASSISTANT_ID}`);
  } catch (error) {
    console.error("❌ Error uploading knowledge base:", error);
    process.exit(1);
  }
}

uploadVanessaKnowledge().catch(console.error);
