import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { ChildProcess, spawn } from "node:child_process";
import { once } from "node:events";
import { chromium, Browser, Locator, Page, Route } from "playwright";

const PORT = Number(process.env.BROWSER_TEST_PORT ?? 5173);
const BASE_URL = process.env.BROWSER_BASE_URL ?? `http://127.0.0.1:${PORT}`;
const THREAD_ID = "thread-message-regression";

type SessionKind = "client" | "main-talent" | "talent-portal";

interface FixtureState {
  kind: SessionKind;
  userId: string;
  unreadMessages: number;
  notificationRead: boolean;
  includeClientApplicationNotification: boolean;
  clientApplicationNotificationRead: boolean;
  markReadCalls: number;
  notificationReadCalls: number;
}

let browser: Browser;
let vite: ChildProcess | undefined;

function candidateToken(): string {
  const encode = (value: object) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return [
    encode({ alg: "none", typ: "JWT" }),
    encode({
      type: "candidate",
      candidateId: "candidate-message-regression",
      email: "talent-message-regression@example.test",
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
    "test-signature",
  ].join(".");
}

async function waitForUrl(url: string, timeoutMs = 15_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok || response.status === 404) return;
    } catch {
      // Vite is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function waitForText(
  target: Page | Locator,
  text: string | RegExp,
): Promise<void> {
  await target.getByText(text).first().waitFor({ state: "visible", timeout: 10_000 });
}

async function waitForCount(
  locator: ReturnType<Page["locator"]>,
  expected: number,
): Promise<void> {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (await locator.count() === expected) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.equal(await locator.count(), expected);
}

async function fulfillJson(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

function threadResponse(state: FixtureState) {
  return {
    userId: state.userId,
    threads: [
      {
        id: THREAD_ID,
        jobId: "job-message-regression",
        participants: [state.userId, "other-message-user"],
        subject: "Message regression coverage",
        lastMessageAt: "2026-08-20T12:00:00.000Z",
        latestMessageAt: "2026-08-20T12:00:00.000Z",
        unreadCount: state.unreadMessages,
        createdAt: "2026-08-20T11:00:00.000Z",
      },
    ],
    participantNames: { "other-message-user": "Message Partner" },
    unreadMessageCount: state.unreadMessages,
  };
}

function notificationResponse(state: FixtureState) {
  const notifications = [
    {
      id: `notification-${state.kind}`,
      type: "new_message",
      title: "New message",
      message: "You have a new message from Message Partner.",
      relatedId: THREAD_ID,
      relatedType: "message_thread",
      isRead: state.notificationRead,
      createdAt: "2026-08-20T12:01:00.000Z",
    },
  ];
  if (state.includeClientApplicationNotification) {
    notifications.push({
      id: "notification-client-application",
      type: "client_application_status_changed",
      title: "Client updated application",
      message: "A Client updated an application's status.",
      relatedId: "application-message-regression",
      relatedType: "job_submission",
      isRead: state.clientApplicationNotificationRead,
      createdAt: "2026-08-20T12:02:00.000Z",
    });
  }
  return notifications;
}

async function routeApi(route: Route, state: FixtureState): Promise<void> {
  const request = route.request();
  const url = new URL(request.url());
  const path = url.pathname;

  if (path === "/api/profiles/me") {
    return fulfillJson(route, {
      success: true,
      profile: {
        userId: state.userId,
        firstName: "Portal",
        lastName: "Talent",
      },
    });
  }

  if (path === "/api/me/message-threads") {
    return fulfillJson(route, threadResponse(state));
  }

  if (path === `/api/message-threads/${THREAD_ID}/messages`) {
    return fulfillJson(route, [
      {
        id: "system-message",
        threadId: THREAD_ID,
        senderId: "system",
        content: "Conversation started from an accepted invitation.",
        messageType: "system",
        readBy: [],
        createdAt: "2026-08-20T11:00:00.000Z",
      },
      {
        id: "delivered-message",
        threadId: THREAD_ID,
        senderId: state.userId,
        content: "Delivered reply",
        messageType: "user",
        readBy: [],
        createdAt: "2026-08-20T11:30:00.000Z",
      },
      {
        id: "read-message",
        threadId: THREAD_ID,
        senderId: state.userId,
        content: "Read reply",
        messageType: "user",
        readBy: ["other-message-user"],
        createdAt: "2026-08-20T12:00:00.000Z",
      },
    ]);
  }

  if (
    request.method() === "POST" &&
    path === `/api/message-threads/${THREAD_ID}/mark-read`
  ) {
    state.unreadMessages = 0;
    state.notificationRead = true;
    state.markReadCalls += 1;
    return route.fulfill({ status: 204 });
  }

  const notificationPath =
    state.kind === "talent-portal"
      ? "/api/talent/notifications"
      : `/api/users/${state.userId}/notifications`;
  if (path === notificationPath && request.method() === "GET") {
    return fulfillJson(route, notificationResponse(state));
  }

  if (
    request.method() === "PATCH" &&
    (path === `/api/notifications/notification-${state.kind}/read` ||
      path === "/api/notifications/notification-client-application/read" ||
      path === `/api/talent/notifications/notification-${state.kind}/read`)
  ) {
    if (path === "/api/notifications/notification-client-application/read") {
      state.clientApplicationNotificationRead = true;
    } else {
      state.notificationRead = true;
    }
    state.notificationReadCalls += 1;
    return fulfillJson(route, {});
  }

  await route.continue();
}

async function newSession(
  kind: SessionKind,
  includeClientApplicationNotification = false,
): Promise<{ page: Page; state: FixtureState }> {
  const state: FixtureState = {
    kind,
    userId:
      kind === "client"
        ? "client-message-regression"
        : kind === "main-talent"
          ? "main-talent-message-regression"
          : "portal-talent-message-regression",
    unreadMessages: 2,
    notificationRead: false,
    includeClientApplicationNotification,
    clientApplicationNotificationRead: false,
    markReadCalls: 0,
    notificationReadCalls: 0,
  };
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  await page.route("**/api/**", (route) => routeApi(route, state));

  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ({ kind, userId, token }) => {
      localStorage.clear();
      if (kind === "talent-portal") {
        localStorage.setItem(
          "talent_profile_token",
          JSON.stringify({
            token,
            candidateId: "candidate-message-regression",
            email: "talent-message-regression@example.test",
            fullName: "Portal Talent",
          }),
        );
      } else {
        localStorage.setItem("onspot_jwt_token", `test-${kind}-jwt`);
        localStorage.setItem(
          "onspot_user",
          JSON.stringify({
            id: userId,
            email: `${kind}@example.test`,
            first_name: kind === "client" ? "Client" : "Main",
            last_name: "Message Regression",
            role: kind === "client" ? "client" : "talent",
          }),
        );
      }
    },
    { kind, userId: state.userId, token: candidateToken() },
  );
  await page.goto(`${BASE_URL}/messages`, { waitUntil: "domcontentloaded" });
  return { page, state };
}

async function assertMessageFlow(kind: SessionKind): Promise<void> {
  const { page, state } = await newSession(kind);
  try {
    await waitForText(page, "Messages");
    await waitForText(
      page.getByTestId(`thread-item-${THREAD_ID}`),
      "2",
    );
    await waitForText(
      page.getByTestId("notification-bell").locator("span.bg-red-500"),
      "1",
    );

    if (kind === "client") {
      const navBadge = page.getByTestId("nav-messages").locator("span.bg-red-500");
      await waitForText(navBadge, "2");
      await page.getByTestId("notification-bell").click();
      await page.getByTestId(`notification-notification-${kind}`).click();
    } else {
      await page.getByTestId("notification-bell").click();
      await page.getByTestId(`notification-notification-${kind}`).click();
    }

    assert.match(page.url(), new RegExp(`/messages/${THREAD_ID}$`));
    await waitForText(page, "Conversation started from an accepted invitation.");
    await waitForText(page, "Delivered");
    await waitForText(page, "Read");
    assert.doesNotMatch(
      (await page.getByText("Conversation started from an accepted invitation.").textContent()) ?? "",
      /Delivered|Read/,
      "system messages must not show delivery labels",
    );

    await page.waitForTimeout(250);
    assert.ok(state.markReadCalls > 0, "opening a thread should persist mark-read");
    assert.ok(
      state.notificationReadCalls > 0,
      "notification deep-link should persist notification read state",
    );

    await page.goto(`${BASE_URL}/messages`, { waitUntil: "domcontentloaded" });
    if (kind === "client") {
      await waitForCount(page.getByTestId("nav-messages").locator("span.bg-red-500"), 0);
    }
    await waitForCount(page.locator(`.bg-red-500`), 0);

    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForText(page, "Messages");
    await waitForCount(page.locator(`.bg-red-500`), 0);
    await waitForText(page.getByTestId(`thread-item-${THREAD_ID}`), "Message Partner");
    await page.getByTestId(`thread-item-${THREAD_ID}`).click();
    await waitForText(page, "Delivered reply");
    await waitForText(page, "Read reply");
    assert.doesNotMatch(
      (await page.getByText("Conversation started from an accepted invitation.").textContent()) ?? "",
      /Delivered|Read/,
      "system messages must remain unlabeled after refresh",
    );
  } finally {
    await page.context().close();
  }
}

before(async () => {
  if (!process.env.BROWSER_BASE_URL) {
    const viteEnv = { ...process.env };
    delete viteEnv.REPL_ID;
    vite = spawn(
      process.execPath,
      ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", String(PORT)],
      { stdio: "pipe", env: { ...viteEnv, NODE_ENV: "development" } },
    );
    vite.stderr?.on("data", (chunk) => process.stderr.write(chunk));
    await waitForUrl(BASE_URL);
  }
  const launchOptions = process.env.PLAYWRIGHT_EXECUTABLE_PATH
    ? { headless: true, executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
    : { headless: true };
  browser = await chromium.launch(launchOptions);
});

after(async () => {
  await browser?.close();
  if (vite && !vite.killed) {
    vite.kill("SIGTERM");
    await Promise.race([once(vite, "exit"), new Promise((resolve) => setTimeout(resolve, 2_000))]);
  }
});

test("message badges and read state work across every sign-in path", async () => {
  for (const kind of ["client", "main-talent", "talent-portal"] as SessionKind[]) {
    await assertMessageFlow(kind);
  }
});

test("client application status notifications link to the admin applications view", async () => {
  const { page, state } = await newSession("client", true);
  try {
    await waitForText(page, "Messages");
    await page.getByTestId("notification-bell").click();
    await page.getByTestId("notification-notification-client-application").click();
    assert.match(page.url(), /\/admin\/job-applications$/);
    await page.waitForTimeout(250);
    assert.ok(
      state.notificationReadCalls > 0,
      "client application status notification should persist its read state",
    );
  } finally {
    await page.context().close();
  }
});