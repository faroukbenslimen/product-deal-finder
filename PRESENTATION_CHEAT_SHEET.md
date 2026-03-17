# Deal Finder Presentation Cheat Sheet

Date: March 17, 2026
Use this as a quick script before demos or when someone asks what was improved.

## 1-Minute Pitch

Deal Finder is an AI-assisted product comparison app.
Users enter a product and region, and the app returns where to buy it with price, shipping, rating, and pros/cons.

The biggest upgrade we made was moving AI calls from frontend to backend.
This protects the API key and gives us control over validation, retries, and filtering.

We also improved reliability by adding strict schema validation, retry logic for invalid AI JSON, and confidence scoring so weak results are filtered out.

Finally, we redesigned the results UI to be more compact and added a better link strategy:
primary links are now reliability-first, and direct product URLs are optional.

## 15-Second Summary

We made the app safer, more reliable, and easier to use.
- safer: key moved server-side
- more reliable: validation + retry + confidence filtering
- easier to use: compact cards, details modal, stronger link behavior

## Demo Flow (Fast)

1. Search a product with a region.
2. Show summary + filters + card/table toggle.
3. Open a recommendation and show details modal.
4. Click primary Open link and show that it consistently leads to useful store results.
5. If available, show Try Direct URL as secondary option.

## What Changed (Simple)

- Backend endpoint now handles Gemini requests.
- AI response must pass schema validation.
- Invalid JSON gets one repair retry.
- Recommendations get confidence scores and low-confidence filtering.
- Link generation uses reliable fallback strategy.
- UI cards are shorter; details moved to modal.
- Tests cover response handling and link logic.

## If Someone Asks “Why”

## Why backend instead of frontend AI calls?
Because API keys should not be exposed in browser code.

## Why validation if AI already follows prompt?
Prompts help, but AI output is still probabilistic. Validation prevents broken UI.

## Why not use only direct product links?
Direct links are often missing or weak. Reliable fallback search works more consistently.

## Why confidence scoring?
Not all AI recommendations are equal quality. Scoring helps remove weak results.

## Why shorter cards?
Users compare faster with compact summaries, then open full details only when needed.

## Known Limitations (Say Honestly)

- Gemini quota can temporarily block live search.
- Regional shipping accuracy is AI-estimated.
- Domain health tracking is in-memory (not persisted yet).
- No caching yet (next optimization step).

## Best Next Steps

1. Add short-term caching to reduce quota usage.
2. Add API integration tests for /api/search scenarios.
3. Add observability metrics for link quality and failure trends.
4. Add optional Fast vs Accurate mode.

## File Map (If You Need To Point At Code)

- Frontend UI/search: src/App.tsx
- Backend search API: server/index.ts
- Response normalization/scoring: src/shared/searchSchema.ts
- Link strategy helpers: src/utils/linkUtils.ts
- Tests: src/shared/searchSchema.test.ts and src/utils/linkUtils.test.ts
- Full detailed narrative: WORK_DONE_SUMMARY.md
