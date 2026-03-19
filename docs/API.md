# API Reference

## Base URL

- **Development**: `http://localhost:4000`
- **Production**: `https://product-deal-finder.onrender.com`
- **Frontend Proxy**: `https://product-deal-finder.vercel.app/api/*`

## Authentication

No API key required for public endpoints. All requests must include:

```
Content-Type: application/json
```

## Endpoints

### Health & Diagnostics

#### GET /health
Returns API health status.

**Response** (200 OK)
```json
{
  "status": "ok"
}
```

#### GET /
Returns service information and usage instructions.

**Response** (200 OK)
```json
{
  "service": "product-deal-finder-api",
  "status": "ok",
  "message": "Backend is running. Use POST /api/search or POST /api/identify-product."
}
```

#### GET /metrics
Returns overall request metrics.

**Response** (200 OK)
```json
{
  "metrics": {
    "totalRequests": 1250,
    "successCount": 1210,
    "errorCount": 40,
    "successRate": "96.80",
    "avgResponseTime": "2456.32",
    "recentMetrics": [
      {
        "method": "POST",
        "path": "/api/search",
        "responseTime": 2500,
        "statusCode": 200,
        "success": true
      }
    ]
  }
}
```

#### GET /metrics/search
Returns search-specific metrics.

**Response** (200 OK)
```json
{
  "searchMetrics": {
    "totalSearches": 456,
    "avgLatency": "2300.50",
    "successRate": "98.24",
    "emptyResultRate": "5.70"
  }
}
```

---

### Search for Products

#### POST /api/search
Search for the best places to buy a product.

**Request Body**
```json
{
  "query": "Sony WH-1000XM5 headphones",
  "region": "United States"
}
```

**Request Fields**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `query` | string | Yes | Product search term (e.g., "laptop", "iPhone 15") |
| `region` | string | Yes | Country/region name (e.g., "Global", "United States", "United Kingdom") |

**Response** (200 OK)
```json
{
  "data": {
    "recommendations": [
      {
        "storeName": "Amazon",
        "productName": "Sony WH-1000XM5 Wireless Headphones",
        "price": "$348.99",
        "priceValue": 348.99,
        "url": "https://amazon.com/Sony-WH-1000XM5/dp/B09YLQXF00",
        "domain": "amazon.com",
        "serviceRating": "Excellent - Fast shipping, easy returns",
        "ratingScore": 4.8,
        "isBest": true,
        "bestReason": "Best price with Prime shipping, excellent customer reviews",
        "imageUrl": "https://images-na.ssl-images-amazon.com/...",
        "stockStatus": "In Stock",
        "shippingInfo": "Free 2-day Prime shipping",
        "pros": [
          "Excellent noise cancellation",
          "30-hour battery life",
          "Comfortable over long periods"
        ],
        "cons": [
          "High price point",
          "No 3.5mm option"
        ],
        "specifications": [
          {
            "feature": "Driver Size",
            "value": "40mm"
          },
          {
            "feature": "Frequency Range",
            "value": "4Hz - 24kHz"
          }
        ],
        "confidenceScore": 92,
        "confidenceLevel": "high"
      }
    ],
    "summary": "Found 5 top retailers selling Sony WH-1000XM5 headphones in the United States. Amazon offers the best value with Prime shipping, while BestBuy and Walmart also have competitive pricing."
  }
}
```

**Response Fields**

| Field | Type | Description |
|-------|------|-------------|
| `storeName` | string | Retailer name |
| `productName` | string | Specific product name/model |
| `price` | string | Formatted price (e.g., "$99.99") |
| `priceValue` | number | Numeric price for sorting |
| `url` | string | Direct product link (empty if not found) |
| `domain` | string | Store domain (e.g., "amazon.com") |
| `serviceRating` | string | Merchant satisfaction description |
| `ratingScore` | number | Rating 0-5 |
| `isBest` | boolean | AI-selected best recommendation |
| `bestReason` | string | Why this deal is recommended |
| `imageUrl` | string | Product image URL |
| `stockStatus` | string | Availability (e.g., "In Stock") |
| `shippingInfo` | string | Shipping details |
| `pros` | array | List of deal advantages |
| `cons` | array | List of drawbacks |
| `specifications` | array | Product features |
| `confidenceScore` | number | 0-100 confidence percentage |
| `confidenceLevel` | string | "low", "medium", or "high" |

