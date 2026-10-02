import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { after, before, describe, it } from "node:test";
import express from "express";
import { registerDisabledLinkedInImportRoutes } from "../lib/disabledLinkedInImport.js";
import { buildCompletionItems, calcCompletionPct, profileStrengthFromCandidate } from "../../client/src/lib/profileCompletion.js";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const unavailable = {
  error: "LinkedIn profile import is unavailable. Please edit your profile manually.",
  code: "LINKEDIN_PROFILE_IMPORT_UNAVAILABLE",
};

describe("disabled LinkedIn profile import — isolated HTTP routes", () => {
  let server: Server;
  let baseUrl: string;
  let storageAccesses = 0;
  const profile = {
    firstName: "Existing",
    lastName: "Talent",
    title: "Designer",
    bio: "Manually written biography",
    linkedinUrl: "https://www.linkedin.com/in/real-profile",
    skills: ["Design"],
  };
  const original = structuredClone(profile);

  before(async () => {
    const app = express();
    app.use(express.json());
    app.locals.profile = profile;
    app.locals.storage = new Proxy({}, {
      get() {
        storageAccesses++;
        throw new Error("Disabled import must not access storage");
      },
    });
    registerDisabledLinkedInImportRoutes(app);
    server = createServer(app);
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(async () => {
    if (server) {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => error ? reject(error) : resolve()));
    }
  });

  for (const path of ["/api/linkedin/connect", "/api/linkedin/import-profile"]) {
    it(`POST ${path} returns 410 for direct requests without user identity`, async () => {
      const response = await fetch(`${baseUrl}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      assert.equal(response.status, 410);
      assert.deepEqual(await response.json(), unavailable);
    });

    it(`POST ${path} cannot generate identity, persist skills, or overwrite an existing profile`, async () => {
      const response = await fetch(`${baseUrl}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer obsolete-client-token" },
        body: JSON.stringify({
          userId: "existing-talent",
          profileData: {
            firstName: "Sample", lastName: "User",
            headline: "Professional Title",
            skills: ["JavaScript", "React", "Node.js"],
          },
        }),
      });
      assert.equal(response.status, 410);
      assert.deepEqual(await response.json(), unavailable);
      assert.equal(storageAccesses, 0);
      assert.deepEqual(profile, original);
    });
  }

  it("never reports historical simulated records as a live provider connection", async () => {
    const response = await fetch(`${baseUrl}/api/linkedin/status/existing-talent`);
    assert.equal(response.status, 410);
    assert.deepEqual(await response.json(), unavailable);
    assert.equal(storageAccesses, 0);
    assert.deepEqual(profile, original);
  });
});

