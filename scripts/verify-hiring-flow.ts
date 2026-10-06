/**
 * Bundle the real services against native, disposable PostgreSQL, not Neon or
 * application startup. Only the external Graph HTTP boundary is simulated.
 * Initialize this database from shared/schema.ts before running this command.
 */
import { build } from "esbuild";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

if (!process.env.HIRING_FLOW_TEST_DATABASE_URL) throw new Error("Provide HIRING_FLOW_TEST_DATABASE_URL for the disposable local fixture");
const directory = await mkdtemp(path.join(tmpdir(), "onspot-hiring-bundle-"));
const output = path.join(directory, "hiring-fixture.mjs");
await build({
  entryPoints: ["server/tests/hiring-flow.fixture.ts"],
  outfile: output, bundle: true, platform: "node", format: "esm",
  packages: "external", target: "node20",
  plugins: [{
    name: "disposable-native-database",
    setup(builder) {
      builder.onResolve({ filter: /(?:^|\/)db(?:\.[jt]s)?$/ }, args => {
        const resolved = path.resolve(args.resolveDir, args.path.replace(/\.[jt]s$/, ""));
        if (resolved === path.resolve("server/db")) return { path: path.resolve("server/tests/fixtures/hiring-db.ts") };
        return undefined;
      });
    },
  }],
});
// Resolve external workspace packages from this temporary bundle.
const { symlink } = await import("node:fs/promises");
await symlink(path.resolve("node_modules"), path.join(directory, "node_modules"), "dir");
await import(pathToFileURL(output).href);
