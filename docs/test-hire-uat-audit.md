# Test Hire UAT audit and manual procedure

## 1. Root blocker found

There is no interview-completion prerequisite in the current offer creation, accepted-offer contract preparation or signed-contract activation code. No interview requirement was added.

The existing path already supports downstream testing without an interview:

**Valid Talent application → normal Admin Shortlisted transition → owning Client sends offer → Talent accepts → real document/signature workflow → Hired.**

Relevant preparation gates:

- `new` is not an offer-eligible status. `under_review`, `reviewed`, `shortlisted`, `interviewing` and `offer_declined` are.
- The normal Admin status dialog offers Shortlisted, but routes the change through **Email Applicant / Send Email**. Successful email processing commits the status and history. A failed send does not; **Send Test Email** does not commit a status change.
- The **Extend an Offer** action is on the owning Client's application detail, not the Admin's generic status dropdown.
- A Talent profile/account alone is not a hiring application. Silent shortlist records and unlinked/imported records are not eligible formal submissions.
- An organic application must be linked to the authenticated Talent account and a real approved, non-draft job belonging to the same Client.
- A job needs valid Lite/Standard engagement type and tracked/guaranteed billing mode. Offer currency must follow the existing USD rules.
- A pending offer prevents duplicate live offers. Rejected/withdrawn/declined formal records are not eligible.

No specific Talent/application identifier was supplied, so these are verified code-level gates, not a claimed diagnosis of one selected live record.

## 2. Files changed

**No application code, schema, service or UI behavior changed.** This audit document and the project-memory UAT scope note were added/updated.

Inspected enforcement points include:

- `client/src/pages/AdminJobApplications.tsx`: Shortlisted selection and email/status confirmation.
- `client/src/pages/ClientProfile.tsx`: owning Client's Extend an Offer action.
- `server/routes.ts`: Admin email/status handling, formal offer creation, Clock ownership.
- `server/services/formalPipelineGuard.ts`: canonical Talent, Client/job and application eligibility.
- `server/services/hiringContractService.ts` and `contractDocumentService.ts`: accepted offer and real signature-driven activation.
- `server/services/timesheetEligibility.ts`, `server/routes/timesheets.ts`: completed hiring and owning-party access.

## 3. Endpoint/action added

None. The task explicitly says not to add unnecessary test-only code if normal Admin actions suffice. The existing preparation path does suffice for legitimate linked test applications.

Use **Change Application Status → Shortlisted → Send Email**, followed by the owning Client's **Extend an Offer**.

## 4. Test-account restriction

No new privileged test action exists, so no new test-account designation is needed or introduced. Manually choose only your own test accounts and test job.

The schema's existing `job_application_emails.is_test` marks test email records, not test users. It is not treated as permission to manipulate an account.

Do not select arbitrary real applicants. Do not run destructive cleanup on shared/production records.

## 5. Feature flag

None added or enabled. Neither `ENABLE_TEST_HIRING_TOOLS` nor the previously proposed interview-bypass flag was configured.

## 6. Production safety

The normal production workflow is unchanged. There is no new bypass, hidden test URL, test endpoint, browser-controlled permission or manual Hired action. Authentication, Client ownership, organization representative authorization, formal eligibility, document integrity and required signatures remain in force.

The audit did not restart the app, publish it, migrate a database, send an email, or alter real hiring records.

## 7. Database changes made by this work

**None.**

When you perform the existing manual path, normal services legitimately write the application email/status history, offer and acceptance records, versioned contract documents, real attributed signatures and execution audit. Only full signing triggers canonical Hired, billing activation and the pending security deposit. Clock sessions are created only by actual Clock In/Clock Out.

Do not treat UAT as exempt from normal billing side effects. Use isolated development/UAT data and approved test recipients.

## 8. Deliberately not changed

- No recruitment/interview requirement added or removed.
- No fake interview or completed-interview record.
- No forced accepted offer, fake signature or executed contract.
- No manual Hired transition.
- No weakened role, tenant, organization, Talent identity or Timesheet checks.
- No duplicate application, clock session or Timesheet record generated for testing.
- No new reset/cascade-delete operation.

