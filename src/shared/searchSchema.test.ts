import { describe, expect, it } from 'vitest';
import { normalizeSearchResult } from './searchSchema';

describe('normalizeSearchResult smoke paths', () => {
  it('handles valid response path', () => {
    const result = normalizeSearchResult({
      recommendations: [
        {
          storeName: 'Example Store',
          productName: 'Sony WH-1000XM5',
          price: '$299.99',
          priceValue: 299.99,
          url: 'https://example.com/sony-wh-1000xm5',
          domain: 'example.com',
          serviceRating: 'Excellent support',
          ratingScore: 4.7,
          isBest: true,
          imageUrl: 'https://example.com/image.jpg',
          stockStatus: 'In Stock',
          shippingInfo: 'Free Shipping',
          pros: ['Fast shipping'],
          cons: ['No local pickup'],
          specifications: [{ feature: 'Color', value: 'Black' }],
        },
      ],
      summary: 'Found one strong match.',
    });

    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0].storeName).toBe('Example Store');
    expect(result.recommendations[0].pros).toEqual(['Fast shipping']);
    expect(result.recommendations[0].confidenceScore).toBeGreaterThan(0);
    expect(['low', 'medium', 'high']).toContain(result.recommendations[0].confidenceLevel);
    expect(result.summary).toBe('Found one strong match.');
  });

  it('handles malformed response path safely', () => {
    const result = normalizeSearchResult({
      recommendations: [
        {
          storeName: 123,
          pros: 'not-an-array',
          cons: null,
          ratingScore: 'not-a-number',
        },
      ],
      summary: null,
    });

    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0].storeName).toBe('Unknown Store');
    expect(result.recommendations[0].pros).toEqual([]);
    expect(result.recommendations[0].cons).toEqual([]);
    expect(result.recommendations[0].ratingScore).toBe(0);
    expect(result.summary.length).toBeGreaterThan(0);
  });

  it('handles empty recommendations path', () => {
    const result = normalizeSearchResult({
      recommendations: [],
      summary: 'No stores matched filters.',
    });

    expect(result.recommendations).toEqual([]);
    expect(result.summary).toBe('No stores matched filters.');
  });

  it('handles region unavailable path', () => {
    const result = normalizeSearchResult({
      recommendations: [],
      summary: 'Product is not available for purchase or shipping in Tunisia.',
    });

    expect(result.recommendations).toHaveLength(0);
    expect(result.summary.toLowerCase()).toContain('shipping in tunisia');
  });

  it('filters low-confidence recommendations when threshold is set', () => {
    const result = normalizeSearchResult(
      {
        recommendations: [
          {
            storeName: 'Weak Store',
            productName: '',
            price: 'unknown',
            priceValue: 0,
            url: '',
            domain: '',
            serviceRating: 'Unknown',
            ratingScore: 0,
            isBest: false,
            imageUrl: '',
            stockStatus: 'Unknown',
            shippingInfo: 'Unknown',
            pros: [],
            cons: [],
            specifications: [],
          },
        ],
        summary: 'weak data',
      },
      { query: 'Sony WH-1000XM5', minConfidence: 40 }
    );

    expect(result.recommendations).toHaveLength(0);
  });

  it('normalizes detectedCurrency and falls back to USD for invalid values', () => {
    const validCurrency = normalizeSearchResult({
      recommendations: [],
      summary: 'currency check',
      detectedCurrency: 'eur',
    });

    const invalidCurrency = normalizeSearchResult({
      recommendations: [],
      summary: 'currency fallback',
      detectedCurrency: 'EURO',
    });

    const missingCurrency = normalizeSearchResult({
      recommendations: [],
      summary: 'currency missing',
    });

    expect(validCurrency.detectedCurrency).toBe('EUR');
    expect(invalidCurrency.detectedCurrency).toBe('USD');
    expect(missingCurrency.detectedCurrency).toBe('USD');
  });
});
