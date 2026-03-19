# Testing Guide

## Overview

This project includes unit tests, integration tests, and guidelines for manual testing.

---

## Unit Tests

### Normalization Tests

Test file: `src/shared/searchSchema.test.ts`

**What's tested:**
- Field normalization (types, ranges, truncation)
- Confidence score calculation
- URL sanitization
- Specification parsing

**Run:**
```bash
npm test
```

**Example test:**
```typescript
it('normalizeSearchResult should coerce price values', () => {
  const result = normalizeSearchResult({
    recommendations: [{
      price: '$99.99',  // String
      priceValue: 99.99,
    }]
  });
  
  expect(result.recommendations[0].priceValue).toBe(99.99);
  expect(typeof result.recommendations[0].priceValue).toBe('number');
});
```

---

## Integration Tests

### API Endpoint Tests

Test file: `src/server.test.ts`

**What's tested:**
- Health/diagnostics endpoints
- POST /api/search with various inputs
- POST /api/identify-product
- Error handling
- Rate limiting
- Caching behavior
- Response schema validation

**Run local server first:**
```bash
# Terminal 1: Start backend
npm run dev:server

# Terminal 2: Run tests
npm test -- src/server.test.ts
```

**Key test suites:**

1. **Health Checks**
   - `GET /` returns service info
   - `GET /health` returns ok status
   - `GET /metrics` returns metrics object
   - `GET /metrics/search` returns search metrics

2. **Search Endpoint**
   - Valid query returns recommendations
   - Response validates against schema
   - At least 3 recommendations when available
   - Best recommendation marked with isBest=true
   - bestReason field populated
   - Rate limiting triggers at 10+ requests

3. **Image Identification**
   - Identifies product from image URL
   - Handles missing/invalid images
   - Works with different regions

4. **Error Handling**
   - JSON responses (no HTML)
   - Proper error status codes
   - Input validation working

5. **Performance**
   - Cache hits are faster than cache misses
   - Search completes within 30 seconds
   - Response times logged

---

## Manual Testing

### Local Development

1. **Start both servers:**
```bash
# Terminal 1: Frontend (React)
npm run dev

# Terminal 2: Backend (Express)
npm run dev:server
```

2. **Open browser:**
```
http://localhost:5173/
```

### Test Scenarios

#### 1. Basic Search
- [ ] Search "Sony headphones"
- [ ] Select "Global" region
- [ ] Verify 5+ recommendations appear
- [ ] Verify ProgressStepper animates
- [ ] Verify bestReason displayed in top pick

#### 2. Regional Search
- [ ] Search "laptop" in "United States"
- [ ] Search same query in "United Kingdom"
- [ ] Verify results differ by region
- [ ] Check shipping info shows regional carriers

#### 3. Image Upload
- [ ] Upload screenshot of product
- [ ] Verify "Analyzing image..." appears
- [ ] Verify auto-search triggers
- [ ] Check preview image displays

#### 4. Filters
- [ ] Set Max Price to $500
- [ ] Verify cards over $500 hidden
- [ ] Select Store filter
- [ ] Verify only that store shows
- [ ] Set Min Rating to 4.5 stars
- [ ] Verify all shown have ≥4.5 rating

#### 5. Watchlist
- [ ] Click "Watch" on cards
- [ ] Verify heart glows
- [ ] Verify counter increments
- [ ] Click "Clear watchlist"
- [ ] Verify all unmarked

#### 6. View Modes
- [ ] Switch to "Compare" table view
- [ ] Verify products in table
- [ ] Click column header (e.g., "Price")
- [ ] Verify sorting Works (asc/desc)
- [ ] Switch back to "Cards" view

#### 7. Error Scenarios
- [ ] Disconnect internet, search
- [ ] Verify friendly error message (not HTML)
- [ ] Reconnect, retry search
- [ ] Search very niche product (unlikely results)
- [ ] Verify empty state message

#### 8. Rapid Searches
- [ ] Search "phone"
- [ ] Immediately search "laptop"
- [ ] Immediately search "headphones"
- [ ] Verify loading UI updates correctly
- [ ] Verify results replace properly

---

## Production Testing

### Vercel Frontend

```bash
# Test live deployment
open https://product-deal-finder.vercel.app
```

**Checklist:**
- [ ] Page loads in <3 seconds
- [ ] Search works
- [ ] Images load correctly
- [ ] Links open in new tab
- [ ] No console errors (F12 → Console)

### Render Backend

```bash
# Test health
curl https://product-deal-finder.onrender.com/health

# Test metrics
curl https://product-deal-finder.onrender.com/metrics

# Test search
curl -X POST https://product-deal-finder.onrender.com/api/search \
  -H "Content-Type: application/json" \
  -d '{"query":"laptop","region":"Global"}'
```

**Checklist:**
- [ ] /health returns 200
- [ ] /metrics returns valid JSON
- [ ] /api/search returns recommendations
- [ ] Response time <5 seconds

---

## Continuous Testing

### GitHub Actions (Future)

```yaml
# .github/workflows/test.yml
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm install
      - run: npm run lint
      - run: npm run build
      - run: npm test
```

---

## Test Coverage

Current coverage:
- Basic schema normalization: ✅ 100%
- API endpoints: ✅ ~80%
- Error handling: ✅ ~90%
- Analytics: ○ None yet

To improve coverage:
1. Add snapshot tests for card rendering
2. Add visual regression tests
3. Add E2E tests with Playwright/Cypress

---

## Performance Benchmarking

### Metrics to Track

```bash
# Get current metrics
curl https://product-deal-finder.onrender.com/metrics/search

# Expected values:
# - avgLatency: 2000-3000ms (Gemini API dependency)
# - successRate: >95%
# - emptyResultRate: <10%
```

### Load Testing

```bash
# Install ApacheBench (macOS)
brew install httpd

# Run load test (1000 requests, 10 concurrent)
ab -n 1000 -c 10 https://product-deal-finder.onrender.com/health
```

**Expected results:**
- Requests/sec: >100
- Avg time: <100ms (for /health)
- Error rate: 0%

---

## Debugging Tips

### Frontend Issues

**Problem**: Skeleton cards never disappear
```typescript
// Check loadingTimeoutsRef is being cleared
console.log(loadingTimeoutsRef.current); // Should be empty []
```

**Problem**: Search hangs
```typescript
// Check backend is running
curl http://localhost:4000/health
```

### Backend Issues

**Problem**: Rate limiting too strict
```bash
# Edit src/server.ts, search for MAX_REQUESTS
# Change from 10 to 20 for testing
```

**Problem**: Gemini API failing
```bash
# Check API key
echo $GEMINI_API_KEY

# Test API directly
curl https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=$GEMINI_API_KEY
```

---

## CI/CD Testing

### Pre-commit

```bash
npm run lint    # TypeScript check
npm run build   # Vite build
npm test        # Unit tests
```

### Pre-push

All of above, plus:

```bash
npm run dev:server &
npm test -- src/server.test.ts
```

---

## Automated Monitoring (Future)

Suggested services:
- **Sentry**: Error tracking
- **Vercel Analytics**: Frontend metrics
- **Render Logging**: Backend logs
- **UptimeRobot**: Health checks (every 5 min)
- **LogRocket**: Session replay for bugs

---

## Questions?

See [ARCHITECTURE.md](./ARCHITECTURE.md) for system overview or [API.md](./API.md) for endpoint details.
