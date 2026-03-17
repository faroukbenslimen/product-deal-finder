# Deal Finder - Project History & Documentation

## Current State (March 14, 2026)
- Gemini requests are handled by a server-side Express endpoint (`POST /api/search`).
- API key is no longer injected into frontend build config.
- AI responses are normalized at runtime before rendering.
- API endpoint uses in-memory rate limiting (10 requests/minute/IP).
- Smoke tests validate valid, malformed, empty, and region-unavailable response paths.

## Overview
Deal Finder is an AI-powered web application that helps users find the best places to buy products online. It uses the Google Gemini API with live web search capabilities to compare prices, shipping options, and customer service reputations across different retailers.

## Features Built
1. **AI Web Search**: Utilizes `gemini-2.5-flash` with the `googleSearch` tool to fetch real-time product data and perform fast product-comparison reasoning.
2. **Smart Comparison**: Analyzes search results to provide a "Top Recommendation" based on a balance of price and customer service.
3. **Region Selection**: Users can select from a comprehensive list of nearly 200 countries. The AI strictly enforces this constraint, ensuring stores are physically located in or ship to the selected region.
4. **Advanced Filtering**: Users can filter results by:
   - Max Price
   - Specific Store
   - Minimum Customer Service Rating (1-5 stars)
5. **Comparison Table**: Toggle between a standard card view and a side-by-side comparison table showing extracted product specifications.
6. **Dynamic Loading UI**: Displays real-time status updates (e.g., "Searching the web...", "Comparing prices...") while the AI processes the request.
7. **Strict URL Enforcement & Fallback**: The AI is programmed to provide exact product URLs. If an exact URL isn't found, it provides the store's domain, and the app automatically generates a safe Google site search link (`https://www.google.com/search?q=site:domain.com+query`) to prevent broken links.
8. **Diverse Retailer Discovery**: Actively searches for 5-8 retailers, prioritizing specialized regional stores and smaller, independent boutique shops with good reviews over just listing major marketplaces.
9. **Product Listing Prioritization**: Distinguishes between direct product listings and general category pages, ensuring users are directed to actionable "Add to Cart" pages.
10. **Empty State Handling**: Clearly informs the user if a product is completely unavailable in their selected region, rather than showing irrelevant global results.

## Development Journey / Changelog

* **Phase 1: Initial Setup**
  * Built the core search interface and integrated the Gemini API.
  * Created the structured JSON schema for recommendations (Store Name, Price, URL, Service Rating, Pros/Cons).

* **Phase 2: Speed & UX Improvements**
  * Switched the AI model to `gemini-3-flash-preview` for significantly faster response times.
  * Added dynamic loading text to improve the waiting experience.

* **Phase 3: Link Accuracy**
  * Addressed issues with generic homepage links and broken Amazon links.
  * Added strict prompt instructions forbidding the AI from guessing or hallucinating URLs.
  * Implemented a fallback mechanism: if the exact product URL isn't found, the AI generates a working search URL for that specific store.

* **Phase 4: Region Support**
  * Added a region dropdown initially with a few major regions, then expanded it to include all countries globally (`src/constants.ts`).
  * Updated the AI prompt to strictly enforce region constraints and handle cases where products are unavailable locally.

* **Phase 5: Filtering & Refinement**
  * Added client-side filtering for Max Price, Store, and Min Rating.
  * Added visual star ratings to the UI for quick scanning.

* **Phase 6: Advanced Reasoning & Precision**
  * Upgraded the AI model to `gemini-3.1-pro-preview` for better instruction following and complex reasoning.
  * Overhauled the URL system to use a "Domain Fallback" mechanism, generating safe Google site searches when exact product URLs are missing, completely eliminating broken links.
  * Added "Critical Diversity Instructions" to force the AI to find specialized regional retailers and smaller independent shops instead of just major marketplaces.
  * Added "Critical Product Match Instructions" to prioritize exact product listings over general category pages.

* **Phase 7: Architecture & Security Upgrades**
  * Migrated to a full-stack architecture (Express + Vite) to secure the Gemini API key on the server-side.
  * Implemented an in-memory rate limiter (max 10 requests per minute per IP) to prevent abuse and handle 429 errors gracefully in the UI.
  * Added a user-facing disclaimer regarding AI-estimated regional availability.
  * Cleaned up unused dependencies (removed `better-sqlite3`).

* **Phase 8: UI Enhancements**
  * Added a "Compare" view toggle to display a side-by-side comparison table of product specifications.
  * Updated the AI prompt to extract specific `productName` and 3-5 key `specifications` for each recommendation.
  * Polished the comparison table with custom scrollbars, sticky columns, hover states, and improved typography.
  * Fixed z-index layering issues between the sticky table headers and the main application navigation bar.
  * Transposed the comparison table (rows for products, columns for features) to eliminate awkward horizontal scrolling.
  * Dynamically expanded the application container width to utilize the full screen when in "Compare" view, preventing horizontal scrolling for the table.
  * Made the comparison table sortable by columns (Price, Rating, Product Name, and extracted specifications).

* **Phase 9: Security & Reliability Hardening (March 2026)**
  * Moved Gemini calls behind a server-side Express endpoint (`POST /api/search`).
  * Removed frontend API key injection and kept `GEMINI_API_KEY` server-side only.
  * Added in-memory request rate limiting (10 requests/minute/IP).
  * Added runtime response normalization to handle malformed model output safely.
  * Added smoke tests for valid, malformed, empty, and region-unavailable response paths.

## Tech Stack
* **Frontend**: React, TypeScript, Tailwind CSS, Motion (Framer Motion), Lucide React
* **AI**: Google Gen AI SDK (`@google/genai`)
