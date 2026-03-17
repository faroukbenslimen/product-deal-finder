# Deal Finder Improvement Report

Date: March 14, 2026
Implementation status: Completed in current codebase update.

This document summarizes what is strong, what is risky, and what should be improved first.

## What Is Working Well

- The app has a clear and useful core feature: find where to buy products with pricing and service context.
- UX is strong for an MVP: loading states, filters, region selector, and card/table comparison are well thought out.
- Build and type-check pass successfully.

## Main Problems To Fix (Priority Order)

## 1) Critical: API Key Exposure in Frontend

Why this is bad:
- The Gemini API key is injected into client code and can be extracted by anyone using the app.
- This can lead to quota abuse and billing risk.

Where:
- vite.config.ts (process.env.GEMINI_API_KEY define injection)
- src/App.tsx (GoogleGenAI initialized in browser)

What to do:
- Move Gemini calls to a backend API route.
- Keep API key only on the server.
- Add server-side rate limiting and basic abuse protection.

## 2) Critical: AI Response Is Not Runtime-Validated

Why this is bad:
- JSON.parse alone does not guarantee shape correctness.
- If the model returns missing/incorrect fields, UI can break (for example arrays expected but missing).

Where:
- src/App.tsx (JSON.parse response and direct usage of rec.pros, rec.cons, specifications)

What to do:
- Add schema validation (for example Zod or custom runtime guards).
- Normalize data after validation with safe defaults:
  - pros: []
  - cons: []
  - specifications: []
  - url/domain/price fields sanitized

## 3) Important: Bundle Size Is Too Large

Why this is bad:
- Production JS chunk is around 624 KB minified.
- This hurts first load performance, especially on mobile or slow networks.

What to do:
- Move AI logic server-side (largest win).
- Consider lazy loading non-critical UI parts.
- Analyze bundle with a visualizer and split heavy code paths.

## 4) Important: Dependency/Architecture Drift

Why this is bad:
- express/dotenv and express type packages exist while current app runs as SPA.
- vite appears in both dependencies and devDependencies.
- This creates maintenance confusion and extra install overhead.

What to do:
- Remove unused runtime dependencies.
- Keep vite only in devDependencies.
- Align package list with current architecture.

## 5) Medium: Documentation and Branding Inconsistency

Why this is bad:
- Browser title is generic.
- Some docs/history mention old architecture/model choices in ways that can confuse future contributors.

What to do:
- Update index.html title and metadata to Deal Finder branding.
- Add a short Current Architecture section in README.
- Keep PROJECT_HISTORY entries clear about what is current vs historical.

## 6) Medium: Prompt Reliability Limits

Why this is risky:
- Prompt rules are extensive, but model output can still drift, hallucinate links, or return inconsistent structure.

What to do:
- Add stricter post-processing and score confidence per recommendation.
- Reject low-confidence/invalid entries before rendering.
- Keep fallback search behavior, but visibly label it as fallback.

## Recommended 7-Day Improvement Plan

Day 1-2
- Add backend endpoint for search.
- Remove key from frontend build injection.

Day 3
- Add runtime response validation and normalization.
- Add graceful error messages for invalid model output.

Day 4
- Clean package.json (remove unused deps, dedupe vite).
- Update README and architecture notes.

Day 5
- Bundle analysis + lazy loading where useful.

Day 6-7
- Add smoke tests for:
  - valid response path
  - malformed response path
  - empty recommendations path
  - region unavailable path

## Definition of Done for "Production-Ready v1"

- No secret keys exposed in browser bundle.
- All AI responses validated before UI render.
- Core flows covered by automated smoke tests.
- Bundle optimized to reasonable first-load size.
- Docs accurately describe current architecture.

## Bottom Line

The product direction is strong and the UI quality is already above average for an MVP.
The biggest blockers are security and robustness, not idea or design.
Fix the critical items first, and this can become a very solid production candidate.

## Completion Checklist

- [x] Moved Gemini calls to backend API route
- [x] Removed frontend API key injection
- [x] Added backend rate limiting
- [x] Added runtime response normalization
- [x] Added malformed/empty-path handling
- [x] Added fallback-link label in UI
- [x] Cleaned package dependency placement and scripts
- [x] Updated docs and branding text
- [x] Added smoke tests for key paths

## Next Improvements (Inspired by Find 1)

These are additional improvements to push quality, reliability, and UX further.

## 1) Add Strict Schema Validation Before Normalization

Why this helps:
- Normalization is good for resilience, but strict validation catches structurally bad AI output earlier.
- This makes server errors explicit and avoids silently accepting low-quality data.

What to do:
- Add a strict schema layer (for example Zod) in the API response pipeline.
- Validate required fields and types before normalization.
- Return clear validation errors for observability (without exposing internals to end users).

## 2) Add Recommendation Confidence Scoring

Why this helps:
- Not all AI results have equal quality.
- Confidence scoring improves trust and reduces irrelevant suggestions.

What to do:
- Score each recommendation based on:
  - exact query match strength
  - valid URL/domain presence
  - realistic price formatting/value
  - shipping and stock clarity
- Filter out low-confidence entries before sending to the UI.
- Optionally display confidence badges (High/Medium/Low).

## 3) Add Retry Logic for Invalid AI JSON

Why this helps:
- Some model responses fail formatting despite prompt constraints.
- A targeted retry can recover many failures automatically.

What to do:
- If parse fails, retry once with a stricter repair/reformat instruction.
- If retry fails, return a stable error object and log the failure reason.

## 4) Add Short-Term Search Caching

Why this helps:
- Repeated queries are common.
- Caching reduces latency, API cost, and quota pressure.

What to do:
- Cache by normalized key: query + region.
- Use TTL (for example 10-30 minutes).
- Add cache hit/miss counters in logs.

## 5) Add Dual Search Modes (Fast vs Accurate)

Why this helps:
- Different users want different tradeoffs.
- Fast mode improves responsiveness; accurate mode improves depth.

What to do:
- Keep current model as default "Fast".
- Add optional "Accurate" mode with stronger model/prompt strategy.
- Add a simple mode toggle in UI.

## 6) Expand Tests to API + UI Flow

Why this helps:
- Current smoke tests focus on normalization only.
- API and flow tests prevent real-world regressions.

What to do:
- Add endpoint tests for:
  - success path
  - invalid request body
  - rate limit 429
  - malformed model response
- Add one integration test for frontend search flow and error rendering.

## 7) Add Basic Observability Metrics

Why this helps:
- You can improve faster when you can measure failures and latency.

What to do:
- Track:
  - request latency
  - parse/validation failure rate
  - empty-result rate
  - quota/rate-limit errors
- Keep logs structured and concise for easier debugging.

## Suggested Implementation Order (Next Sprint)

Week 1
- Strict schema validation
- Retry logic for invalid JSON
- API endpoint tests

Week 2
- Confidence scoring + filtering
- Short-term caching
- Observability metrics

Week 3
- Fast/Accurate mode toggle
- Frontend integration tests
- Final tuning based on logs
