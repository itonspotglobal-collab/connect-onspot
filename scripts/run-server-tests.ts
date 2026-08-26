/**
 * Run the complete server test suite with an isolated instance of the
 * application server.
 *
 * The HTTP integration tests exercise the real route, so they need the same
 * server initialization as the development workflow. Keeping that lifecycle
 * here makes `npm test` self-contained for local shells and CI.
 */

import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { once } from "node:events";
import { readdirSync } from "node:fs";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const serverEntryPoint = path.join(projectRoot, "server", "index.ts");
const serverTestsDirectory = path.join(projectRoot, "server", "tests");
const tsxCommand = path.join(
  projectRoot,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "tsx.cmd" : "tsx",
);

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function findAvailablePort(): Promise<number> {
  const probe = createServer();

  return new Promise((resolve, reject) => {
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      if (!address || typeof address === "string") {
        probe.close();
        reject(new Error("Could not determine an available test-server port"));
        return;
      }

      probe.close((closeError) => {
        if (closeError) {
          reject(closeError);
        } else {
          resolve(address.port);
        }
      });
    });
  });
}

function serverTestFiles(): string[] {
  return readdirSync(serverTestsDirectory)
    .filter((fileName) => fileName.endsWith(".test.ts"))
    .sort()
    .map((fileName) => path.join(serverTestsDirectory, fileName));
}

async function waitForApplicationReady(
  child: ChildProcess,
  baseUrl: string,
  timeoutMilliseconds = 120_000,
): Promise<void> {
  const startTime = Date.now();
  let lastError: unknown;

  let onChildExit:
    | ((code: number | null, signal: NodeJS.Signals | null) => void)
    | undefined;
  const childExited = new Promise<never>((_resolve, reject) => {
    onChildExit = (code, signal) => {
      reject(
        new Error(
          `Test server exited before becoming ready (code=${code ?? "none"}, signal=${signal ?? "none"})`,
        ),
      );
    };
    child.once("exit", onChildExit);
  });

  let stoppedWaiting = false;
  const poll = async (): Promise<void> => {
    if (stoppedWaiting) return;
    if (Date.now() - startTime >= timeoutMilliseconds) {
      const details = lastError instanceof Error ? `: ${lastError.message}` : "";
      throw new Error(`Timed out waiting for test server at ${baseUrl}${details}`);
    }

    try {
      const response = await fetch(`${baseUrl}/`, {
        signal: AbortSignal.timeout(2_000),
      });
      const body = await response.text();

      // server/index.ts responds with "Starting application…" while its
      // database migrations and route registration are still in progress.
      if (response.ok && !body.includes("Starting application")) {
        return;
      }
    } catch (error) {
      lastError = error;
    }

    await delay(250);
    if (stoppedWaiting) return;
    return poll();
  };

  try {
    await Promise.race([poll(), childExited]);
  } finally {
    stoppedWaiting = true;
    if (onChildExit) child.off("exit", onChildExit);
  }
}

async function stopChild(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;

  const exited = once(child, "exit");
  child.kill("SIGTERM");
  await Promise.race([exited, delay(10_000)]);

  if (child.exitCode === null && child.signalCode === null) {
    child.kill("SIGKILL");
    await Promise.race([once(child, "exit"), delay(2_000)]);
  }
}

async function main(): Promise<void> {
  const port = await findAvailablePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const serverEnvironment = {
    ...process.env,
    NODE_ENV: "development",
    PORT: String(port),
  };

  console.log(`Starting isolated test server on ${baseUrl}`);
  const serverProcess = spawn(tsxCommand, [serverEntryPoint], {
    cwd: projectRoot,
    env: serverEnvironment,
    stdio: "inherit",
  });

  let testProcess: ChildProcess | undefined;
  try {
    await waitForApplicationReady(serverProcess, baseUrl);

    testProcess = spawn(
      tsxCommand,
      ["--test", "--test-concurrency=1", "--experimental-test-module-mocks", ...serverTestFiles()],
      {
        cwd: projectRoot,
        env: {
          ...serverEnvironment,
          TEST_SERVER_URL: baseUrl,
        },
        stdio: "inherit",
      },
    );

    const [testExitCode, testSignal] = (await once(testProcess, "exit")) as [
      number | null,
      NodeJS.Signals | null,
    ];
    if (testSignal) {
      process.exitCode = 1;
    } else {
      process.exitCode = testExitCode ?? 1;
    }
  } finally {
    if (testProcess && testProcess.exitCode === null && testProcess.signalCode === null) {
      testProcess.kill("SIGTERM");
    }
    await stopChild(serverProcess);
  }
}

main().catch(async (error) => {
  console.error(error);
  process.exitCode = 1;
});