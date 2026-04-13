// File role: Prompt builder that defines the structured AI search output contract.
/**
 * Builds Search Prompt.
 *
 * @param query - Value supplied by the caller.
 * @param region - Value supplied by the caller.
 * @param storePatterns - Dictionary of known store URL structures for discovery.
 * @returns Computed value used by downstream logic.
 */
export function buildSearchPrompt(query: string, region: string, storePatterns: Record<string, string[]> = {}): string {
  const regionContext =
    region !== 'Global'
      ? `\nCRITICAL REGION CONSTRAINT: You MUST find the best deals for buyers in ${region}.
- **Prioritize Local**: First, search for stores physically located in ${region} or on .${region.toLowerCase().slice(0, 2)} domains (e.g., .tn for Tunisia, .fr for France, .uk for UK).
- **International Fallback**: If local stores are unavailable or overpriced, you may include reputable international stores (like Amazon, AliExpress, eBay, B&H) that are well-known for shipping to ${region}.
- **Accuracy**: Always prioritize the specific regional site (e.g., Amazon.fr for France) when it exists.
- **Empty Results**: Only return an empty "recommendations" array [] if the product is genuinely illegal or impossible to ship to ${region}.`
      : ' globally';

  const patternHint = Object.entries(storePatterns).length > 0 
    ? `\n\nKNOWN STORE PATTERNS (for Direct URL Discovery):
      Use these as a guide for what a REAL product page URL looks like:
      ${Object.entries(storePatterns).map(([name, patterns]) => `- ${name}: ${patterns.join(', ')}`).join('\n      ')}`
    : '';

  return `Find the best places to buy "${query}"${region !== 'Global' ? '' : ' globally'}. ${regionContext} ${patternHint}

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

CRITICAL DIRECT-FIRST MANDATE: Your ABSOLUTE PRIORITY is to find the DIRECT product landing page. 
- A search result or category page is a FAILURE.
- If your first search only returns aggregator/search links, YOU MUST perform a second search using specific operators like 'site:[domain] "${query}"' to isolate the actual product page.
- Do NOT settle for "google.com/search..." or "store.com/search?q=..." links.
- Use your tools to verify you are on a page that actually allows a user to "Add to Cart" or "Buy Now".

CRITICAL RELEVANCE INSTRUCTION: You MUST return ONLY products that clearly match the user's search query ("${query}"). Do NOT include unrelated products.

CRITICAL DIVERSITY INSTRUCTION: Prefer diverse sources (official store + marketplaces + specialist retailers + price comparison/listing sites where buyers can reach a real offer).

CRITICAL CURRENCY INSTRUCTION: Set detectedCurrency to the ISO 4217 currency code most appropriate for the selected region.

CRITICAL BEST REASON INSTRUCTION: For the store marked isBest: true, provide a bestReason string of one sentence explaining why it is the best pick (e.g., "Lowest price with fast local shipping and strong reviews").`;
}

