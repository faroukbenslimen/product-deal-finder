# Deal Finder

AI-assisted product comparison that helps users find where to buy a product by comparing price, shipping, and service quality.

## Live Deployment

- Frontend (Vercel): https://product-deal-finder.vercel.app
- Backend (Render): https://product-deal-finder.onrender.com
- Backend health check: https://product-deal-finder.onrender.com/health

Note:
- The Render URL is API-only and returns JSON status.
- The Vercel URL is the user-facing app.

## Current Architecture

- Frontend: React + TypeScript + Tailwind + Motion + Vite
- Backend: Express API server for Gemini calls
- AI integration: Google GenAI SDK with `googleSearch` tool
- Security model: Gemini key is server-side only
- Deployment: Vercel frontend + Render backend via `vercel.json` rewrite (`/api/*`)

## Features

- Region-aware product search across global and local retailers
- Card and table comparison views
- Filters for max price, store, and minimum rating
- URL fallback to safe site search when exact product URL is unavailable
- In-memory request rate limit on API endpoint
- Runtime response normalization before rendering
- Visual search (upload image -> identify product -> auto-search)
- Backend query caching for repeated requests

## Environment Variables

Create a `.env` file in the project root:

```
GEMINI_API_KEY=your_api_key_here
PORT=4000
OPENROUTER_API_KEY=optional_fallback_key
OPENROUTER_MODEL=meta-llama/llama-3.1-8b-instruct:free
```

## Run Locally

Prerequisite: Node.js 18+

1. Install dependencies:
   `npm install`
2. Start frontend + backend together:
   `npm run dev`
3. Open app:
   `http://localhost:3000`

## Scripts

- `npm run dev` starts API server and Vite dev server
- `npm run dev:server` starts Express API only
- `npm run dev:client` starts Vite client only
- `npm run lint` runs TypeScript type-check
- `npm run test` runs smoke tests
- `npm run build` builds production client
- `npm run preview` previews production build

## API Endpoint

- `POST /api/search`
  - Request body: `{ "query": string, "region": string }`
  - Success response: `{ "data": SearchResult }`
  - Error response: `{ "error": string }`

- `POST /api/identify-product`
   - Request body: `{ "image": base64DataUrlOrBase64, "region": string }`
   - Success response: `{ "productName": string }`
   - Error response: `{ "error": string }`

- `GET /health`
   - Success response: `{ "status": "ok" }`

## Analytics

Vercel Analytics client is integrated in `src/main.tsx`.

To view analytics data:
1. Open your Vercel project dashboard.
2. Go to Analytics.
3. Enable analytics for the project if prompted.
4. Open the live app and generate traffic.
5. Review visits, pages, and trends in dashboard.

## Troubleshooting

- If Render root shows JSON, that is expected (API service).
- If search fails with 403 leaked key, rotate Gemini key and update Render `GEMINI_API_KEY`.
- If first request is slow, Render free tier cold start may be the cause.
- If local dev exits with `EADDRINUSE :::4000`, another process is already using port 4000. Stop the process and re-run `npm run dev`.
- `OPENROUTER_API_KEY is missing. Fallback provider is disabled.` is a warning only. Gemini search still works.

## Notes

- Regional shipping availability is AI-estimated and may be imperfect.
- For production, replace in-memory rate limiting with Redis or database-backed storage.
