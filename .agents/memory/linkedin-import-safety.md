---
name: LinkedIn profile import safety
description: MVP import prohibition, preserved sign-in/manual URLs, and historical cleanup limits.
---

LinkedIn sign-in and manually entered LinkedIn URLs are legitimate separate features. Do not reintroduce profile connect/import UI until a real provider-backed import exists; never simulate a successful import into a Talent profile.

**Why:** The owner explicitly requested an MVP safety fix after the former import generated placeholder identity/profile/skill data while presenting it as LinkedIn-derived information. This was not authorization to build OAuth, scrape LinkedIn, or remove sign-in.

**How to apply:** Preserve the authentication and manual-URL paths. Any unavailable profile-import endpoint must return non-success without reading or writing profile/skill data, and users must still be able to complete onboarding manually.

Historical cleanup requires separate review and explicit approval; no bulk cleanup is authorized by the import-disablement request.

**Why:** The former simulated import had no trusted origin/audit marker on affected profile fields. A matching placeholder name, skill, URL, or verification flag is not sufficient proof of corruption.

**How to apply:** Do not delete or overwrite profile data based on matching sample values. Document candidate evidence separately and obtain approval before any repair.