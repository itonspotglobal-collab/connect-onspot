---
name: Messaging system
description: How the in-platform client↔talent messaging works, what was built, and key constraints.
---

## Architecture

Tables: `message_threads` (id, jobId, contractId, participants: text[], subject, lastMessageAt, createdAt) and `messages` (id, threadId, senderId, content, attachments, messageType, readBy: text[], createdAt).

Thread creation: auto-triggered when talent accepts an invitation via `POST /api/talent/invitations/:id/respond` with `action='accept'`. The accept handler fetches `client_id` and `job_id` from the submission, checks for an existing thread (idempotent), creates one if absent, and returns `{ status: 'submitted', threadId }`.

**Why:** Clients and talent need to coordinate (schedule interviews, clarify requirements) without exchanging personal contact details.

## Auth pattern

All five message endpoints use `authenticateJWT`, which handles both standard JWTs (`{ userId, email, role }` for clients/admins) and talent candidate JWTs (`{ type: "candidate", candidateId, email }` — resolved to userId by email lookup). Frontend `apiRequest` in `queryClient.ts` sends whichever token is in localStorage (standard token first, then talent token).

Every endpoint checks that the authenticated user is in `thread.participants` before allowing access.

## Contact rule

Messages must never contain or expose email/phone. The compose box shows a "Do not share personal contact details" reminder. `senderId` is always forced to the authenticated user server-side (client-supplied senderId is ignored).

## DatabaseStorage methods

Added at the bottom of `DbStorage` class in `server/storage.ts`: getMessageThread, createMessageThread, listMessageThreadsByUser, getMessage, createMessage, listMessagesByThread, markMessagesAsRead. All use Drizzle ORM except markMessagesAsRead (raw SQL — array_append for readBy).

## Frontend

- Page: `client/src/pages/Inbox.tsx` — two-panel layout (thread list left, conversation right). Mobile: single panel with back button. Polls every 10s (threads) / 5s (messages).
- Route `/inbox` added to both PublicRouter (talent) and in client public routes (App.tsx). Auth redirect: `/portal-login?portal=<role>&returnTo=/inbox`.
- Nav links added to `TalentApplications.tsx` (header bar "Messages" button) and `ClientProfile.tsx` (header area link).

## Thread subject

Set to the job title at creation time so the thread list displays a meaningful label without additional API calls.

## Known gaps (proposed tasks)

- #192: Unread badge on navigation
- #193: Contact-detail paste prevention in compose box
- #194: Email notification when client sends a message
