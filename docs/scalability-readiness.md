# OnSpot — Scalability Readiness

**Last updated:** July 2026  
**Status:** Phases 2, 3, 5, 6, 8, 10 complete. Phases 11–14 (frontend perf, formal testing, load test, docs) partially done.

---

## Current Architecture

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| Backend | Node.js + Express |
| Database | PostgreSQL on Neon (serverless) |
| ORM | Drizzle ORM |
| Auth | Replit Auth + JWT (candidate + admin) |
| File uploads | Replit Object Storage (direct, no base64) |
| AI | OpenAI Assistant API (Vanessa) |
| CRM sync | GoHighLevel via cron |
| Hosting | Replit |

Target capacity: **10,000 talent profiles**, **1,000 client profiles**, associated jobs, applications, and documents.

---

## Pagination Contract

All list endpoints that return growing collections now return a paginated envelope.

### Request

```
GET /api/candidates?page=1&pageSize=25
GET /api/jobs/search?q=engineer&page=2&pageSize=50
GET /api/admin/jobs?page=1&pageSize=100
GET /api/inquiries?page=1&pageSize=25
```

| Parameter | Default | Maximum | Notes |
|---|---|---|---|
| `page` | 1 | — | 1-based |
| `pageSize` | 25 | 100 | Clamped server-side |

### Response

```json
{
  "items": [...],
  "meta": {
    "page": 1,
    "pageSize": 25,
    "total": 843,
    "totalPages": 34
  }
}
```

For `GET /api/inquiries`, the envelope key is `inquiries` (not `items`) for backwards compatibility.

### Paginated Endpoints

| Endpoint | Default Page Size |
|---|---|
| `GET /api/candidates` | 25 |
| `GET /api/jobs/search` | 25 |
| `GET /api/admin/jobs` | 25 |
| `GET /api/inquiries` | 25 |

---

## Important Indexes

All indexes applied via `CREATE INDEX IF NOT EXISTS` — safe on existing data.

| Index | Table | Column(s) | Purpose |
|---|---|---|---|
| `idx_users_role` | `users` | `role` | Filter talent vs client |
| `idx_users_created_at` | `users` | `created_at` | Sort/paginate users |
| `idx_profiles_location` | `profiles` | `location` | Location filter |
| `idx_profiles_availability` | `profiles` | `availability` | Available-only filter |
| `idx_profiles_created_at` | `profiles` | `created_at` | Sort |
| `idx_client_profiles_industry` | `client_profiles` | `industry` | Industry filter |
| `idx_jobs_client_id` | `jobs` | `client_id` | Per-client job list |
| `idx_jobs_status` | `jobs` | `status` | Open/closed filter |
| `idx_jobs_approval_status` | `jobs` | `approval_status` | Approval queue |
| `idx_jobs_category` | `jobs` | `category` | Category filter |
| `idx_jobs_created_at` | `jobs` | `created_at` | Sort by date |
| `idx_jobs_posted_at` | `jobs` | `posted_at` | Sort by post date |
| `idx_jobs_status_approval` | `jobs` | `status, approval_status` | Common compound filter |
| `idx_user_skills_user_id` | `user_skills` | `user_id` | Skills per user |
| `idx_user_skills_skill_id` | `user_skills` | `skill_id` | Users per skill |
| `idx_job_skills_job_id` | `job_skills` | `job_id` | Skills per job |
| `idx_job_skills_skill_id` | `job_skills` | `skill_id` | Jobs per skill |
| `idx_candidates_email` | `candidates` | `email` | Lookup by email |
| `idx_candidates_category` | `candidates` | `category` | Category filter |
| `idx_candidates_created_at` | `candidates` | `created_at` | Sort |
| `idx_candidates_profile_completed` | `candidates` | `profile_completed` | Filter complete profiles |
| `idx_lead_intakes_status` | `lead_intakes` | `status` | Lead status filter |
| `idx_lead_intakes_synced_to_ghl` | `lead_intakes` | `synced_to_ghl` | GHL sync queue |
| `idx_waitlist_synced_to_ghl` | `waitlist` | `synced_to_ghl` | GHL sync queue |

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | required | Neon PostgreSQL connection string |
| `JWT_SECRET` | required in prod | JWT signing secret |
| `OPENAI_API_KEY` | optional | Enables VanessaChat + RAG |
| `SENTRY_DSN` | optional | Error tracking |
| `RUN_BACKGROUND_JOBS` | `true` | Set to `false` on secondary instances to prevent duplicate crons |
| `JSON_BODY_LIMIT` | `1mb` | Max JSON body size. Do not raise for upload routes — use object storage |
| `RATE_LIMIT_SIGNUP` | `20` | Max signups per IP per hour |
| `RATE_LIMIT_SEARCH` | `60` | Max search requests per IP per minute |
| `RATE_LIMIT_UPLOAD` | `20` | Max upload URL requests per IP per minute |
| `RATE_LIMIT_AI_CHAT` | `30` | Max Vanessa/RAG requests per IP per minute |
| `RATE_LIMIT_WAITLIST` | `10` | Max waitlist/lead form submissions per IP per hour |
| `AUTO_UPDATE_VANESSA_KNOWLEDGE` | `false` | Regenerate Vanessa's knowledge base on every restart |
| `SEED_TALENT_COUNT` | `500` | Records to create during perf-test seed |
| `SEED_CLIENT_COUNT` | `100` | Records to create during perf-test seed |
| `SEED_JOB_COUNT` | `200` | Records to create during perf-test seed |

