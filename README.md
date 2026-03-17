# Deal Finder

AI-assisted product comparison that helps users find where to buy a product by comparing price, shipping, and service quality.

## Current Architecture

- Frontend: React + TypeScript + Tailwind + Motion + Vite
- Backend: Express API server for Gemini calls
- AI integration: Google GenAI SDK with `googleSearch` tool
- Security model: Gemini key is server-side only

## Features

- Region-aware product search across global and local retailers
- Card and table comparison views
- Filters for max price, store, and minimum rating
- URL fallback to safe site search when exact product URL is unavailable
- In-memory request rate limit on API endpoint
- Runtime response normalization before rendering

## Environment Variables

Create a `.env` file in the project root:

```
GEMINI_API_KEY=your_api_key_here
PORT=8787
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

## Notes

- Regional shipping availability is AI-estimated and may be imperfect.
- For production, replace in-memory rate limiting with Redis or database-backed storage.
