import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { constants } from "node:os";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { getHeapStatistics } from "node:v8";

const mb = bytes => `${Math.round(Number(bytes) / 1024 / 1024)} MiB`;

async function resourceSummary() {
  // These are resource counters only. Never print environment variables/secrets.
  const readCounter = async name => {
    try {
      return (await readFile(`/sys/fs/cgroup/${name}`, "utf8")).trim();
    } catch {
      return null; // cgroup v2 counters are not available on every build worker.
    }
  };
  const [current, limit, events] = await Promise.all([
    readCounter("memory.current"), readCounter("memory.max"), readCounter("memory.events"),
  ]);
  const fields = [`runner RSS=${mb(process.memoryUsage().rss)}`];
  if (current) fields.push(`container memory=${mb(current)}`);
  if (limit) fields.push(`container limit=${limit === "max" ? "unlimited" : mb(limit)}`);
  const oomKills = events?.match(/^oom_kill\s+(\d+)$/m)?.[1];
  if (oomKills !== undefined) fields.push(`container cumulative OOM kills=${oomKills}`);
  return fields.join(", ");
}

/** Keep commands unchanged; report failures before allowing a later stage to run. */
export async function runStages(stages, {
  log = console.log,
  heartbeatMs = 15_000,
  resources = resourceSummary,
} = {}) {
  for (const [index, stage] of stages.entries()) {
    const started = performance.now();
    const prefix = `[build ${index + 1}/${stages.length}: ${stage.name}]`;
    log(`${prefix} START`);
    const heartbeat = heartbeatMs > 0 ? setInterval(() => {
      void resources().then(summary => log(
        `${prefix} still running (${Math.round((performance.now() - started) / 1000)}s); ${summary}`,
      )).catch(() => log(`${prefix} still running; resource counters unavailable`));
    }, heartbeatMs) : null;
    heartbeat?.unref();

    const result = await new Promise(done => {
      const child = spawn(stage.command, stage.args, { stdio: "inherit" });
      const interrupt = signal => child.kill(signal);
      const onInt = () => interrupt("SIGINT");
      const onTerm = () => interrupt("SIGTERM");
      process.on("SIGINT", onInt);
      process.on("SIGTERM", onTerm);
      const cleanup = () => {
        if (heartbeat) clearInterval(heartbeat);
        process.off("SIGINT", onInt);
        process.off("SIGTERM", onTerm);
      };
      child.once("error", error => {
        cleanup();
        done({ code: error.code === "ENOENT" ? 127 : 1, signal: null, error });
      });
      child.once("close", (code, signal) => {
        cleanup();
        done({ code, signal });
      });
    });
    const elapsed = ((performance.now() - started) / 1000).toFixed(1);
    if (result.code !== 0 || result.signal) {
      log(`${prefix} FAILED after ${elapsed}s; exit code=${result.code ?? "none"}; signal=${result.signal ?? "none"}`);
      if (result.error) log(`${prefix} could not start: ${result.error.message}`);
      log(`${prefix} ${await resources()}`);
      if (result.signal === "SIGKILL" || result.code === 137) {
        log(`${prefix} process was killed; memory exhaustion is possible but is not established by the exit status alone.`);
      }
      return result.code ?? (128 + (constants.signals[result.signal] ?? 1));
    }
    log(`${prefix} OK (${elapsed}s)`);
  }
  log("[build] All stages completed successfully.");
  return 0;
}

async function main() {
  const started = performance.now();
  console.log(`[build] Node ${process.version}; runner V8 heap limit=${mb(getHeapStatistics().heap_size_limit)}`);
  console.log(`[build] ${await resourceSummary()}`);
  // Same build tools, arguments, sequence and output locations as before.
  // In particular, this never starts the application or executes migrations.
  process.exitCode = await runStages([
    { name: "Vite frontend", command: process.execPath, args: [resolve("node_modules/vite/bin/vite.js"), "build"] },
    { name: "Server bundle", command: resolve("node_modules/.bin/esbuild"), args: ["server/index.ts", "--platform=node", "--packages=external", "--bundle", "--format=esm", "--outdir=dist"] },
    { name: "Migration runner bundle", command: resolve("node_modules/.bin/esbuild"), args: ["scripts/run-migrations.ts", "--platform=node", "--packages=external", "--bundle", "--format=esm", "--outfile=dist/run-migrations.js"] },
    { name: "Copy migration reconciliation SQL", command: "cp", args: ["scripts/migration-reconciliation.sql", "dist/migration-reconciliation.sql"] },
  ]);
  console.log(`[build] Finished in ${((performance.now() - started) / 1000).toFixed(1)}s; exit code=${process.exitCode}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main();
}
