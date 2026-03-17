# Work Done Summary

Date: March 16, 2026
Project: Deal Finder

This file explains what was changed during the last work sessions, why those changes were made, and how to explain the project if someone asks about it.

## Big Picture

The project started as a frontend-heavy AI shopping app, but the main problems were:
- the Gemini API key was exposed in the browser
- AI responses could break the UI if the JSON was malformed
- links were often weak, missing, or unreliable
- cards were too tall and hard to scan
- some project files and docs were outdated or inconsistent

The work focused on making the app more secure, more stable, easier to use, and easier to explain.

## What We Changed

## 1. Moved AI calls to the backend

What changed:
- Gemini requests now go through an Express backend route instead of running directly in the browser.
- The frontend sends requests to `POST /api/search`.

Why:
- This protects the API key from being exposed in the client bundle.
- It gives one controlled place to handle retries, validation, rate limits, and future caching.

Main files:
- server/index.ts
- src/App.tsx
- vite.config.ts

How to explain it:
- "Before, the browser talked directly to Gemini. Now the frontend talks to our backend, and the backend talks to Gemini. That keeps the key private and makes the app easier to control."

## 2. Added runtime validation and safer parsing

What changed:
- The server validates model output with Zod.
- The frontend no longer assumes every response is valid JSON.
- The app handles empty responses, non-JSON responses, and invalid JSON more safely.

Why:
- AI output is not guaranteed to be perfect.
- Without validation, one malformed response can break rendering.

Main files:
- server/index.ts
- src/shared/searchSchema.ts
- src/App.tsx
- package.json

How to explain it:
- "We added a strict validation layer so AI output must match the shape we expect before it reaches the UI."

## 3. Added retry logic for bad AI JSON

What changed:
- If the first model response is invalid JSON, the backend retries once using a repair prompt.
- If the repair attempt still fails, the server returns a stable error.

Why:
- Models sometimes follow the prompt incorrectly.
- A retry recovers some failures automatically without the user seeing broken behavior.

Main file:
- server/index.ts

How to explain it:
- "If Gemini gives malformed JSON, we ask it once to repair the response before failing the request."

## 4. Added confidence scoring and filtering

What changed:
- Each recommendation now gets a confidence score and confidence level.
- Recommendations are filtered using a minimum confidence threshold.

How confidence is estimated:
- product name vs user query match
- presence of valid URL
- presence of domain
- realistic price value
- shipping info present
- stock info present
- rating score

Why:
- Not all AI results are equally trustworthy.
- This helps remove weaker recommendations before they reach the user.

Main files:
- src/shared/searchSchema.ts
- server/index.ts

How to explain it:
- "We score how trustworthy each result is and filter out low-confidence ones before rendering."

## 5. Improved link strategy

This was one of the biggest practical issues.

### Old problem
- AI sometimes returned no direct URL.
- Sometimes it returned invalid URLs.
- Sometimes the URL opened a homepage, search page, or blocked page instead of the product.

### What changed
- Reliable links now use a Google search fallback built from:
  - store domain
  - product name
  - store name
- Direct product URLs are only exposed as a secondary option when they are valid.
- Server-side URL quality scoring now down-ranks weak direct links.
- Domains with repeated weak link behavior are tracked and penalized.

Why:
- A reliable search result page is often more useful than a broken product link.
- This makes the main click path much more stable.

Main files:
- src/utils/linkUtils.ts
- src/utils/linkUtils.test.ts
- src/App.tsx
- server/index.ts

How to explain it:
- "We stopped trusting AI URLs blindly. The primary button now opens a reliable product search path, and direct URLs are only offered when they look valid."

## 6. Redesigned the result cards

### Old problem
- Cards were too long and hard to scan.
- Long price/shipping strings caused visual overflow.
- Missing images made the layout feel broken.

### What changed
- Added a real placeholder image fallback.
- Made cards shorter and more compact.
- Limited visible pros/cons in card view.
- Added a details modal for full information.
- Improved long text handling for price and shipping.

Why:
- The user needs quick comparison first, then deeper detail only when needed.

Main file:
- src/App.tsx

How to explain it:
- "We turned long result cards into compact summary cards and moved full details into a modal."

## 7. Added tests

What changed:
- Added tests for normalization and malformed AI output handling.
- Added tests for link generation and link reliability helpers.
- Added 40-fixture deterministic link tests across many products/domains.

Why:
- This protects against regressions as prompts, models, or link logic change.

Main files:
- src/shared/searchSchema.test.ts
- src/utils/linkUtils.test.ts
- vitest.config.ts

