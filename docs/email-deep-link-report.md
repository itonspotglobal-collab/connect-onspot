# OnSpot transactional email deep-link report

Date: 2026-10-07

**Status:** Implemented and checked in development. Production rollout and a newly generated email's complete external-email-client → login → owned-resource journey remain **PENDING**. No publish was performed.

## 1. Root causes

- The shared `PUBLIC_APP_URL` configuration was `https://talent.onspotglobal.com`. Multiple email services independently preferred that setting.
- The client `DomainRouter` forced every non-root path on that domain to `/`, destroying resource paths and query state.
- Several protected routes redirected to login without preserving their destination. Some login readers used unvalidated `returnTo`, and Admin login could discard it.
- Offer emails linked to generic My Applications. Client interview notifications used the Talent email context's default destination. Some application and message emails also linked to generic views rather than selecting the referenced resource.

## 2. Canonical application URL

The publishing service returned:

- Primary application URL: **https://connect.onspotglobal.com**
- Deployment: public Autoscale; an existing successful published build was reported.
- Verified aliases included the legacy Talent domain, the public website domains, and the generated Replit application domain.

The primary URL was obtained from deployment metadata, not inferred from the workspace name or development-domain variables.

## 3. Configuration changed

`PUBLIC_APP_URL` is the single email/application-link origin setting. Its shared value was changed through the environment configuration interface to:

```text
PUBLIC_APP_URL=https://connect.onspotglobal.com
```

The production configuration was inspected separately after the change and returned this shared setting. The corresponding `.replit` setting was updated by that configuration operation. Secrets were not displayed.

Development/staging operators can configure their own trusted application origin. The link builder does not fall back to request headers, `REPLIT_DOMAINS`, `PUBLIC_BASE_URL`, `APP_URL`, or a hardcoded domain.

## 4. Central URL builder

`server/lib/appUrl.ts` provides:

- `getAppBaseUrl()`: validates trusted `PUBLIC_APP_URL` and returns its normalized origin.
- `buildAppUrl(path)`: builds an absolute application URL from a validated internal path.
- Resource helpers for Talent applications/offers/interviews and Client applications/interviews.
- `canonicalizeApplicationEmailLinks()`: repairs known application hrefs in saved/custom HTML templates at the shared Graph transport boundary. Intentional public marketing and external meeting links remain unchanged.

Validation rejects credentials, base paths, query/fragment-bearing origins, unsafe schemes, control characters, backslashes, and external/protocol-relative destinations. Production requires HTTPS. Loopback HTTP is allowed only outside production. Missing/invalid configuration fails explicitly rather than sending `#`, guessing a development host, or silently switching origins.

## 5. Email inventory

In this table, **old base** means the former independently resolved origin, normally `talent.onspotglobal.com` under the inspected configuration. **App** means the configured canonical origin. IDs are placeholders, not real records.

| Email | CTA / destination purpose | Old destination | New destination |
|---|---|---|---|
| New formal offer | Review Offer | Old base + generic `/my-applications` | App + `/my-applications?offerId={offerId}` |
| Offer response to Client | View Hiring Pipeline | Old base + `/hiring-pipeline` | App + `/client-profile?applicationId={submissionId}` |
| Offer expiry reminder to Talent | Review offer | Old base + generic `/my-applications` | App + `/my-applications?offerId={offerId}` |
| Expired offer notice to Talent | Review offer/current state | Old base + generic `/my-applications` | App + `/my-applications?offerId={offerId}` |
| Expired offer notice to Client | Review application/pipeline | Old base + generic `/client-profile` | App + `/client-profile?applicationId={submissionId}` |
| Client-initiated Talent invitation | View Invitation / My Applications | Hardcoded public website `/my-applications` | App + `/my-applications?applicationId={submissionId}`; exact invitation card retains Accept/Decline |
| Application received/status emails | Review application | Old base + generic `/my-applications` | App + `/my-applications?applicationId={applicationId}` when the existing caller supplies it |
| Under review / shortlist / rejection / withdrawal emails | Application status/history | Old base + generic `/my-applications` | Same application-specific canonical destination |
| Applicant interview-stage / offer-stage / welcome templates | Review associated application | Old base + generic `/my-applications` | Same application-specific canonical destination |
| Applicant follow-up / document / reference / general templates | Review associated application | Independently resolved portal or saved template URL | Canonical context destination; known saved application hrefs are normalized at transport |
| Interview confirmed to Talent | View interview | Old base + generic `/my-applications` | App + `/my-applications?applicationId={submissionId}&interviewId={interviewId}` |
| Interview proposal to Talent | Review proposed times | Old base + generic `/my-applications` | Same exact Talent interview destination |
| Interview confirmation to Client | Review interview | Talent default `/my-applications` | App + `/client-profile?applicationId={submissionId}&interviewId={interviewId}`; job context may also be included |
| Interview counter-proposal to Client | Review proposed times | Talent default `/my-applications` | Same Client-specific interview destination |
| Interview rescheduled to Talent | Review new times | Generic Talent portal | Exact Talent interview destination |
| Interview rescheduled to Client | Review interview | Talent default portal | Exact Client interview destination |
| Interview cancelled to Talent | Review current state | Generic Talent portal | Exact Talent interview destination |
| Interview cancelled to Client | Review current state | Talent default portal | Exact Client interview destination |
| Contract package/signature/executed events to Talent | Review contract and required signatures | Independently resolved `/contracts?id={id}` on wrong configured base | App + `/contracts?id={contractId}` |
| Contract events to Client/Organization/OnSpot signers | Review private contract/current state | Same independently resolved contract URL | Same exact canonical contract destination; existing party authorization remains required |
| Organization invitation with token | Review/accept invitation | Old base + `/organization-invite/{token}` | App + same supported tokenized path |
| Organization invitation without token | Sign in / invitations | Old base + sign-in URL | Canonical sign-in URL preserving `/organization-invitations` |
| Client job approved/unapproved/rejected | View/manage job | Generic Client portal or independently constructed job URL | App + `/client/jobs/{jobId}/edit` through the common builder/context |
| Job posted on Client's behalf | Review job | Independently constructed Client/job links | Canonical job-specific context URL |
| New application to Client | Review application | Old base + generic `/client-profile` | App + `/client-profile?applicationId={submissionId}` |
| Unread message | View messages | Old base + generic `/messages` | App + `/messages?thread={threadId}` |
| Signup email ownership verification | Enter verification code | No application CTA; six-digit code email | No URL added; unchanged code/ownership workflow |
| Investor intake founder email | Intake information | No application CTA | No application CTA introduced |
| Password/account setup and onboarding | Audit for link generation | No additional transactional application-URL producer was found outside the audited flows | Existing login/setup/signup destination handling now validates and preserves return paths |

