import { z } from 'zod';

export const specificationSchema = z.object({
  feature: z.string(),
  value: z.string(),
});

export const recommendationSchema = z.object({
  storeName: z.string(),
  productName: z.string().optional().default(''),
  price: z.union([z.string(), z.number()]),
  priceValue: z.union([z.number(), z.string()]),
  url: z.string().optional().default(''),
  domain: z.string().optional().default(''),
  serviceRating: z.string().optional().default('No rating details available'),
  ratingScore: z.union([z.number(), z.string()]).optional().default(0),
  isBest: z.boolean().optional().default(false),
  bestReason: z.string().optional().default(''),
  imageUrl: z.string().optional().default(''),
  stockStatus: z.string().optional().default('Unknown'),
  shippingInfo: z.string().optional().default('Unknown'),
  pros: z.array(z.string()).optional().default([]),
  cons: z.array(z.string()).optional().default([]),
  specifications: z.array(specificationSchema).optional().default([]),
  confidenceScore: z.number().optional(),
  linkSource: z.enum(['direct', 'fallback']).optional(),
  linkVerified: z.boolean().optional(),
  confidenceLevel: z.enum(['low', 'medium', 'high']).optional(),
});

export const modelResponseSchema = z.object({
  recommendations: z.array(recommendationSchema),
  summary: z.string(),
  detectedCurrency: z.string().optional().default('USD'),
});

export type Recommendation = z.infer<typeof recommendationSchema>;
export type ModelResponse = z.infer<typeof modelResponseSchema>;
