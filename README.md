# Deal Finder

AI-assisted product comparison that helps users find where to buy a product by comparing price, shipping, and service quality.

## Live Deployment

- Frontend (Vercel): https://product-deal-finder.vercel.app
- Backend (Render): https://product-deal-finder.onrender.com
- Backend health check: https://product-deal-finder.onrender.com/health
- API Docs: [docs/API.md](docs/API.md)
- Architecture: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Testing: [docs/TESTING.md](docs/TESTING.md)

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

- **Smart Product Comparison**: AI-powered search across 5-8 retailers per query
- **Region-Aware**: Filters results by shipping availability to selected country
- **Best Deal Recommendation**: AI-selected top pick with "Why this deal" explanation (bestReason)
- **Multi-Store Results**: Diverse sources (official stores + marketplaces + specialists)
- **Comparison Views**: Card layout or side-by-side table with sortable columns
- **Smart Filters**: Max price, specific store, minimum rating
- **Visual Search**: Upload image → AI identifies product → auto-searches
- **Responsive Design**: Mobile-first with Tailwind CSS 4
- **Loading UX**: 4-step progress stepper + skeleton placeholders
- **Price Trends**: Visual sparkline chart showing price volatility
- **Watchlist**: Save interesting deals for later
- **Fallback URLs**: Safe Google site-search when exact product link unavailable
- **API Monitoring**: `/metrics` endpoints for health checks and observability

## Environment Variables

Create a `.env` file in the project root:

```
GEMINI_API_KEY=your_api_key_here
PORT=4000
OPENROUTER_API_KEY=optional_fallback_key
OPENROUTER_MODEL=meta-llama/llama-3.1-8b-instruct:free
```

## Local Setup

Prerequisite: Node.js 18+

1. Clone the repository
2. Run `npm install`
3. Copy `.env.example` to `.env`
4. Add your `GEMINI_API_KEY` to `.env`
5. Run `npm run dev` (starts both Vite and Express)

## Scripts

- `npm run dev` - Start frontend (Vite) + backend (Express) dev servers
- `npm run dev:server` - Start Express API only (port 4000)
- `npm run dev:client` - Start Vite client only (port 5173)
- `npm run lint` - TypeScript type-check
- `npm run build` - Build production frontend
- `npm run preview` - Preview production build locally
- `npm test` - Run unit and integration tests

## API Endpoints

- `POST /api/search` - Search for products
   - Method: `POST`
   - Request body shape:

```json
{
   "query": "Sony WH-1000XM5",
   "region": "Global"
}
```

   - Response body shape:

```json
{
   "data": {
      "summary": "string",
      "detectedCurrency": "USD",
      "recommendations": [
         {
            "storeName": "string",
            "productName": "string",
            "price": "$299",
            "priceValue": 299,
            "currency": "USD",
            "domain": "example.com",
            "url": "https://example.com/product",
            "shippingInfo": "string",
            "ratingScore": 4.6,
            "reviewCount": 1024,
            "stockStatus": "In Stock",
            "pros": ["string"],
            "cons": ["string"],
            "specifications": [{ "feature": "string", "value": "string" }],
            "isBest": true,
            "bestReason": "string",
            "confidenceScore": 87,
            "imageUrl": "https://..."
         }
      ]
   }
}
```

- `POST /api/identify-product` - Identify product from image
   - Request body: `{ "image": base64DataUrl, "region": string }`
   - Returns: `{ "productName": string }`

- `GET /health` - API health status
   - Returns: `{ "status": "ok" }`

- `GET /metrics` - Overall request metrics
   - Returns: `{ "metrics": { totalRequests, successRate, avgResponseTime, ... } }`

- `GET /metrics/search` - Search-specific metrics
   - Returns: `{ "searchMetrics": { totalSearches, avgLatency, emptyResultRate, ... } }`

For detailed API reference, see [docs/API.md](docs/API.md).

## Analytics

Vercel Analytics client is integrated in `src/main.tsx`.

To view analytics data:
1. Open your Vercel project dashboard.
2. Go to Analytics.
3. Enable analytics for the project if prompted.
4. Open the live app and generate traffic.
5. Review visits, pages, and trends in dashboard.

## Testing

Run the full test suite:

```bash
npm run lint     # TypeScript check
npm run build    # Verify build succeeds
npm test         # Run unit + integration tests
```

**Test Coverage:**
- `src/shared/searchSchema.test.ts` - Schema normalization and validation
- `src/server.test.ts` - API endpoint behavior, error handling, caching

For detailed testing guide, see [docs/TESTING.md](docs/TESTING.md).

## Observability & Monitoring

The backend includes built-in observability:

```bash
# Check API health
curl https://product-deal-finder.onrender.com/health

# View overall metrics (total requests, success rate, avg latency)
curl https://product-deal-finder.onrender.com/metrics

# View search-specific metrics (searches, latency, empty rates)
curl https://product-deal-finder.onrender.com/metrics/search
```

**What's tracked:**
- Request count, success rate, error count
- Response times (min, max, average)
- Search success rate and empty result percentage
- Query caching behavior
- Rate limiting effectiveness

## Troubleshooting

- If Render root shows JSON, that is expected (API service).
- If search fails with 403 leaked key, rotate Gemini key and update Render `GEMINI_API_KEY`.
- If first request is slow, Render free tier cold start may be the cause.
- If local dev exits with `EADDRINUSE :::4000`, another process is already using port 4000. Stop the process and re-run `npm run dev`.
- `OPENROUTER_API_KEY is missing. Fallback provider is disabled.` is a warning only. Gemini search still works.

## Notes

- Regional shipping availability is AI-estimated and may be imperfect.
- For production, replace in-memory rate limiting with Redis or database-backed storage.