All 14 built-in applicant templates and Client decision templates passed the existing rendering regression tests. Template branding, layout and wording were not redesigned.

For source contexts without an associated record ID, the truthful destination remains the appropriate canonical portal; an ID is not fabricated. Saved custom HTML hrefs retain their intended internal path rather than inventing a resource association.

## 6. Offer destination and expiration behavior

The formal-offer email and scheduled reminder/expiry emails use `/my-applications?offerId={id}`. The frontend fetches the specific offer through the existing candidate-scoped detail API and opens review.

Expired or already accepted offers remain readable. Acceptance uses the existing expiration/status rules and is disabled when no longer actionable. The URL does not itself authorize a response.

## 7. Contract destination/current-state behavior

Contract email links use the application's existing `/contracts?id={id}` route, not an invented `/contracts/:id` route.

The detail query opens the requested contract even if it is absent from the initial list. Existing private detail/PDF/signature APIs still enforce access. Old signature emails therefore show the current contract state, including executed-document actions when appropriate.

## 8. Interview destinations

Both interview and associated submission IDs are passed from the persisted interview into email generation.

Talent links require matching interview/application association. Client links select the requested owned round, including a historical round that is no longer the latest. Historical rounds display read-only rather than silently substituting another interview.

## 9. Other resource destinations

- Talent applications select their owned record; pending invitations show the actual invitation card and its existing response actions instead of a blocking details drawer.
- Client application links open the selected owned application.
- Admin application links support `/admin/job-applications?applicationId={id}`.
- Message links select the specific thread through the existing authorized thread list.
- Organization invitation token and query state are retained.
- Client job links use the existing job-edit route and existing job authorization.

## 10. Authentication return flow

Protected entry paths retain pathname, query and fragment in a validated `returnTo`.

- Generic login retains the destination through Client/Talent portal choice.
- Talent login and signup restore it after successful authentication.
- Client login and signup restore it after successful authentication.
- Logged-out Admin routes use dedicated `/admin/login?returnTo=...`, and successful Admin login restores the destination.
- Authentication interlude navigation uses replacement where appropriate to avoid Back bouncing through already-authenticated login/chooser entries.
- Actual JWT roles take precedence over stale Talent-only local storage for app routing.

No authentication bypass or new identity provider was added. Existing server-side role/ownership/signature/hiring rules were not relaxed.

## 11. Open-redirect protection

The shared internal-path validator is used by URL generation and return-path handling. It rejects absolute URLs, protocol-relative paths, backslashes, control characters, encoded versions of those attacks, and paths whose dot-segment normalization would create a protocol-relative value.

Safe examples tested include contract, offer, message and query-bearing internal destinations. Merely knowing an ID remains insufficient for access.

## 12. Direct browser and server routing checks

The development server returned HTTP 200 SPA responses for direct contract, offer and Client application URLs. No new unsupported resource route was invented.