describe("LinkedIn import removal and preserved Talent/auth paths — source regressions", () => {
  it("registers only the no-storage unavailable routes in the production route module", () => {
    const routes = read("../routes.ts");
    const disabled = read("../lib/disabledLinkedInImport.ts");
    assert.match(routes, /registerDisabledLinkedInImportRoutes\(app\)/);
    assert.doesNotMatch(routes, /app\.post\("\/api\/linkedin\/(?:connect|import-profile)"/);
    assert.doesNotMatch(disabled, /(?:\bstorage\.[A-Za-z_]|query\(|createProfile|updateProfile|createUserSkill|createSkill)/);
    assert.doesNotMatch(routes, /Professional summary from LinkedIn|firstName:\s*"Sample"/);
  });

  it("removes import controls, fake verification claims, and callers from all frontend runtime files", () => {
    const root = new URL("../../client/src/", import.meta.url);
    const walk = (directory: URL) => {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const path = new URL(entry.name + (entry.isDirectory() ? "/" : ""), directory);
        if (entry.isDirectory()) walk(path);
        else if (/\.(tsx?|jsx?)$/.test(entry.name) && !/\.(test|spec)\./.test(entry.name)) {
          assert.doesNotMatch(readFileSync(path, "utf8"),
            /\/api\/linkedin\/|LinkedInImport|button-connect-linkedin|LinkedIn Connected!|Import from LinkedIn|Connect Your LinkedIn Profile/,
            path.pathname);
        }
      }
    };
    walk(root);
    assert.equal(existsSync(new URL("../../client/src/components/LinkedInImport.tsx", import.meta.url)), false);
  });

  it("keeps manual LinkedIn URL editing wired to candidate saves and the PATCH allow-list", () => {
    const profile = read("../../client/src/pages/TalentProfile.tsx");
    const routes = read("../routes.ts");
    assert.match(profile, /value=\{candidate\.linkedinUrl \?\? ""\}/);
    assert.match(profile, /onSave=\{\(v\) => save\("linkedinUrl", v\)\}/);
    assert.match(routes, /app\.patch\("\/api\/candidates\/:id"/);
    assert.match(routes, /if \(body\.linkedinUrl\s+!== undefined\)\s+candidateUpdates\.linkedinUrl\s*=\s*body\.linkedinUrl/);
  });

  it("preserves separate provider-backed LinkedIn sign-in and callbacks", () => {
    const auth = read("../replitAuth.ts");
    assert.match(auth, /passport-linkedin-oauth2/);
    assert.match(auth, /passport\.use\('linkedin', new LinkedInStrategy/);
    assert.match(auth, /app\.get\('\/api\/auth\/linkedin'/);
    assert.match(auth, /app\.get\('\/api\/auth\/linkedin\/callback'/);
    for (const component of ["LoginDialog", "SignUpDialog"]) {
      assert.match(read(`../../client/src/components/${component}.tsx`), /\/api\/auth\/linkedin/);
    }
  });

  it("preserves unrelated Google authentication route definitions", () => {
    const auth = read("../replitAuth.ts");
    assert.match(auth, /\/api\/auth\/google/);
    assert.match(auth, /passport\.authenticate\('google'/);
  });

  it("moves Get Hired save directly to Documents and keeps manual fields and uploads", () => {
    const getHired = read("../../client/src/pages/GetHired.tsx");
    assert.match(getHired, /setCurrentStep\(3\)/);
    assert.doesNotMatch(getHired, /setCurrentStep\(2\)|TabsTrigger value="2"|TabsContent value="2"/);
    assert.match(getHired, /data-testid="button-save-profile"/);
    assert.match(getHired, /name="firstName"/);
    assert.match(getHired, /name="bio"/);
    assert.match(getHired, /toggleSkill\(skill\.name\)/);
    assert.match(getHired, /Resume Upload/);
    assert.match(getHired, /Video Introduction/);
  });

  it("retains resume import and a direct manual-onboarding skip without LinkedIn", () => {
    const onboarding = read("../../client/src/components/EnhancedProfileOnboarding.tsx");
    assert.match(onboarding, /<ResumeParser/);
    assert.match(onboarding, /data-testid="button-skip-import"/);
    assert.match(onboarding, /Skip Import & Fill Manually/);
    assert.match(onboarding, /setCurrentStep\(1\)/);
    assert.doesNotMatch(onboarding, /LinkedInImport|LinkedIn/);
  });

  it("allows 100% completion from manual profile fields without a LinkedIn connection", () => {
    const input = profileStrengthFromCandidate({
      profilePhotoUrl: "https://example.test/photo.jpg",
      fullName: "Manual Talent",
      headline: "Designer",
      summary: "A manually written profile.",
      email: "manual@example.test",
      location: "Manila",
      coreSkills: ["Design"],
      workHistory: [{ title: "Designer" }],
      education: [{ degree: "Design" }],
      preferences: { workSetup: "remote" },
      resumeUrl: "https://example.test/resume.pdf",
      linkedinUrl: null,
      portfolioUrl: "https://example.test/portfolio",
    });
    const items = buildCompletionItems(input);
    assert.equal(calcCompletionPct(items), 100);
    assert.equal(input.hasLinks, true);
  });
});