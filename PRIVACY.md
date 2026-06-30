# Privacy Policy

**Open 4 Peer Review (O4PR) — OER Review Console Chrome Extension**

**Effective Date:** June 29, 2025 | **Last Updated:** June 29, 2025

---

## 1. Introduction

Open 4 Peer Review (O4PR) is a research and development project funded by the U.S. Department of Education, developed in partnership with Maricopa Community Colleges and Carnegie Mellon University's Open Learning Initiative (OLI). The project provides a structured, rubric-based peer review platform for Open Educational Resources (OER).

The OER Review Console is a Google Chrome extension (the "Extension") that enables reviewers to annotate OER content, submit rubric scores, and generate revision reports directly within the OLI Torus authoring environment. This Privacy Policy explains what data the Extension collects, why it is collected, how it is stored, and your rights as a user.

By installing and using the Extension, you agree to the practices described in this policy.

---

## 2. Who This Policy Applies To

This policy applies to all users of the OER Review Console Chrome Extension, including:

- OER reviewers participating in the O4PR pilot program at Maricopa Community Colleges
- OER authors whose content is subject to review
- Platform coordinators managing the review workflow
- Any user who installs the Extension after public release **[CHECK LATER — confirm public release date]**

During the initial pilot phase (**Maricopa Community Colleges, Summer 2025**), participation is limited to invited educators. After public release, this policy will apply to all Chrome Web Store users.

---

## 3. What Data We Collect

The Extension collects the following categories of data, as declared in the Chrome Web Store listing:

### 3.1 Personally Identifiable Information (PII)

We collect:

- Your email address and user ID, provided at login and used to associate your annotations and review scores with your account
- Your display name, if provided through the O4PR platform

Source: Provided directly by the user at login via the O4PR authentication system (Supabase Auth).

### 3.2 Authentication Information

We collect and locally store:

- Access tokens and refresh tokens issued by the O4PR authentication system (Supabase Auth)
- Token expiration timestamps

These credentials are stored in `chrome.storage.local` on your device. They are used to maintain your session and automatically refresh your login. Tokens are never shared with third parties.

### 3.3 Web History

The Extension reads URLs and page navigation events within the OLI Torus environment (`proton.oli.cmu.edu`) only. Specifically, we collect:

- Page URLs visited within the OLI Torus platform
- Timestamps of page visits

Purpose: To identify which OER page a reviewer is annotating and to anchor annotations to the correct page. The Extension does not collect browsing history outside the OLI Torus domain.

### 3.4 User Activity

The Extension monitors the following interactions within the OLI Torus environment:

- Text selections made on OER pages
- Clicks on annotation interface elements (e.g., rubric score selections, save buttons)
- Mouse position and scroll events, to the extent necessary for annotation anchoring

Purpose: To support pilot-phase interaction analytics and to provide reviewers with an accurate, context-aware annotation experience. Activity data is not used for advertising or sold to third parties.

### 3.5 Website Content

The Extension reads the text content of OLI Torus pages (DOM text nodes) to:

- Compute text-based annotation anchors (character offset, prefix, and suffix context) so annotations can survive minor page edits
- Display the in-page review panel and rubric console
- Generate revision report excerpts for OER authors

Additionally, the Extension may capture a screenshot of the visible tab (PNG) when a reviewer explicitly annotates a visual element (e.g., an image or diagram). Screenshots are uploaded to secure cloud storage and associated with the corresponding review record.

The Extension does not read or transmit content from any website other than `proton.oli.cmu.edu`.

---

## 4. Data We Do Not Collect

The Extension does NOT collect:

- Health or medical information
- Financial or payment information
- Personal communications (emails, texts, chat messages)
- Location data (GPS, IP address, or regional identifiers)
- Browsing history outside of `proton.oli.cmu.edu`
- Keystroke logging beyond text selections within the OLI Torus review workflow

---

## 5. How We Use Your Data

We use the collected data exclusively for the following purposes:

- **Authentication and session management:** PII and authentication tokens are used to log you in to the O4PR platform and OLI Torus, and to maintain a secure, persistent session.
- **Annotation anchoring:** Website content (text nodes, page URLs) is used to attach annotations to precise locations within an OER document.
- **Rubric-based review workflow:** User activity (text selections, score submissions) is saved to the O4PR database to build the structured review record.
- **Revision report generation:** Annotation content and rubric scores are compiled into AI-assisted revision cards and structured reports delivered to OER authors.
- **Pilot research analytics:** Aggregated interaction data (page visits, annotation timestamps, score patterns) is analyzed to evaluate the usability of the O4PR platform during the pilot phase. Data used in research analyses is de-identified where possible.

We do not use your data for advertising, profiling, or any commercial purpose unrelated to the O4PR peer review mission.

---

## 6. Data Storage and Retention

All data transmitted by the Extension is stored on O4PR's Supabase-hosted database and object storage infrastructure. Data is transmitted exclusively over HTTPS (TLS-encrypted connections).

