/**
 * Integration coverage for unread new_message notification grouping.
 *
 * The message route calls the same storage boundary for Client, main-JWT
 * Talent, and talent-portal sessions after authentication normalizes the
 * recipient to users.id. These tests exercise that shared persisted boundary.
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { query } from "../db.js";
import { storage } from "../storage.js";

const CLIENT_ID = "msg-group-client-user";
const TALENT_ID = "msg-group-talent-user";
const OTHER_TALENT_ID = "msg-group-other-talent";

async function unreadGroups(userId: string, threadId: string) {
  const result = await query(
    `SELECT id, type, title, message, message_count, is_read, related_id
       FROM notifications
      WHERE user_id = $1 AND related_id = $2
      ORDER BY created_at ASC`,
    [userId, threadId],
  );
  return result.rows;
}

describe("grouped new_message notifications", () => {
  before(async () => {
    await query(
      `ALTER TABLE notifications
       ADD COLUMN IF NOT EXISTS message_count integer NOT NULL DEFAULT 1`,
    );
    await query(
      `INSERT INTO users (id, email, role, first_name, last_name)
       VALUES
         ($1, 'msg-group-client@example.com', 'client', 'Group', 'Client'),
         ($2, 'msg-group-talent@example.com', 'talent', 'Group', 'Talent'),
         ($3, 'msg-group-other@example.com', 'talent', 'Other', 'Talent')
       ON CONFLICT (id) DO NOTHING`,
      [CLIENT_ID, TALENT_ID, OTHER_TALENT_ID],
    );
  });

  after(async () => {
    await query(
      `DELETE FROM notifications WHERE user_id = ANY($1::text[])`,
      [[CLIENT_ID, TALENT_ID, OTHER_TALENT_ID]],
    );
    await query(
      `DELETE FROM users WHERE id = ANY($1::text[])`,
      [[CLIENT_ID, TALENT_ID, OTHER_TALENT_ID]],
    );
  });

  it("creates one singular group and preserves the thread deep link", async () => {
    const threadId = "msg-group-single-thread";
    const notification = await storage.upsertMessageNotification({
      recipientId: TALENT_ID,
      threadId,
      senderName: "Group Client",
    });

    assert.equal(notification.type, "new_message");
    assert.equal(notification.relatedId, threadId);
    assert.equal(notification.relatedType, "message_thread");
    assert.equal(notification.messageCount, 1);
    assert.equal(notification.title, "New message from Group Client");
    assert.equal(notification.message, "Group Client sent you a new message.");
  });

  it("increments repeated messages in one unread thread group", async () => {
    const threadId = "msg-group-repeated-thread";
    await storage.upsertMessageNotification({
      recipientId: CLIENT_ID,
      threadId,
      senderName: "Group Talent",
    });
    await storage.upsertMessageNotification({
      recipientId: CLIENT_ID,
      threadId,
      senderName: "Group Talent",
    });
    await storage.upsertMessageNotification({
      recipientId: CLIENT_ID,
      threadId,
      senderName: "Group Talent",
    });

    const rows = await unreadGroups(CLIENT_ID, threadId);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].message_count, 3);
    assert.equal(rows[0].title, "3 new messages from Group Talent");
    assert.equal(rows[0].message, "Group Talent sent you 3 new messages.");
    assert.equal(rows[0].is_read, false);
  });

  it("consolidates legacy unread duplicates without changing read or unrelated alerts", async () => {
    const threadId = "msg-group-legacy-cleanup-thread";
    // The cleanup is intentionally global at startup. Normalize any rows left
    // by earlier local runs so this test's removal count is deterministic.
    await storage.consolidateUnreadMessageNotifications();
    await query(
      `INSERT INTO notifications
          (user_id, type, title, message, related_id, related_type, message_count, is_read)
       VALUES
         ($1, 'new_message', 'New message from Group Talent',
          'Group Talent sent you a new message.', $2, 'message_thread', 1, false),
         ($1, 'new_message', 'New message from Group Talent',
          'Group Talent sent you a new message.', $2, 'message_thread', 1, false),
         ($1, 'new_message', 'New message from Group Talent',
          'Group Talent sent you a new message.', $2, 'message_thread', 1, false),
         ($1, 'new_message', 'Read legacy alert',
          'This alert was already read.', $2, 'message_thread', 1, true),
         ($1, 'offer_received', 'Unrelated alert',
          'This is not a message alert.', $2, 'offer', 1, false)`,
      [CLIENT_ID, threadId],
    );

    assert.equal(await storage.consolidateUnreadMessageNotifications(), 2);

    const rows = await query(
      `SELECT type, title, message, message_count, is_read, related_id, related_type
         FROM notifications
        WHERE user_id = $1 AND related_id = $2
        ORDER BY type, is_read`,
      [CLIENT_ID, threadId],
    );
    assert.deepEqual(
      rows.rows,
      [
        {
          type: "new_message",
          title: "3 new messages from Group Talent",
          message: "Group Talent sent you 3 new messages.",
          message_count: 3,
          is_read: false,
          related_id: threadId,
          related_type: "message_thread",
        },
        {
          type: "new_message",
          title: "Read legacy alert",
          message: "This alert was already read.",
          message_count: 1,
          is_read: true,
          related_id: threadId,
          related_type: "message_thread",
        },
        {
          type: "offer_received",
          title: "Unrelated alert",
          message: "This is not a message alert.",
          message_count: 1,
          is_read: false,
          related_id: threadId,
          related_type: "offer",
        },
      ],
    );

    // Running the cleanup again must not delete, duplicate, or recount anything.
    assert.equal(await storage.consolidateUnreadMessageNotifications(), 0);
    const afterSecondRun = await query(
      `SELECT type, title, message, message_count, is_read
         FROM notifications
        WHERE user_id = $1 AND related_id = $2
        ORDER BY type, is_read`,
      [CLIENT_ID, threadId],
    );
    assert.deepEqual(afterSecondRun.rows, rows.rows.map((row) => ({
      type: row.type,
      title: row.title,
      message: row.message,
      message_count: row.message_count,
      is_read: row.is_read,
    })));
  });

  it("keeps separate threads and recipients independent", async () => {
    await storage.upsertMessageNotification({
      recipientId: CLIENT_ID,
      threadId: "msg-group-thread-a",
      senderName: "Group Talent",
    });
    await storage.upsertMessageNotification({
      recipientId: CLIENT_ID,
      threadId: "msg-group-thread-b",
      senderName: "Group Talent",
    });
    await storage.upsertMessageNotification({
      recipientId: TALENT_ID,
      threadId: "msg-group-thread-a",
      senderName: "Group Client",
    });

    assert.equal((await unreadGroups(CLIENT_ID, "msg-group-thread-a")).length, 1);
    assert.equal((await unreadGroups(CLIENT_ID, "msg-group-thread-b")).length, 1);
    assert.equal((await unreadGroups(TALENT_ID, "msg-group-thread-a")).length, 1);
  });

  it("starts a fresh group after the existing group is read", async () => {
    const threadId = "msg-group-read-thread";
    await storage.upsertMessageNotification({
      recipientId: TALENT_ID,
      threadId,
      senderName: "Group Client",
    });
    await storage.upsertMessageNotification({
      recipientId: TALENT_ID,
      threadId,
      senderName: "Group Client",
    });
    await storage.markMessageNotificationsAsRead(TALENT_ID, threadId);
    await storage.upsertMessageNotification({
      recipientId: TALENT_ID,
      threadId,
      senderName: "Group Client",
    });

    const rows = await unreadGroups(TALENT_ID, threadId);
    assert.equal(rows.length, 2);
    assert.deepEqual(
      rows.map((row) => ({ count: row.message_count, read: row.is_read })),
      [
        { count: 2, read: true },
        { count: 1, read: false },
      ],
    );
  });

  it("serializes concurrent sends into one accurate group", async () => {
    const threadId = "msg-group-concurrent-thread";
    await Promise.all(
      Array.from({ length: 12 }, () =>
        storage.upsertMessageNotification({
          recipientId: OTHER_TALENT_ID,
          threadId,
          senderName: "Group Client",
        }),
      ),
    );

    const rows = await unreadGroups(OTHER_TALENT_ID, threadId);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].message_count, 12);
  });

  it("leaves raw messages and numeric unread counts untouched", async () => {
    const threadId = "msg-group-message-state-thread";
    await query(
      `INSERT INTO message_threads (id, participants, subject)
       VALUES ($1, ARRAY[$2, $3]::text[], 'Message grouping test')`,
      [threadId, CLIENT_ID, TALENT_ID],
    );

    const contents = ["First message", "Second message", "Third message"];
    for (const content of contents) {
      const message = await storage.createMessage({
        threadId,
        senderId: CLIENT_ID,
        content,
      });
      await storage.upsertMessageNotification({
        recipientId: TALENT_ID,
        threadId,
        senderName: "Group Client",
        messageId: message.id,
      });
    }

    const persistedMessages = await query(
      `SELECT content
         FROM messages
        WHERE thread_id = $1
        ORDER BY created_at ASC, id ASC`,
      [threadId],
    );
    assert.deepEqual(
      persistedMessages.rows.map((row) => row.content),
      contents,
    );
    const thread = (await storage.listMessageThreadsByUserWithUnread(TALENT_ID))
      .find((candidate) => candidate.id === threadId);
    assert.equal(thread?.unreadCount, 3);
    assert.equal((await unreadGroups(TALENT_ID, threadId)).length, 1);

    await query(`DELETE FROM messages WHERE thread_id = $1`, [threadId]);
    await query(`DELETE FROM message_threads WHERE id = $1`, [threadId]);
  });

  it("does not recreate an alert for a message already marked read", async () => {
    const threadId = "msg-group-read-race-thread";
    await query(
      `INSERT INTO message_threads (id, participants, subject)
       VALUES ($1, ARRAY[$2, $3]::text[], 'Read race test')`,
      [threadId, CLIENT_ID, TALENT_ID],
    );
    const message = await storage.createMessage({
      threadId,
      senderId: CLIENT_ID,
      content: "This was read before the alert transaction completed.",
    });
    await storage.markMessagesAsRead(threadId, TALENT_ID);

    const notification = await storage.upsertMessageNotification({
      recipientId: TALENT_ID,
      threadId,
      senderName: "Group Client",
      messageId: message.id,
    });
    assert.equal(notification, undefined);
    assert.equal((await unreadGroups(TALENT_ID, threadId)).length, 0);

    await query(`DELETE FROM messages WHERE thread_id = $1`, [threadId]);
    await query(`DELETE FROM message_threads WHERE id = $1`, [threadId]);
  });

  it("does not combine unrelated notification types", async () => {
    const threadId = "msg-group-unrelated-thread";
    await storage.createNotification({
      userId: CLIENT_ID,
      type: "offer_received",
      title: "New offer",
      message: "A new offer is available.",
      relatedId: threadId,
      relatedType: "offer",
    });
    await storage.upsertMessageNotification({
      recipientId: CLIENT_ID,
      threadId,
      senderName: "Group Talent",
    });
    await storage.upsertMessageNotification({
      recipientId: CLIENT_ID,
      threadId,
      senderName: "Group Talent",
    });

    const rows = await query(
      `SELECT type, message_count
         FROM notifications
        WHERE user_id = $1 AND related_id = $2
        ORDER BY type`,
      [CLIENT_ID, threadId],
    );
    assert.deepEqual(
      rows.rows.map((row) => [row.type, row.message_count]),
      [
        ["new_message", 2],
        ["offer_received", 1],
      ],
    );
  });
});