/**
 * scripts/update-vanessa-knowledge.ts
 *
 * Standalone script — regenerates resources/platform_knowledge.auto.txt manually.
 *
 * Run with:
 *   npx tsx scripts/update-vanessa-knowledge.ts
 *   npm run update-vanessa-knowledge   (after package.json script is added)
 */

import { savePlatformKnowledge, validatePlatformKnowledge } from "../server/services/knowledgeBaseUpdater";

async function main() {
  console.log("════════════════════════════════════════════════");
  console.log("  Vanessa AI — Platform Knowledge Updater");
  console.log("════════════════════════════════════════════════\n");

  const result = await savePlatformKnowledge();

  if (!result.success) {
    console.error(`\n❌ Knowledge generation failed: ${result.error}`);
    process.exit(1);
  }

  const validation = validatePlatformKnowledge();

  console.log("\n── Validation Results ──────────────────────────");
  if (validation.valid) {
    console.log("✅ All required sections present");
    console.log("✅ No secrets or sensitive data detected");
  } else {
    console.error("❌ Validation failed:");
    for (const err of validation.errors) {
      console.error(`   • ${err}`);
    }
  }

  if (validation.warnings.length > 0) {
    console.warn("⚠️  Warnings:");
    for (const w of validation.warnings) {
      console.warn(`   • ${w}`);
    }
  }

  console.log("\n── Summary ─────────────────────────────────────");
  console.log(`📄 File saved: ${result.filePath}`);
  console.log(`🕐 Generated: ${result.timestamp}`);
  console.log("\n✅ Done. Vanessa's platform knowledge is up to date.");
  console.log("   Restart the server or call POST /api/admin/update-vanessa-knowledge for live reload.\n");
}

main().catch(err => {
  console.error("❌ Unexpected error:", err);
  process.exit(1);
});