Fresh mobile Chromium sessions confirmed that direct contract, offer and Admin application entry URLs reach their appropriate sign-in flow and retain the exact destination. The contract check also clicked Talent portal choice and confirmed that the destination was still intact.

Anonymous requests to both offer-detail and contract-detail APIs returned **401**. A new signed-in cross-account permission suite was not run; existing ownership checks were not changed.

## 13. Mobile verification

Verified in a fresh 390×844 browser:

- Contract URL → login chooser → Talent login; exact contract query preserved.
- Offer URL → Talent login; exact offer query preserved.
- Admin application URL → Admin login; exact application query preserved.
- Screenshot of the signed-out contract entry showed the expected responsive chooser without a broken app.

**Not verified:** successful real-account login and resource actions from an external mobile email client. The capture browser cannot sign in, and no real recipient/account journey was claimed.

## 14. Automated results

- Central URL builder + existing email-variable tests: **17 passed**.
- Actual contract delivery service with mocked DB/Graph transport: **2 passed**, including fail-closed missing configuration.
- Existing email companion, applicant-template, interview email and signup pure tests: **65 passed**, **41 skipped**. Skips are database-dependent signup cases with no disposable test database configured for this run; they are not claimed as passes.
- Frontend return-path/resource-selection regression tests: **14 passed**.
- TypeScript check: **passed**.
- Frontend production build: **passed**.
- `git diff --check`: **passed**.
- Actual fresh mobile browser checks: **3 passed**.

Combined unit/regression results: **98 passed; 41 skipped**, plus the three fresh-browser checks. Mocked email tests did not send real emails.

## 15. Production configuration status

- Deployment primary URL: **verified** through publishing metadata.
- Updated production-visible `PUBLIC_APP_URL`: **verified** through the production environment configuration interface.
- Running published build includes these source changes: **PENDING**.
- Newly generated production email uses the new origin and completes login → exact owned-resource journey: **PENDING**.

The already-published build was not republished by this implementation. Configuration inspection does not prove that an older running deployment snapshot has picked up the change.

## 16. Required rollout

Republish to apply the code and canonical origin configuration. No database migration was added for this task.

After publishing, generate fresh offer, contract and interview emails through the normal authorized workflows, then verify signed-in and signed-out journeys in an external email client. Include expired offers, executed contracts, historical interview rounds and copied links opened by a different account.

## 17. Previously delivered emails

Inbox contents cannot be changed by a source/configuration fix. Historical emails retain their original hrefs.

The legacy redirect can recover wrong-domain links that already contain a useful path/query after publishing. Historical generic URLs cannot acquire a missing offer/contract/application ID, and previously wrong-role or wrong-path URLs are not automatically corrected. Those cases require a newly generated email.

## 18. Legacy-domain redirect

The publishing metadata confirmed the old Talent domain is an alias of this app, and the repository controlled its path-destroying router behavior.

An HTTP **308** redirect is implemented for GET/HEAD requests on exactly `talent.onspotglobal.com`, to the configured canonical origin, preserving the full path and query string. Browsers retain fragments. API/object requests are excluded; public marketing hostnames are not redirected by this middleware. Unsafe destination/configuration values fail closed.

The client no longer rewrites legacy-domain paths to `/`. Redirect behavior passed focused middleware tests. Live custom-domain redirect verification remains pending publication.

## Files changed

Configuration: `.replit`.

Shared/server:

- `shared/internalRedirect.ts`
- `server/lib/appUrl.ts`
- `server/lib/legacyAppRedirect.ts`
- `server/index.ts`
- `server/routes.ts`
- `server/services/contractDeliveryService.ts`
- `server/services/emailCompanionService.ts`
- `server/services/emailVariableResolver.ts`
- `server/services/interviewEmailService.ts`
- `server/services/microsoftGraphEmailService.ts`
- `server/services/offerExpiryService.ts`
- `server/services/signupVerificationService.ts`

Frontend:

- `client/src/App.tsx`
- `client/src/components/ContractWorkflow.tsx`
- `client/src/components/DomainRouter.tsx`
- `client/src/components/PortalChooser.tsx`
- `client/src/components/ProtectedRoute.tsx`
- `client/src/components/SignUpDialog.tsx`
- `client/src/pages/AdminJobApplications.tsx`
- `client/src/pages/AdminLogin.tsx`
- `client/src/pages/ClientProfile.tsx`
- `client/src/pages/Messages.tsx`
- `client/src/pages/PortalLogin.tsx`
- `client/src/pages/TalentApplications.tsx`
- `client/src/pages/TalentSignupFromApplication.tsx`
- `client/src/lib/returnTo.ts`
- `client/src/lib/deepLinks.ts`

Tests:

- `server/tests/app-url.test.ts`
- `server/tests/contract-email-links.test.ts`
- `server/tests/email-variable-resolver.test.ts`
- `client/src/lib/returnTo.test.ts`
- `client/src/lib/deepLinks.test.ts`

This report and a durable email-verification policy note were also added.