How to explain it:
- "We added tests around the risky parts: AI response handling and link generation."

## 8. Cleaned dependencies and project structure

What changed:
- Moved packages to correct dependency/devDependency sections.
- Added missing tooling like Vitest, concurrently, rimraf, and Zod.
- Removed temporary audit outputs and temporary audit script after use.
- Removed unnecessary generated build output from the repo.

Why:
- Cleaner setup is easier to maintain.
- Temporary files should not stay in the source tree.

Main files:
- package.json
- package-lock.json

How to explain it:
- "We cleaned the repo so it contains source, config, and tests only, not temporary artifacts."

## 9. Updated docs and branding

What changed:
- Updated README to describe the current architecture.
- Updated metadata and page title.
- Updated project history and improvements docs.
- Added this summary file.

Why:
- The docs should match the actual codebase.
- This makes handoff and project explanation easier.

Main files:
- README.md
- PROJECT_HISTORY.md
- IMPROVEMENTS.md
- index.html
- metadata.json
- WORK_DONE_SUMMARY.md

How to explain it:
- "We aligned the documentation with the real architecture and recent changes."

## Live Link Audit Findings

We also performed live auditing work on links.

What happened:
- A script was created to test many product-country combinations.
- Early runs showed that many direct links were weak or missing.
- Later runs were blocked by Gemini quota limits.

What we learned:
- The main issue was not only invalid URLs.
- A large part of the issue was missing URLs or URLs that pointed to non-product pages.
- This confirmed that reliable search fallback should be the default primary link strategy.

How to explain it:
- "We audited link quality and found that direct AI links are not reliable enough to be the main click path, so we changed the UX accordingly."

## Important Files To Know

If someone asks where the important logic is, use this list:

- Frontend search + UI: src/App.tsx
- Backend API + Gemini integration: server/index.ts
- Result normalization + confidence scoring: src/shared/searchSchema.ts
- Link generation logic: src/utils/linkUtils.ts
- Tests for response handling: src/shared/searchSchema.test.ts
- Tests for links: src/utils/linkUtils.test.ts
- Main project explanation: README.md
- Historical/project progress notes: PROJECT_HISTORY.md
- Improvement backlog: IMPROVEMENTS.md

## How To Explain The Project In 30 Seconds

"Deal Finder is an AI-assisted product comparison app. A user searches for a product and selects a region. The frontend sends the request to our backend, the backend queries Gemini with web search, validates and repairs the response if needed, scores the confidence of the results, and returns normalized recommendations. The UI shows compact comparison cards and table view, with a reliable search-based link strategy instead of blindly trusting AI-generated product URLs."

## How To Explain The Recent Improvements In 30 Seconds

"We improved the project in four main areas: security, reliability, UX, and link quality. We moved Gemini calls to the backend to protect the API key, added strict validation and retry logic for AI responses, redesigned the cards to be more compact and readable, and changed the link strategy so the main action always opens a dependable search path instead of often-broken direct URLs."

## Questions Someone May Ask You

### Why move Gemini to the backend?
Because API keys should not live in frontend code, and backend control lets us add validation, retries, rate limits, and future caching.

### Why not trust the direct product URL from AI?
Because the audit showed direct URLs are often missing, generic, blocked, or incorrect. A domain-targeted product search is more reliable as the primary path.

### Why use validation and normalization together?
Validation catches structurally invalid responses, and normalization makes partially valid data safe and consistent for the UI.

### Why add confidence scoring?
Because AI results vary in quality, and filtering weak results improves trust and reduces noise.

### Why make the cards shorter?
Because users need to compare results quickly. Full detail is still available in the modal.

## Current Limitations

Be ready to say these clearly:
- Gemini quota can still block live search requests.
- Regional shipping availability is AI-estimated, not guaranteed.
- Direct product links are still imperfect, which is why fallback search is primary.
- Domain health tracking is currently in-memory only, not persisted.
- We do not yet have caching, user accounts, or saved searches.

## Good Next Steps

If someone asks what should come next, the best answers are:
- add short-term caching to reduce quota usage
- add API endpoint tests and possibly integration tests for the UI flow
- add observability/debug output for domain health and link quality
- later, add visual search or saved searches based on the roadmap

## Final Summary

The last work sessions moved the app from a promising prototype toward a more production-minded product.

The biggest improvements were:
- secure backend-based AI architecture
- safer AI response handling
- confidence-based result filtering
- much better link reliability strategy
- cleaner, more usable result cards
- stronger test coverage

If someone asks what changed, the short answer is:
"We made the app safer, more reliable, and easier to use, especially around AI response handling and product links."