---

## Upload Limits

- JSON body: **1 MB** (configurable via `JSON_BODY_LIMIT`).  
- File uploads go directly to Replit Object Storage — never base64 inside JSON.  
- Upload URL generation is rate-limited (20/min/IP).  
- MIME type and extension validation is enforced per-upload route.

---

## Rate Limits

All limits return HTTP 429 with `RateLimit-*` headers.

| Route prefix | Window | Limit (default) | Key |
|---|---|---|---|
| `/api/auth`, `/api/dev/login` | 15 min | 10 | IP |
| `/api/signup` | 1 hour | 20 | IP |
| `/api/talent-auth` | 15 min | 10 | IP |
| `/api/profiles/search`, `/api/jobs`, `/api/candidates/search` | 1 min | 60 | IP |
| `/api/storage/upload-url` | 1 min | 20 | IP |
| `/api/vanessa`, `/api/rag` | 1 min | 30 | IP |
| `/api/waitlist`, `/api/lead-intake` | 1 hour | 10 | IP |

`trust proxy = 1` is set so Replit's reverse proxy doesn't cause all traffic to appear from one IP.

---

## Background Job Behavior

| Job | Schedule | Guard |
|---|---|---|
| GHL sync | Every 15 min | `RUN_BACKGROUND_JOBS !== 'false'` |
| Site crawler | Daily at 3 AM | `RUN_BACKGROUND_JOBS !== 'false'` |
| RAG pre-warm | On startup | Always (read-only, safe) |
| Website content indexing | On startup | `RUN_BACKGROUND_JOBS !== 'false'` |
| Job listings indexing | On startup | `RUN_BACKGROUND_JOBS !== 'false'` |

Set `RUN_BACKGROUND_JOBS=false` on every replica except one to prevent duplicate cron runs.

---

## Health Endpoints

### `GET /api/health`

Liveness check — no database required.

```json
{ "status": "ok", "timestamp": "2026-07-13T10:00:00.000Z" }
```

### `GET /api/ready`

Readiness check — verifies database is reachable.

```json
{ "status": "ready", "db": "ok", "timestamp": "2026-07-13T10:00:00.000Z" }
```

Returns HTTP 503 if the database is not reachable.

---

## Performance-Test Seed Script

**Never runs in production automatically.**

```bash
# Seed dev/staging with synthetic data
TEST_SEED=true npx tsx scripts/seed-perf-test.ts

# Override record counts
SEED_TALENT_COUNT=10000 SEED_CLIENT_COUNT=1000 SEED_JOB_COUNT=2000 \
  TEST_SEED=true npx tsx scripts/seed-perf-test.ts

# Clean up after testing
TEST_SEED=true npx tsx scripts/seed-perf-test.ts --cleanup
```

All synthetic emails use domain `perf-seed.onspot.test` for easy cleanup.

---

## Load Test Instructions

> Phase 12 (automated tests + load test) is not yet complete. Run manually.

Recommended tool: [k6](https://k6.io/) or `autocannon`.

```bash
# Install k6 (macOS)
brew install k6

# Run a 50-concurrent-user test for 5 minutes
k6 run --vus 50 --duration 5m scripts/load-test.js
```

Target metrics for read endpoints:
- Error rate < 1%
- p95 latency < 1 second
- No OOM crashes
- No unbounded response sizes

**Do not run load tests against the production deployment.**

---

## Known Remaining Limits

1. **Storage-level pagination**: `getCandidates()` and `listAllJobs()` still load all rows from the DB before slicing in memory. For >10,000 rows, add DB-level `LIMIT`/`OFFSET` to the Drizzle queries.
2. **Phase 11 (frontend perf)**: Route-level lazy loading not yet implemented.
3. **Phase 12 (automated tests)**: No automated test suite yet.
4. **Phase 9 (caching)**: No in-process TTL cache for public job categories or skill reference data.
5. **`/api/posts` and `/api/posts/all`**: Still unbounded (posts volume is low — add pagination if posts exceed ~200).
6. **Admin jobs N+1 fix**: Replaced with batch query; still loads entire `jobs` table first.
7. **Query timeouts**: Neon serverless does not expose per-query timeout configuration from the pool client.

---

## Replit Deployment Notes

- Set `trust proxy = 1` (already done) so rate-limiting uses real client IPs.
- Set `RUN_BACKGROUND_JOBS=false` on all replicas except the designated worker.
- `JSON_BODY_LIMIT=1mb` is safe for all current routes. Do not raise it globally.
- Neon's serverless pool manages connection reuse automatically.
- The app must be restarted after schema changes (indexes apply immediately; schema changes require a restart for Drizzle's type cache).

---

## Rollback Steps

1. Indexes are safe to drop at any time: `DROP INDEX IF EXISTS idx_<name>;`
2. The JSON body limit change (`1mb`) can be reverted by setting `JSON_BODY_LIMIT=50mb` temporarily.
3. Rate limiters use in-memory state; restarting the server resets all counters.
4. Pagination changes to API response shape: ensure any frontend consumers of `/api/admin/jobs`, `/api/candidates`, `/api/jobs/search`, or `/api/inquiries` read from `response.items` (or `response.inquiries`) and `response.meta` instead of the raw array.