**Error Responses**

| Status | Error | Description |
|--------|-------|-------------|
| 400 | Invalid request | Missing query or region |
| 429 | Too many requests | Rate limited (max 10 req/min per IP) |
| 500 | Server error | Gemini API error or internal failure |

**Example Error Response** (429)
```json
{
  "error": "Too many searches. Please wait a moment and try again."
}
```

---

### Identify Product from Image

#### POST /api/identify-product
Identify a product from an image and optionally search for it.

**Request Body**
```json
{
  "image": "data:image/jpeg;base64,/9j/4AAQSkZ...",
  "region": "Global"
}
```

**Request Fields**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `image` | string | Yes | Base64-encoded image data URI (max 5MB) |
| `region` | string | Yes | Country/region for search |

**Response** (200 OK)
```json
{
  "productName": "Samsung Galaxy S23 Ultra",
  "confidence": 0.95
}
```

**Response Fields**
| Field | Type | Description |
|-------|------|-------------|
| `productName` | string | Identified product name |
| `confidence` | number | 0-1 confidence score |

**Error Responses**

| Status | Error | Description |
|--------|-------|-------------|
| 400 | Invalid image | Image too large or invalid format |
| 500 | Identification failed | Vision model error |

---

## Common Regions

Full list in [`src/constants.ts`](../src/constants.ts). Popular regions:

- "Global" - Unrestricted worldwide search
- "United States"
- "United Kingdom"
- "Canada"
- "Australia"
- "Germany"
- "France"
- "India"
- "Japan"

---

## Rate Limiting

- **Limit**: 10 requests per minute per IP
- **Headers**: Response includes:
  ```
  X-RateLimit-Limit: 10
  X-RateLimit-Remaining: 7
  X-RateLimit-Reset: 1234567890
  ```
- **Exceeded**: Returns `429 Too Many Requests`

---

## Caching

Identical queries are cached for 6 hours. Cache key format:

```
${query.toLowerCase()}:${region}
```

Example: `"sony headphones:global"` 

To bypass cache (development only), modify the query slightly.

---

## Response Format

All responses return JSON:

```json
{
  "data": { /* response payload */ },
  "error": null
}
```

Or on error:

```json
{
  "data": null,
  "error": "Error message"
}
```

---

## Best Practices

### 1. Search Queries
- Be specific: "Sony WH-1000XM5" not just "headphones"
- Include brand/model for better results
- Use region filter to avoid irrelevant results

### 2. Handling Responses
- Always check `status === 200` before processing
- Handle empty recommendation arrays gracefully
- Use `isBest === true` to highlight top pick

### 3. Error Handling
- Retry on `5xx` errors with exponential backoff
- Don't retry `4xx` errors (input validation failed)
- Show user-friendly message for `429` rate limit

### 4. Performance
- Cache search results client-side (at least 5 mins)
- Batch multiple searches if possible
- Use `/metrics` endpoint to monitor API health

---

## Example Implementations

### cURL
```bash
curl -X POST https://product-deal-finder.onrender.com/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "iPhone 15",
    "region": "United States"
  }'
```

### JavaScript/Fetch
```javascript
async function searchProducts(query, region) {
  const response = await fetch('/api/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, region })
  });

  const { data, error } = await response.json();
  if (error) throw new Error(error);
  return data.recommendations;
}

const results = await searchProducts('laptop', 'Global');
console.log(results[0]); // Best recommendation
```

### Python/Requests
```python
import requests

response = requests.post(
  'https://product-deal-finder.onrender.com/api/search',
  json={'query': 'gaming mouse', 'region': 'United States'}
)

data = response.json()['data']
for rec in data['recommendations']:
    print(f"{rec['storeName']}: {rec['price']}")
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| 429 Rate Limited | Wait 60 seconds, retry |
| Empty results | Try broader query, use "Global" region |
| HTML error page | Backend crashed, try again in 30s |
| High latency | Gemini API busy, retry with exponential backoff |
| Image too large | Resize to <5MB, compress quality |

---

## Support

For issues or questions:
- GitHub: [product-deal-finder](https://github.com/faroukbenslimen/product-deal-finder)
- Issues: Create a GitHub issue with API response samples
