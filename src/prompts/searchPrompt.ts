export function buildSearchPrompt(query: string, region: string): string {
  const regionContext =
    region !== 'Global'
      ? `\nCRITICAL REGION CONSTRAINT: You MUST ONLY return stores that are physically located in ${region} OR explicitly state they ship to ${region}. If the product is completely unavailable for purchase or shipping in ${region}, you MUST return an empty "recommendations" array [] and explain the unavailability in the "summary". Do NOT fallback to US/Global stores if they do not ship to ${region}. Prices MUST be converted to the local currency of ${region} if possible. If you are unsure if a store ships to ${region}, DO NOT include it.`
      : ' globally';

  return `Find the best places to buy "${query}"${region !== 'Global' ? '' : ' globally'}. ${regionContext}

CRITICAL: You MUST return ONLY a valid JSON object. Do NOT wrap it in \`\`\`json markdown. Just return the raw JSON starting with { and ending with }.

The JSON must have this exact structure:
{
  "recommendations": [
    {
      "storeName": "Name",
      "productName": "Specific Product Name",
      "price": "$99.99",
      "priceValue": 99.99,
      "url": "https://...",
      "domain": "store.com",
      "serviceRating": "Good",
      "ratingScore": 4.5,
      "isBest": true,
      "bestReason": "Why this is your best choice (price, availability, service, etc.)",
      "imageUrl": "https://...",
      "stockStatus": "In Stock",
      "shippingInfo": "Free Shipping",
      "pros": ["pro1"],
      "cons": ["con1"],
      "specifications": [{"feature": "Color", "value": "Black"}]
    }
  ],
  "summary": "Brief summary of findings",
  "detectedCurrency": "USD"
}

CRITICAL RELEVANCE INSTRUCTION: You MUST return ONLY products that clearly match the user's search query ("${query}"). Do NOT include unrelated products.

CRITICAL RESULT COUNT INSTRUCTION: Return 5-8 recommendations whenever possible, with at least 3 recommendations unless the product is truly unavailable in the selected region.

CRITICAL DIVERSITY INSTRUCTION: Prefer diverse sources (official store + marketplaces + specialist retailers + price comparison/listing sites where buyers can reach a real offer).

CRITICAL CURRENCY INSTRUCTION: Set detectedCurrency to the ISO 4217 currency code most appropriate for the selected region.

CRITICAL BEST REASON INSTRUCTION: For the store marked isBest: true, provide a bestReason string of one sentence explaining why it is the best pick (e.g., "Lowest price with fast local shipping and strong reviews").

If fewer than 3 trustworthy stores are actually available for ${region}, you may return fewer, but explain why in summary.

CRITICAL URL INSTRUCTION: DO NOT GUESS OR CONSTRUCT URLs. If you do not have the EXACT, VERIFIED url directly from your search results, you MUST leave the 'url' field EMPTY ("").`;
}
