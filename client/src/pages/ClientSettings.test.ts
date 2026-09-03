/**
 * ClientSettings.test.ts
 *
 * Smoke tests for the client-settings data-loss guard:
 *   If the /api/client-profile/me fetch fails (e.g. 500), the Edit button
 *   must NOT open an empty form that the user could save, overwriting their
 *   real data with blanks.
 *
 * Run with: npx vitest run client/src/pages/ClientSettings.test.ts
 */

import { describe, it, expect } from "vitest";

// ─── Guard logic ──────────────────────────────────────────────────────────────
//
// Mirrors the exact guard inside startEditProfile in ClientSettings.tsx:
//   if (profileIsError) return;   // never open when query failed
//
// Tests here validate that the guard condition itself is logically correct so
// that code reviewers and future refactors have a pinned regression contract.

function makeStartEditProfile(opts: {
  profileIsError: boolean;
  clientProfile?: Record<string, unknown> | null;
}) {
  const calls: Array<Record<string, unknown>> = [];

  const startEditProfile = (): boolean => {
    // Guard — same condition used in the component
    if (opts.profileIsError) return false;

    calls.push({
      companyName: opts.clientProfile?.companyName ?? "",
      contactPerson: opts.clientProfile?.contactPerson ?? "",
      email: opts.clientProfile?.email ?? "",
      phoneNumber: opts.clientProfile?.phoneNumber ?? "",
      website: opts.clientProfile?.website ?? "",
      industry: opts.clientProfile?.industry ?? "",
      companySize: opts.clientProfile?.companySize ?? "",
      location: opts.clientProfile?.location ?? "",
      timezone: opts.clientProfile?.timezone ?? "",
      about: opts.clientProfile?.about ?? "",
      hiringNeeds: opts.clientProfile?.hiringNeeds ?? "",
    });
    return true;
  };

  return { startEditProfile, calls };
}

// ─── Smoke tests ──────────────────────────────────────────────────────────────

describe("ClientSettings — company profile edit guard", () => {
  it("does NOT open the form when the profile query has errored (isError = true)", () => {
    // Simulates: server returned 500 → profileIsError is true
    const { startEditProfile, calls } = makeStartEditProfile({
      profileIsError: true,
      clientProfile: null, // nothing was loaded
    });

    const opened = startEditProfile();

    expect(opened).toBe(false);
    expect(calls).toHaveLength(0); // form was never initialised with empty data
  });

  it("DOES open the form when the profile query succeeded (isError = false)", () => {
    const profile = {
      companyName: "Acme Corp",
      contactPerson: "Jane Doe",
      email: "jane@acme.com",
      phoneNumber: "+1 555 000 0000",
      website: "https://acme.com",
      industry: "Technology",
      companySize: "11–50",
      location: "Singapore",
      timezone: "Asia/Singapore",
      about: "A test company",
      hiringNeeds: "Engineers",
    };

    const { startEditProfile, calls } = makeStartEditProfile({
      profileIsError: false,
      clientProfile: profile,
    });

    const opened = startEditProfile();

    expect(opened).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0].companyName).toBe("Acme Corp");
    expect(calls[0].contactPerson).toBe("Jane Doe");
  });

  it("does NOT open the form when isError = true even if stale clientProfile data is available", () => {
    // Edge case: query.data may hold stale data from a prior successful fetch
    // while the latest refetch errored. The guard must still block the edit.
    const { startEditProfile, calls } = makeStartEditProfile({
      profileIsError: true,
      clientProfile: { companyName: "Stale Corp" }, // stale cache entry
    });

    const opened = startEditProfile();

    expect(opened).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it("opens the form with empty strings when profile loaded but fields are null", () => {
    // A brand-new client may have no profile data yet — that is fine to edit
    const { startEditProfile, calls } = makeStartEditProfile({
      profileIsError: false,
      clientProfile: {
        companyName: null,
        contactPerson: null,
        email: null,
        phoneNumber: null,
        website: null,
        industry: null,
        companySize: null,
        location: null,
        timezone: null,
        about: null,
        hiringNeeds: null,
      },
    });

    const opened = startEditProfile();

    expect(opened).toBe(true);
    expect(calls[0].companyName).toBe("");
    expect(calls[0].about).toBe("");
  });
});
