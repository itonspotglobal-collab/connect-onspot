---
name: Contract authoring policy
description: Owner requirements for template-based authoring layered onto existing contract and MSA signing.
---

Template generation and editing must produce ordinary versioned PDFs for the existing signing flows, not replace those flows. Continue supporting uploaded PDFs, document-hash binding, review-before-sign, immutable sent versions, audit events, notifications and legacy MSA signatures.

**Why:** The owner explicitly requested “extend, don't replace”; the missing capability is authoring, not a new signing or activation system.

**How to apply:** Freeze rendered content before send. Revisions must create new document versions without carrying signatures forward.

Generated agreements must be rendered and reviewed as the exact PDF before sending, rather than silently rendering unseen bytes inside the send action. Draft edits and source refreshes invalidate that PDF review.

**Why:** The existing signing flow binds preparer review to a specific document hash; an HTML preview is not a review of the generated PDF's pagination and complete contents.

**How to apply:** Preserve the Generate PDF → Review PDF → Send sequence. A source snapshot may change only through an explicit reviewed refresh, while manual overrides survive.

Legal party identity is separate from public profile identity. Talent contract addresses and legal names are private owner data, not public/discovery fields. Keep legal names separate from display names, do not infer legal addresses from free-text locations, and collect at most an optional four-digit tax-ID suffix. Never collect payment card or bank-account details in these forms.

**Why:** These fields exist for agreements; adding structured identity must not weaken existing Client-facing privacy or expose financial credentials.

**How to apply:** Resolve private values server-side only under contract authority. Ordinary candidate/profile/discovery DTOs must stay private-field-free; authorized owners use dedicated private reads.

The requested MSA template must use approved current OnSpot wording, excluding the ACH/credit-card authorization page. Do not invent missing legal text or OnSpot receiving/account details.

**Why:** Templates are legal documents, not sample marketing content.

**How to apply:** Obtain the authoritative document if its wording cannot be read from existing approved sources.

The owner approved omitting legacy receiving-bank instructions from the imported template, in addition to the separate ACH/card authorization page. Keep the original uploaded MSA and historical signatures unchanged; the converted authoring template must begin as a draft requiring fresh review.

**Why:** The current approved source includes legacy bank details and ACH instructions, whereas the authoring request forbids collecting bank/card credentials. Omission was explicitly approved rather than replaced with invented legal terms.

**How to apply:** Preserve remaining approved wording and audit its source hash. Never treat the source PDF's approval as approval of the converted or subsequently edited template.

An additional OnSpot MSA countersignature defaults to non-blocking for activation unless the owner explicitly changes that policy. This does not relax mandatory OnSpot signatures on hiring contracts.

**Why:** The owner distinguished the new MSA countersign step from existing hiring-contract execution requirements.

**How to apply:** Preserve existing activation and legacy-MSA validity while discussing the MSA countersignature stage.

Activating template-based per-client MSAs must not invalidate Clients' previously signed shared MSAs, including approved offline signature evidence. A freshly prepared draft also leaves the currently issued agreement in force.

**Why:** Authoring rollout is not authorization to require every existing Client to sign again. Only explicit issuance of a personalized replacement starts a new signature requirement; signatures never transfer to it.

**How to apply:** Keep signed legacy documents usable during the transition. Unsigned Clients need a personalized issued agreement when the MSA template is active; never present an unfilled shared source as their new agreement.

Executed copies must not guess signature positions in uploaded or older PDFs. Preserve their original pages and use clearly labelled additional signature pages when no reserved blocks exist.

**Why:** Automatically placing signatures over arbitrary uploaded legal text can obscure or appear to modify agreed terms. Generated agreements may reserve explicit blocks before anyone signs.

**How to apply:** Always keep original bytes and hash unchanged, bind the derived copy to real recorded signatures, and append the audit record. An activation exception is never permission to fabricate execution.

Check the actual glyphs in executed legal PDFs, not just successful generation. A font can accept Unicode text but silently render missing characters as blank.

**Why:** The signing regression test exposed missing non-Latin legal names despite successful PDF generation. Database evidence alone does not make the executed copy readable.

**How to apply:** Bundle deployable font coverage rather than relying on host fonts; fail explicitly for unsupported characters instead of silently removing or transliterating names in signature blocks.
