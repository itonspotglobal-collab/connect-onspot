import {defineConfig} from "vitest/config";
import {fileURLToPath} from "node:url";

// Vitest's bundled Vite is newer than the application's Vite. Do not load
// app-only Replit plugins or the older React plugin in this isolated test runner.
export default defineConfig({
  resolve:{alias:{"@":fileURLToPath(new URL("./client/src",import.meta.url))}},
  oxc:{jsx:{runtime:"automatic"}},
  test:{environment:"node",include:["client/src/**/*.test.{ts,tsx}"],exclude:["**/*.browser.test.ts"]},
});
