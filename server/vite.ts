import express, { type Express, type Request, type Response } from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config";
import { nanoid } from "nanoid";
import { resolveOGMeta, buildMetaTagsHtml, escapeHtml, isCrawler, type OGMeta } from "./ogMiddleware";

const viteLogger = createLogger();

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );

      // In dev mode, inject route-specific metadata for crawler User-Agents so
      // that testing against the dev URL produces the same metadata a crawler
      // would see in production.  Regular browsers are unaffected.
      if (isCrawler(req)) {
        try {
          const meta = await resolveOGMeta(
            req.path,
            req.query as Record<string, string>,
          );
          template = injectMetadataIntoHtml(template, meta);
        } catch {
          // Non-fatal — fall through and serve the unmodified template
        }
      }

      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

/**
 * Strip and re-inject server-resolved Open Graph / Twitter metadata into the
 * SPA HTML shell.  This runs for every page request in production so that
 * social crawlers (including unrecognised ones that bypass ogMiddleware's bot
 * detection) always receive correct metadata without executing JavaScript.
 */
function injectMetadataIntoHtml(html: string, meta: OGMeta): string {
  let result = html;

  // 1. Replace <title> content in-place
  result = result.replace(
    /<title>[^<]*<\/title>/i,
    `<title>${escapeHtml(meta.title)}</title>`,
  );

  // 2. Strip tags we will re-inject (handles inline single-line attribute format)
  result = result
    .replace(/[ \t]*<meta[^>]+name="title"[^>]*\/?>\n?/gi, "")
    .replace(/[ \t]*<meta[^>]+name="description"[^>]*\/?>\n?/gi, "")
    .replace(/[ \t]*<link[^>]+rel="canonical"[^>]*\/?>\n?/gi, "")
    .replace(/[ \t]*<meta[^>]+property="og:[^"]*"[^>]*\/?>\n?/gi, "")
    .replace(/[ \t]*<meta[^>]+name="twitter:[^"]*"[^>]*\/?>\n?/gi, "");

  // 3. Inject resolved metadata block immediately before </head>
  const injection = buildMetaTagsHtml(meta);
  result = result.replace("</head>", `${injection}\n  </head>`);

  return result;
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(import.meta.dirname, "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  // Serve all static assets (JS, CSS, images, fonts) but NOT index.html
  // automatically — we handle index.html in the catch-all below so we can
  // inject per-route metadata before the response is sent.
  app.use(express.static(distPath, { index: false }));

  // Catch-all: resolve metadata for the requested route, inject it into the
  // SPA shell, and return the modified HTML.  This ensures every page —
  // regardless of User-Agent — carries correct Open Graph and Twitter tags in
  // the raw HTTP response, with no JavaScript execution required.
  app.use("*", async (req: Request, res: Response) => {
    try {
      const htmlPath = path.resolve(distPath, "index.html");
      const rawHtml = fs.readFileSync(htmlPath, "utf-8");

      const meta = await resolveOGMeta(
        req.path,
        req.query as Record<string, string>,
      );

      const html = injectMetadataIntoHtml(rawHtml, meta);

      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, must-revalidate");
      res.status(200).send(html);
    } catch (err) {
      console.error("[serveStatic] Metadata injection failed:", err);
      // Hard fallback: serve the static file without injection
      res.sendFile(path.resolve(distPath, "index.html"));
    }
  });
}
