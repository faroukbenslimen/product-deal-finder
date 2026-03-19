# Architecture & Design Overview

## System Overview

Product Deal Finder is a full-stack web application that uses AI to compare product prices across multiple retailers. It consists of:

- **Frontend**: React + TypeScript on Vercel
- **Backend**: Express.js + Node.js on Render
- **AI Engine**: Google Gemini 2.5 Flash with web search
- **Deployment**: Vercel (frontend) + Render (backend with cold-start optimization)

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER BROWSER                             │
│                    (Chrome, Safari, Firefox)                     │
└──────────────┬──────────────────────────────────────────────────┘
               │
               │ HTTPS
               │
┌──────────────┴──────────────────────────────────────────────────┐
│                    VERCEL FRONTEND                               │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ React 19 + TypeScript + Tailwind CSS                     │   │
│  │  - src/App.tsx (main search container)                   │   │
│  │  - src/components/* (reusable UI components)             │   │
│  │  - src/analytics.ts (event tracking)                     │   │
│  └──────────────────────────────────────────────────────────┘   │
│                          │                                       │
│    Rewrites /api/* to backend                                   │
│    (vercel.json)                                                │
│                          │                                       │
└──────────────┬───────────┴──────────────────────────────────────┘
               │
               │ HTTPS
               │
┌──────────────┴──────────────────────────────────────────────────┐
│              RENDER BACKEND (Node.js/Express)                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ src/server.ts - Main Entry Point                        │   │
│  │  ├─ CORS Middleware (Vercel origin allow)               │   │
│  │  ├─ Observability Middleware (metrics collection)       │   │
│  │  ├─ Rate Limiter (10 req/min per IP)                    │   │
│  │  ├─ Query Caching (6hr TTL, LRU eviction)               │   │
│  │  └─ Error Handler (JSON-only responses)                 │   │
│  │                                                           │   │
│  │ POST /api/search                                         │   │
│  │  ├─ Validate input (region, query)                      │   │
│  │  ├─ Check cache (LRU store)                             │   │
│  │  ├─ Call Gemini API (web search enabled)                │   │
│  │  ├─ Parse & normalize response                          │   │
│  │  ├─ Apply confidence filtering                          │   │
│  │  └─ Return normalized JSON                              │   │
│  │                                                           │   │
│  │ POST /api/identify-product                              │   │
│  │  ├─ Validate base64 image                               │   │
│  │  ├─ Call Gemini API (vision)                            │   │
│  │  └─ Extract product name                                │   │
│  │                                                           │   │
│  │ GET /health, /metrics, /metrics/search                  │   │
│  │  └─ Diagnostics endpoints                               │   │
│  └──────────────────────────────────────────────────────────┘   │
│                          │                                       │
│    API Key: GEMINI_API_KEY (env var, never exposed)             │
│                          │                                       │
└──────────────┬───────────┴──────────────────────────────────────┘
               │
               │ HTTPS
               │
        ┌──────┴──────┐
        │             │
    ┌───▼────┐   ┌───▼──────────────┐
    │ Gemini │   │ Google Search    │
    │  API   │◄──┤ (enabled in      │
    └────────┘   │  model config)   │
                 └──────────────────┘
```

## Directory Structure

```
product-deal-finder/
├── src/
│   ├── server.ts                    # Express server & API endpoints
│   ├── main.tsx                     # React entry point
│   ├── App.tsx                      # Main search & results component
│   ├── index.css                    # Global styles
│   ├── constants.ts                 # Country/region list
│   ├── analytics.ts                 # Frontend event tracking
│   │
│   ├── components/
│   │   ├── ProgressStepper.tsx      # 4-step loading indicator
│   │   └── SkeletonCard.tsx         # Loading placeholder
│   │
│   ├── shared/
│   │   ├── searchSchema.ts          # TypeScript interfaces & validation
│   │   ├── errorHandling.ts         # Error classification
│   │   └── searchSchema.test.ts     # Schema tests
│   │
│   ├── utils/
│   │   ├── logger.ts                # Structured logging
│   │   ├── linkUtils.ts             # URL generation & validation
│   │   └── [other utilities]
│   │
│   └── middleware/
│       └── observability.ts         # Request metrics tracking
│
├── server/
│   └── index.ts                     # Legacy shim (imports src/server.ts)
│
├── docs/
│   ├── ARCHITECTURE.md              # This file
│   ├── API.md                       # API reference
│   └── TESTING.md                   # Testing guide
│
├── vite.config.ts                   # Vite bundler config
├── tsconfig.json                    # TypeScript config
├── package.json                     # Dependencies & scripts
├── vercel.json                      # Vercel deployment config
├── index.html                       # HTML entry point
├── README.md                        # User-facing docs
└── ROADMAP.md                       # Project roadmap
```

## Data Flow

### Search Request Flow

1. **User Input** → Enter search query + select region
2. **Frontend Validation** → Check query not empty, region valid
3. **Show Loading UI** → ProgressStepper + SkeletonCards appear
4. **Start Timers** → Progress advances at 500ms, 2000ms, 4000ms
5. **POST /api/search** → Send query + region to backend

6. **Backend Processing**:
   - Check rate limit (10 req/min/IP)
   - Check cache (query + region key)
   - If cache miss:
     - Build Gemini prompt with region context
     - Call Gemini API (web search enabled)
     - Extract JSON from response (handles noisy output)
     - Normalize fields (coerce types, sanitize)
     - Filter by confidence score (40%, fallback to 20%)
   - Return normalized SearchResult JSON

7. **Frontend Receives Response** → Hide loading UI, show results
8. **Display Cards** → Map recommendations to card components
9. **User Interaction**:
   - Click "View Deal" → Open product URL in new tab
   - Add to Watchlist → Track locally in state
   - Switch to Compare View → Show table with sorting
   - Apply Filters → Max price, store, rating

### Image Upload Flow

1. **User selects image** → Read as base64
2. **Show preview + loading state**
3. **POST /api/identify-product** → Send base64 + region
4. **Backend**:
   - Validate image size (<5MB)
   - Call Gemini API with vision (extract product name)
5. **Auto-search** → Use extracted name as new search query
6. **Show results** → Same as text search

## Key Components

### Frontend (React)

**App.tsx** (≈1000 lines)
- State: `query`, `region`, `results`, `loading`, `filters`, `watchlist`
- Functions: `handleSearch()`, `handleImageUpload()`, `handleFilter()`
- Renders: Search form, filters, card grid/table, modals

**ProgressStepper.tsx**
- Props: `activeStep` (0-4)
- Status: "Searching web" → "Comparing prices" → "Analyzing reviews" → "Finalizing"
- Animation: Motion.div with opacity + color transitions

**SkeletonCard.tsx**
- Pulse animation placeholder matching card layout
- 5 cards shown during loading

### Backend (Express)

**server.ts** (≈800 lines)
- `buildPrompt()` → Constructs Gemini system prompt with region/diversity constraints
- `buildRepairPrompt()` → Asks AI to fix malformed JSON
- `extractFirstJsonObject()` → Finds valid JSON in noisy responses (brace-depth tracking)
- `coerceModelPayload()` → Normalizes fields (types, ranges, fallbacks)
- `parseAndValidateModelResponse()` → Tries raw text, then extracted JSON

**Middleware Stack**:
1. CORS - Allow Vercel + Render origins
2. JSON parser - Limit 1MB
3. Observability - Track timing/status
4. Rate limiter - 10 req/min per IP
5. Cache - 6-hour TTL
6. Error handler - Ensure JSON responses

## Performance Optimizations

### Caching

- **Query Cache**: LRU store (500 max entries, 6hr TTL)
- **Key Format**: `${query.toLowerCase()}:${region}`
- **Hit Rate**: ≈40-50% for repeated searches

### Frontend

- **Lazy Loading**: Components code-split via Vite
- **Animation**: Framer Motion with reduced motion support
- **Network**: POST requests compressed via gzip
- **Bundle**: ≈378 KB (117 KB gzip)

### Backend

- **Response Time**: Avg 2-5 seconds (Gemini latency + web search)
- **Memory**: In-memory store (avoid database for speed)
- **Rendering**: Streamed JSON responses (no buffering)

## Error Handling

### Client Errors (4xx)

- Malformed JSON → Try repair prompt
- Rate limited → "Too many searches. Please wait..."
- Bad region → "Invalid region selected"

### Server Errors (5xx)

- Gemini API down → "Service temporarily unavailable"
- Rate limit at Gemini → Retry with backoff
- Missing results → "No stores found in {region}"

### HTML Leaks

- Prevented via global error middleware → Always return JSON
- CORS errors hidden (callback doesn't throw)

## Observability

### Logs

- **Format**: JSON (timestamp, level, message, context)
- **Transport**: stdout (Render captures to dashboard)

### Metrics

- **GET /metrics** → Overall request stats (total, success, avg latency)
- **GET /metrics/search** → Search-specific metrics (count, latency, empty %)
- **In-Memory Store**: Last 1000 requests

### Analytics

- **Frontend**: Event tracking via `src/analytics.ts`
- **Events**: `search`, `deal_click`, `watchlist_action`, `filter_used`
- **Batching**: Flush every 10 events or on page exit

## Security Considerations

- **API Key**: Server-side only (GEMINI_API_KEY never in frontend)
- **CORS**: Whitelist Vercel + preview domains
- **Input Validation**: Zod schemas for requests
- **Rate Limiting**: IP-based, prevents brute force
- **XSS Prevention**: React escaping + sanitized URLs

## Testing

### Unit Tests

- `src/shared/searchSchema.test.ts` → Normalization logic

### Integration Tests

- `src/server.test.ts` → API endpoint behavior
- Run: `npm test`

### Manual Testing

- Local: `npm run dev:server` + `npm run dev` (separate terminals)
- Production: Test via https://product-deal-finder.vercel.app

## Deployment

### Frontend (Vercel)

- Builds on push to `main`
- Environment: Node 20.x
- Build Output: `/dist` (Vite output)
- Rewrites: `/api/*` → Render backend

### Backend (Render)

- Deploys on GitHub push
- Environment: Node 20.x
- Build: `npm install`
- Start: `node src/server.ts`
- Environment Vars: `GEMINI_API_KEY`, `PORT`, `NODE_ENV`

### Monitoring

- **Vercel**: Dashboard analytics (page loads, errors)
- **Render**: Log viewer + Metrics tab
- **Custom**: `/metrics` endpoint for health checks

## Future Improvements

- [ ] Database for query history & metrics
- [ ] User accounts + saved searches
- [ ] Affiliate integrations (Amazon, eBay links)
- [ ] Direct API integrations for major stores
- [ ] WebSocket for real-time price updates
- [ ] Admin dashboard for monitoring
