import assert from "node:assert/strict";
import { test } from "node:test";
import { runStages } from "./build.mjs";

const stage = (name, code) => ({ name, command: process.execPath, args: ["-e", code] });
const options = log => ({ log: message => log.push(message), heartbeatMs: 0, resources: async () => "test resource counters" });

test("Build stages complete in order and explicitly report success", async () => {
  const log = [];
  assert.equal(await runStages([stage("frontend", ""), stage("backend", "")], options(log)), 0);
  assert.match(log[0], /frontend.*START/);
  assert.match(log[1], /frontend.*OK/);
  assert.match(log[2], /backend.*START/);
  assert.match(log.at(-1), /All stages completed successfully/);
});

test("A failing build stage preserves its exit code and stops later stages", async () => {
  const log = [];
  assert.equal(await runStages([
    stage("frontend", "process.exit(42)"), stage("must not run", ""),
  ], options(log)), 42);
  assert.ok(log.some(message => /frontend.*FAILED.*exit code=42/.test(message)));
  assert.ok(!log.some(message => message.includes("must not run")));
});

test("A terminated process reports its signal and returns a nonzero status", async () => {
  const log = [];
  assert.equal(await runStages([stage("frontend", 'process.kill(process.pid, "SIGKILL")')], options(log)), 137);
  assert.ok(log.some(message => /signal=SIGKILL/.test(message)));
  assert.ok(log.some(message => /not established/.test(message)));
});

test("A missing build executable fails clearly rather than proceeding", async () => {
  const log = [];
  assert.equal(await runStages([{
    name: "missing tool", command: "/nonexistent-onspot-build-tool", args: [],
  }, stage("must not run", "")], options(log)), 127);
  assert.ok(log.some(message => /could not start/.test(message)));
  assert.ok(!log.some(message => message.includes("must not run")));
});

test("A long-running stage reports progress without dumping its environment", async () => {
  const log = [];
  const code = await runStages([stage("frontend", "setTimeout(() => {}, 100)")], {
    ...options(log), heartbeatMs: 15,
  });
  assert.equal(code, 0);
  assert.ok(log.some(message => /still running.*test resource counters/.test(message)));
});
