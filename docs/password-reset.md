# Email-verified password reset

The Client, Talent and navigation sign-in dialogs use the same two-step flow:
request a code, then submit the code with matching new passwords. No password
changes until the email code has been verified.

## Configuration

Configure these non-secret values for each environment that should send mail:

```text
PASSWORD_RESET_EMAIL_DELIVERY_ENABLED=true
TALENT_VERIFICATION_EMAIL_FROM=findwork@onspotglobal.com
CLIENT_VERIFICATION_EMAIL_FROM=hiretalent@onspotglobal.com
```

Password reset has its **own delivery flag**, independent of
`SIGNUP_VERIFICATION_EMAIL_DELIVERY_ENABLED` and `SIGNUP_EMAIL_VERIFICATION_REQUIRED`.
Disabling signup verification never bypasses password-reset verification.

Reuse the existing secrets; do not put their values in source or documentation:
`EMAIL_VERIFICATION_HMAC_KEY` (at least 32 characters), `MICROSOFT_TENANT_ID`,
`MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`. Microsoft Graph application
Mail.Send permissions and access to both sender mailboxes are prerequisites,
exactly as for signup. Sender and reply-to are the role mailbox; Admin accounts
use the Client sender.

Apply additive migration `0057_password_reset_codes.sql` through the existing
migration/publishing process for the actual production database. Publish only
diffs managed databases; external databases require the project's established
schema-release procedure and explicit authorization. No production migration
or publishing is performed by the tests. Production configuration changes are picked up through
the normal publishing process, not proof that the current published code has
been replaced or a real inbox has received mail.

## Security and operation

- Store only domain-separated HMACs, never plaintext codes. Codes expire after
  ten minutes and are invalid after use, replacement or five failed attempts.
- Requests return the same message for known/unknown, throttled-email and
  failed-delivery cases. Validate email format and share the existing IP
  `authResetLimiter` across both endpoints.
- Reuse hashed `signup_verification_limits` buckets for independent reset
  cooldown/hourly/IP budgets. Email cooldown is a rolling 60 seconds, including
  across minute boundaries; maximum five sends per hourly bucket.
- Delivery failure invalidates the undelivered code and logs only a fixed
  diagnostic. Recipient addresses, codes, email HTML and provider error bodies
  must not appear in reset logs or responses.
- Update all matching user/candidate hashes and consume all codes atomically.
  Do not activate accounts, change email-ownership state or issue login tokens.
- The application currently has no shared JWT/session revocation mechanism.
  Password reset does **not** invalidate already-issued bearer tokens; they
  expire under their existing policies. No new revocation mechanism is invented.
- Both unverified dev password-writing endpoints and the
  `ENABLE_DEV_PASSWORD_RESET` bypass are retired.

## Verification

Run `node scripts/test-password-reset-isolated.mjs`. This creates an owned
disposable PostgreSQL cluster and runs reset tests plus existing signup
verification regressions. Application database credentials are not inherited.
Email transport is injected; this proves behavior, not Microsoft Graph inbox
delivery. A real-inbox UAT requires an approved test account and separate
confirmation that its role-mailbox email arrives and the code completes reset.

Run `node --import tsx --test browser-tests/password-reset.browser.test.ts`
against the running development preview to check the actual Client and Talent
portal screens at desktop/mobile sizes. Those browser checks mock only the
reset API responses; they do not establish authenticated recovery or inbox
delivery. Screenshots are saved under the ignored `generated-artifacts/` directory.
