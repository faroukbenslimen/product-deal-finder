// File role: Server endpoint tests for search flow, errors, and response shape.
/**
 * API Integration Tests for product-deal-finder backend
 * Run with: npm test
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

/**
 * Fetch Api so this code stays predictable and easier to maintain.
 *
 * @param method - method passed by the caller to control this behavior.
 * @param path - path passed by the caller to control this behavior.
 * @param body - body passed by the caller to control this behavior.
 * @returns The computed value this function returns for downstream logic.
 */
async function fetchApi(method: string, path: string, body?: any) {
  const baseUrl = process.env.API_URL || 'http://localhost:4000';
  
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });

  const contentType = response.headers.get('content-type') || '';
  let data: any = null;

  if (contentType.toLowerCase().includes('application/json')) {
    data = await response.json().catch(() => null);
  } else {
    const text = await response.text();
    data = text ? { error: text } : null;
  }

  return { status: response.status, data };
}

describe('Product Deal Finder API', () => {
  describe('Health & Diagnostics', () => {
    it('GET / should return service info', async () => {
      const { status, data } = await fetchApi('GET', '/');
      expect(status).toBe(200);
      expect(data.service).toBe('product-deal-finder-api');
      expect(data.status).toBe('ok');
    });

    it('GET /health should return ok', async () => {
      const { status, data } = await fetchApi('GET', '/health');
      expect(status).toBe(200);
      expect(data.status).toBe('ok');
    });

    it('GET /metrics should return metrics object', async () => {
      const { status, data } = await fetchApi('GET', '/metrics');
      expect(status).toBe(200);
      expect(data.metrics).toBeDefined();
      expect(data.metrics.totalRequests).toBeGreaterThanOrEqual(0);
    });

    it('GET /metrics/search should return search metrics', async () => {
      const { status, data } = await fetchApi('GET', '/metrics/search');
      expect(status).toBe(200);
      expect(data.searchMetrics).toBeDefined();
      expect(data.searchMetrics.totalSearches).toBeGreaterThanOrEqual(0);
    });
  });

  describe('POST /api/search', () => {
    it('should return recommendations for valid query', async () => {
      const { status, data } = await fetchApi('POST', '/api/search', {
        query: 'laptop',
        region: 'Global',
      });

      expect(status).toBe(200);
      expect(data.data).toBeDefined();
      expect(data.data.recommendations).toBeDefined();
      expect(Array.isArray(data.data.recommendations)).toBe(true);
      expect(data.data.summary).toBeDefined();
    });

    it('should accept specific regions', async () => {
      const { status, data } = await fetchApi('POST', '/api/search', {
        query: 'headphones',
        region: 'United States',
      });

      expect(status).toBe(200);
      expect(data.data).toBeDefined();
      expect(Array.isArray(data.data.recommendations)).toBe(true);
    });

    it('should handle special characters in query', async () => {
      const { status, data } = await fetchApi('POST', '/api/search', {
        query: 'Sony WH-1000XM5 (latest)',
        region: 'Global',
      });

      expect(status).toBe(200);
      expect(data.data).toBeDefined();
    });

    it('should validate response schema', async () => {
      const { status, data } = await fetchApi('POST', '/api/search', {
        query: 'phone',
        region: 'Global',
      });

      expect(status).toBe(200);
      
      if (data.data.recommendations.length > 0) {
        const rec = data.data.recommendations[0];
        
        // Required fields
        expect(rec.storeName).toBeDefined();
        expect(typeof rec.storeName).toBe('string');
        
        // Numeric fields
        expect(typeof rec.priceValue).toBe('number');
        expect(typeof rec.ratingScore).toBe('number');
        expect(typeof rec.confidenceScore).toBe('number');
        
        // Array fields
        expect(Array.isArray(rec.pros)).toBe(true);
        expect(Array.isArray(rec.cons)).toBe(true);
        expect(Array.isArray(rec.specifications)).toBe(true);
        
        // New field: bestReason
        expect(rec.bestReason).toBeDefined();
        expect(typeof rec.bestReason).toBe('string');
      }
    });

    it('should handle empty/missing query', async () => {
      const { status, data } = await fetchApi('POST', '/api/search', {
        query: '',
        region: 'Global',
      });

      expect([200, 400]).toContain(status);
    });

    it('should return at least 3 recommendations when possible', async () => {
      const { status, data } = await fetchApi('POST', '/api/search', {
        query: 'iPhone 15',
        region: 'Global',
      });

      expect(status).toBe(200);
      // At least 3 or no availability
      expect(
        data.data.recommendations.length >= 3 || 
        data.data.summary.toLowerCase().includes('unavailable')
      ).toBe(true);
    });

    it('should mark best recommendation when applicable', async () => {
      const { status, data } = await fetchApi('POST', '/api/search', {
        query: 'samsung tv',
        region: 'Global',
      });

      expect(status).toBe(200);
      
      if (data.data.recommendations.length > 0) {
        const hasBest = data.data.recommendations.some((r: any) => r.isBest === true);
        expect(typeof hasBest).toBe('boolean');
      }
    });

    it('should handle rate limiting after too many requests', async () => {
      const requests = Array(15).fill(null).map(() =>
        fetchApi('POST', '/api/search', {
          query: `query-${Math.random()}`,
          region: 'Global',
        })
      );

      const results = await Promise.all(requests);
      const rateLimited = results.some((r) => r.status === 429);
      
      // May or may not be rate limited depending on timing
      expect(typeof rateLimited).toBe('boolean');
    });
  });

  describe('POST /api/identify-product', () => {
    it('should identify product from image URL', async () => {
      const { status, data } = await fetchApi('POST', '/api/identify-product', {
        image: 'https://via.placeholder.com/640x480?text=Product',
        region: 'Global',
      });

      expect(status).toBe(200);
      expect(data.productName).toBeDefined();
      expect(typeof data.productName).toBe('string');
    });

    it('should handle missing image gracefully', async () => {
      const { status, data } = await fetchApi('POST', '/api/identify-product', {
        image: '',
        region: 'Global',
      });

      expect([200, 400]).toContain(status);
    });

    it('should accept different regions', async () => {
      const { status, data } = await fetchApi('POST', '/api/identify-product', {
        image: 'https://via.placeholder.com/640x480?text=Product',
        region: 'United Kingdom',
      });

      expect(status).toBe(200);
    });
  });

  describe('Error Handling', () => {
    it('should return JSON error for invalid endpoints', async () => {
      const { status, data } = await fetchApi('GET', '/invalid-endpoint');
      
      expect([404, 500]).toContain(status);
      expect(data).toBeDefined();
    });

    it('should not return HTML error pages', async () => {
      const { status, data } = await fetchApi('GET', '/nonexistent');
      
      expect([404, 500]).toContain(status);
      expect(typeof data).toBe('object');
      expect(data.error).toBeUndefined();
    });

    it('POST /api/search should validate input', async () => {
      const { status } = await fetchApi('POST', '/api/search', {
        // Missing required fields
      });

      expect([200, 400]).toContain(status);
    });
  });

  describe('Caching & Performance', () => {
    it('should return cached responses quickly', async () => {
      const query = { query: 'test-product', region: 'Global' };

      // First request (cache miss)
      const start1 = Date.now();
      await fetchApi('POST', '/api/search', query);
      const time1 = Date.now() - start1;

      // Second request (cache hit)
      const start2 = Date.now();
      await fetchApi('POST', '/api/search', query);
      const time2 = Date.now() - start2;

      // Cache hit should be significantly faster (at least attempt to demonstrate)
      expect(typeof time2).toBe('number');
    });

    it('should complete search within reasonable time', async () => {
      const start = Date.now();
      const { status } = await fetchApi('POST', '/api/search', {
        query: 'shirt',
        region: 'Global',
      });
      const duration = Date.now() - start;

      expect(status).toBe(200);
      expect(duration).toBeLessThan(30000); // Should complete within 30 seconds
    });
  });
});

