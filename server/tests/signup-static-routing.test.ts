import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { mkdtemp, mkdir, readFile, writeFile, symlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { Server } from "node:http";
import express from "express";
import { build } from "esbuild";

let root: string, server: Server, base: string;
before(async () => {
  root = await mkdtemp(join(tmpdir(), "onspot-signup-static-"));
  await mkdir(join(root, "public"));
  // The real production static handler is exercised without starting application
  // auth, migrations, database jobs or any externally connected services.
  await writeFile(join(root, "public/index.html"), await readFile("client/index.html", "utf8"));
  await symlink(resolve("node_modules"), join(root, "node_modules"), "dir");
  const output = join(root, "static.mjs");
  await build({
    entryPoints: ["server/vite.ts"], outfile: output, bundle: true,
    platform: "node", format: "esm", packages: "external", target: "node22",
    plugins: [{ name: "isolated-static-dependencies", setup(builder) {
      builder.onResolve({ filter: /ogMiddleware$/ }, () => ({ path: "metadata", namespace: "static-fixture" }));
      builder.onResolve({ filter: /vite\.config$/ }, () => ({ path: "config", namespace: "static-fixture" }));
      builder.onLoad({ filter: /.*/, namespace: "static-fixture" }, ({ path }) => ({
        contents: path === "config" ? "export default {}" : `
          export async function resolveOGMeta(path,query) {
            if(query.metadataFailure) throw new Error("Owned fixture metadata failure");
            return { title:"OnSpot fixture" };
          }
          export function buildMetaTagsHtml() { return '<meta name="description" content="OnSpot fixture">'; }
          export function escapeHtml(value) { return String(value); }
          export function isCrawler() { return false; }
          export function getRequestOrigin() { return 'https://fixture.example'; }
        `,
      }));
    } }],
  });
  const { serveStatic } = await import(pathToFileURL(output).href);
  const app = express();
  serveStatic(app);
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>(done => server.once("listening", done));
  base = `http://127.0.0.1:${(server.address() as any).port}`;
});
after(async () => {
  if (server) await new Promise<void>(done => server.close(() => done()));
  if (root) await rm(root, { recursive: true, force: true });
});
for (const path of ["/portal", "/signup", "/signup/talent", "/signup/client", "/login", "/login/client", "/login/talent"]) {
  for (const failure of [false, true]) {
    test(`Production SPA shell serves ${path} for fresh visits and refreshes${failure ? " even if metadata is unavailable" : ""}`, async () => {
      for (let refresh = 0; refresh < 2; refresh++) {
        const response = await fetch(`${base}${path}?utm_source=email${failure ? "&metadataFailure=true" : ""}`);
        assert.equal(response.status, 200);
        assert.match(response.headers.get("content-type")!, /text\/html/);
        assert.match(await response.text(), /id="root"/);
      }
    });
  }
}