**Local storage:** Authentication tokens are stored in `chrome.storage.local` on your device. Clearing your browser data or uninstalling the Extension will remove locally stored tokens.

**Cloud storage:** Annotations, rubric scores, review records, and screenshots are stored in O4PR's Supabase project (hosted in the United States).

**Retention period:** **[CHECK LATER — confirm with team]** User data is retained for up to **6 months** after the conclusion of the review session or pilot program, after which it is deleted or de-identified. If you wish to request earlier deletion, see Section 9.

Third-party processors: O4PR uses Supabase (supabase.com) as its database and storage provider. Supabase processes data on our behalf in accordance with its own privacy and security policies. We do not share your data with any other third-party services.

---

## 7. Chrome Permissions Declared in the Extension

The following Chrome API permissions are declared in the Extension manifest and are used solely as described:

- **activeTab:** Read the current tab's URL and inject the review panel into the active OLI Torus page.
- **tabs:** Read tab identifiers and window context needed for screenshot capture and navigation tracking within OLI Torus.
- **storage:** Store authentication tokens in `chrome.storage.local` on your local device.
- **scripting:** Inject the content script (review panel, annotation engine) into OLI Torus pages.
- **host_permissions (`https://proton.oli.cmu.edu/*`):** Restrict Extension activity exclusively to the OLI Torus domain. The Extension cannot activate on any other website.

---

## 8. Data Security

We implement the following measures to protect your data:

- All data is transmitted over HTTPS/TLS
- Authentication tokens are stored only in `chrome.storage.local` (not in cookies or localStorage accessible to web pages)
- Supabase row-level security (RLS) policies restrict data access so that users can only read and write their own review records
- Access tokens are automatically refreshed and expire after a limited time window

No system can guarantee absolute security. If you believe your account has been compromised, contact us immediately at the address in Section 11.

---

## 9. Your Rights and Choices

You have the following rights with respect to your data:

- **Access:** You may request a copy of the data we hold about you.
- **Correction:** You may request correction of inaccurate information.
- **Deletion:** You may request deletion of your account and associated data. Note that de-identified research data (aggregated analytics) may be retained as permitted by applicable law.
- **Withdrawal from pilot:** Pilot participants may withdraw at any time by uninstalling the Extension and notifying the research team. Withdrawal does not affect data already collected prior to withdrawal.

To exercise any of these rights, contact us at the address in Section 11.

---

## 10. Children's Privacy

The Extension is not directed to or intended for use by children under the age of 13. We do not knowingly collect personal information from children under 13. If you believe a child under 13 has used the Extension, please contact us so we can delete the relevant data.

---

## 11. Contact Information

For questions, data requests, or concerns about this Privacy Policy, contact:

**Project Team:** Open 4 Peer Review (O4PR) — Carnegie Mellon University METALS Capstone

**Email:** **[CHECK LATER — add project contact email]**

**Institutional Contact:** Carnegie Mellon University Human-Computer Interaction Institute, Pittsburgh, PA 15213

---

## 12. Changes to This Policy

We may update this Privacy Policy as the platform evolves (including upon public release of the Extension). We will post the updated policy at the URL registered in the Chrome Web Store and update the "Last Updated" date at the top of this document. Continued use of the Extension after any update constitutes acceptance of the revised policy.

---

## Appendix: Technical Implementation Summary

The following table summarizes the technical facts underlying this Privacy Policy, drawn from the Extension's source code (commit `8d814e5`, June 29, 2025, authored by Allison Dayton).

**Extension source — key files:**

- **`manifest.json`:** Declares MV3 permissions (`activeTab`, `tabs`, `storage`, `scripting`) and `host_permissions` restricted to `https://proton.oli.cmu.edu/*`
- **`background.ts` (Service Worker):** Handles Supabase Auth login/logout, automatic token refresh (60 s before expiry), tab screenshot capture via `chrome.tabs.captureVisibleTab()`, screenshot upload to Supabase Storage, and REST API reads/writes to `annotations`, `review_scores`, `rubric_items`, and `reviews` tables
- **`content.ts`:** Injects a Shadow DOM review panel (380 px, right-aligned) into OLI Torus pages; listens for text selection events; computes char-offset anchors (exact text, prefix, suffix); supports rubric scoring (Does Not Meet / Exemplifies / Exceeds) with 1.5 s debounce auto-save; highlights and navigates existing annotations
- **`types.ts`:** Defines `StoredAuth` (`access_token`, `refresh_token`, `user_id`, `email`, `expires_at`), `AnnotationRecord` (`review_id`, `rubric_item_id`, `anchor`, `body`, `tag`), `ReviewScoreRecord`, and `ReviewAssignment`
- **`popup.html` / `popup.ts`:** Extension popup showing login status (email), current review assignment name, and login/logout controls
- **Data endpoint:** `https://lbmyfqeqkpmohlumlkdg.supabase.co` (O4PR Supabase project, HTTPS only)