For repeats, reuse an eligible existing submission. Void an unfinished contract using the existing authorized action where appropriate, then prepare a fresh contract. Do not delete executed signing evidence or reset real billing/attendance history to simulate a new test. If a complete new cycle is needed, use another legitimate test application/job through normal UI.

## 9. Automated test results

**No new tests were added or run for this audit**, because no executable behavior was changed and no test utility was implemented.

Earlier contract/hiring test results are not relabeled as successful Test Hire/Clock UAT. This turn verified the existing preparation and eligibility logic by source inspection only.

All manual Offer → Contract → Team → Clock → Timesheet steps below remain **PENDING** until actually performed. Signed-in UI and inbox receipt were not verified during this audit.

## 10. Exact manual UAT procedure

### Preparation

Use separate test Admin, Client and Talent accounts in your development/UAT environment. The Admin must already have the appropriate existing application-management permissions. Use an approved job owned by that test Client, with **Lite or Standard**, **USD**, and **tracked billing**. Guaranteed engagements do not require clock attendance and are not suitable for the Clock In test.

Use a sensible start date covering the work being tested, so Timesheet period clipping does not exclude the session. Do not use a terminated/expired contract. For Team testing, select the test Client's existing Organization/workspace. Do not add the Talent as an Organization account member merely to make Team/Timesheet access work.

### Steps — all PENDING

1. **Talent:** reuse a legitimate linked application to the test Client's approved job. If none exists, apply through `/jobs/:jobId/apply` with the normal required information. This creates an organic application without needing an interview.
2. **Admin:** open `/admin/job-applications` and find that exact application and job. Confirm it is the correct linked Talent/test Client relationship.
3. Open **Change Application Status**, select **Shortlisted**, and add a truthful internal note such as “Manual UAT preparation; no interview conducted.”
4. Continue into **Email Applicant**, send to the approved test inbox, confirm **Send Email**, and verify the application actually becomes Shortlisted. Do not use **Send Test Email** for this transition. If delivery processing fails, resolve/retry it rather than directly changing the database.
5. **Owning Client:** open `/client-profile`, locate the application's detail, and click **Extend an Offer**. If absent, recheck Shortlisted, formal eligibility and that you are signed in as the job-owning Client.
6. Send the real offer with the normal positive USD rate/start-date fields and valid engagement/billing settings.
7. **Talent:** open `/my-applications`, review and accept the offer. Confirm accepted-offer state.
8. **Client or authorized Admin:** open the application contract panel or `/contracts`; choose the accepted offer and **Prepare Contract**. For an Organization contract, select an allowed Organization and ensure the representative is an active authorized owner.
9. Upload a real valid test PDF, review the stored version and send it for signatures.
10. **Talent:** open the received contract notification or authenticated `/contracts` page. Fetch/review the PDF, enter the real test signer's legal name, explicitly consent and sign.
11. **Client/Organization contract only:** sign in as the owning Client or authorized Organization representative; review and sign that exact version. Neither can sign as OnSpot.
12. **OnSpot Admin:** review and countersign. An OnSpot-only contract needs Talent + OnSpot; Client/Organization contracts need Talent + the authorized representative + OnSpot.
13. Verify executed status, attributed signatures, version/hash and executed-copy access. Before every required signature is present, confirm the application is **not Hired**.
14. Verify canonical application **Hired** and the signed hiring contract. As the owning Client, open **Team** at `/clients`, select the appropriate test workspace and check the Talent's hiring relationship. Organization roster visibility does not grant another Client's Timesheet rights.
15. **Talent:** open `/talent/clock`, choose the signed tracked contract and **Clock In**. After an actual test interval, **Clock Out**. Resolve any already-open/missed session through the existing exception process; do not create fabricated timestamps.
16. **Talent:** open `/talent/timesheets`, select the applicable contract/period, verify recorded session duration and submit the Timesheet through its normal action.
17. **Owning Client:** open `/client/timesheets`, inspect that contract/period and use the existing review/dispute flow as appropriate. OnSpot Admin review remains at `/admin/timesheets`. Check Team's recorded hours separately: they are not automatically approved/billable hours. A different Client must not gain access.

### If the existing path fails

Record the application/job identifier, the signed-in role, the exact action and the error text. Investigate that specific failure before introducing a new test-only utility. Do not infer an interview requirement from a missing offer action.
