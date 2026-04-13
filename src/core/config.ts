import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';

// API Environment configuration
export const apiKey = process.env.GEMINI_API_KEY;
export const openRouterApiKey = process.env.OPENROUTER_API_KEY;
export const openRouterModel = (process.env.OPENROUTER_MODEL || '')
  .trim()
  .replace(/^['\"]|['\"]$/g, '') || 'meta-llama/llama-3.1-8b-instruct:free';
export const port = Number(process.env.PORT || 4000);

const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

export function getAiClient(): GoogleGenAI {
  if (!ai) {
    throw new Error('Server is missing GEMINI_API_KEY.');
  }
  return ai;
}

// Rate Limiting and Cooldown constants
export const RATE_LIMIT_WINDOW_MS = 60_000;
export const RATE_LIMIT_MAX = 10;
export const IP_COOLDOWN_MS = 4_000;
export const DAILY_MODEL_CALL_CAP = Number(process.env.DAILY_MODEL_CALL_CAP || 120);

// Cache & URL Policy constants
export const URL_CHECK_TIMEOUT_MS = 3_500;
export const URL_REACHABILITY_TTL_MS = 30 * 60 * 1000;
export const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
export const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
export const MAX_CACHE_ENTRIES = 1000;

// Filters and Patterns
export const TRACKING_QUERY_PREFIXES = ['utm_', 'mc_'];
export const TRACKING_QUERY_KEYS = new Set([
  'gclid', 'fbclid', 'msclkid', 'ref', 'ref_', 'refsrc', 
  'source', 'campaign', 'cmpid', 'adgroupid', 'adid', 
  'affid', 'affiliate',
]);

export const PRODUCT_IDENTIFIER_QUERY_KEYS = new Set(['id', 'pid', 'productid', 'sku', 'skuid', 'asin', 'item', 'model', 'variant']);
export const SEARCH_QUERY_KEYS = new Set(['q', 'query', 'search', 'keyword', 'k']);
export const GENERIC_LISTING_SEGMENTS = new Set(['search', 's', 'shop', 'store', 'category', 'categories', 'collections', 'products', 'deals']);

export const SEARCH_OR_AGGREGATOR_HOST_PATTERNS = [
  /(^|\.)google\./,
  /(^|\.)bing\.com$/,
  /(^|\.)search\.yahoo\.com$/,
  /(^|\.)duckduckgo\.com$/,
  /(^|\.)baidu\.com$/,
  /(^|\.)yandex\./,
  /(^|\.)facebook\.com$/,
  /(^|\.)instagram\.com$/,
  /(^|\.)tiktok\.com$/,
  /(^|\.)reddit\.com$/,
  /(^|\.)pinterest\./,
  /(^|\.)youtube\.com$/,
  /(^|\.)x\.com$/,
  /(^|\.)twitter\.com$/,
  /(^|\.)t\.co$/,
];

export const STORE_ALLOWLIST = [
  { name: 'amazon', host: /(^|\.)amazon\./i, pathPatterns: [/\/dp\//i, /\/gp\/product\//i, /\/gp\/aw\//i], searchUrl: 'https://www.amazon.com/s?k=' },
  { name: 'bestbuy', host: /(^|\.)bestbuy\.com$/i, pathPatterns: [/\/site\//i], searchUrl: 'https://www.bestbuy.com/site/searchpage.jsp?st=' },
  { name: 'walmart', host: /(^|\.)walmart\.com$/i, pathPatterns: [/\/ip\//i, /\/product\//i], searchUrl: 'https://www.walmart.com/search?q=' },
  { name: 'ebay', host: /(^|\.)ebay\./i, pathPatterns: [/\/itm\//i], searchUrl: 'https://www.ebay.com/sch/i.html?_nkw=' },
  { name: 'newegg', host: /(^|\.)newegg\.(com|ca)/i, pathPatterns: [/\/p\//i, /\/Product\//i], searchUrl: 'https://www.newegg.com/p/pl?d=' },
  { name: 'target', host: /(^|\.)target\.com$/i, pathPatterns: [/\/p\//i], searchUrl: 'https://www.target.com/s?searchTerm=' },
  { name: 'costco', host: /(^|\.)costco\.com$/i, pathPatterns: [/\.product\./i], searchUrl: 'https://www.costco.com/CatalogSearch?keyword=' },
  { name: 'bhphotovideo', host: /(^|\.)bhphotovideo\.com$/i, pathPatterns: [/\/c\/product\//i], searchUrl: 'https://www.bhphotovideo.com/c/search?Ntt=' },
  { name: 'homedepot', host: /(^|\.)homedepot\.com$/i, pathPatterns: [/\/p\//i], searchUrl: 'https://www.homedepot.com/s/' },
  { name: 'gamestop', host: /(^|\.)gamestop\.com$/i, pathPatterns: [/\/products\//i], searchUrl: 'https://www.gamestop.com/search/?q=' },
  { name: 'currys', host: /(^|\.)currys\.co\.uk$/i, pathPatterns: [/\/products\//i, /\.html$/i], searchUrl: 'https://www.currys.co.uk/search-results.html?q=' },
  { name: 'argos', host: /(^|\.)argos\.co\.uk$/i, pathPatterns: [/\/product\//i], searchUrl: 'https://www.argos.co.uk/search/' },
];

export const COUNTRY_TLDS: Record<string, string> = {
  Tunisia: 'tn',
  'United States': 'us',
  'United Kingdom': 'uk',
  France: 'fr',
  Germany: 'de',
  Canada: 'ca',
  Australia: 'au',
  Japan: 'jp',
  China: 'cn',
  Spain: 'es',
  Italy: 'it',
  Belgium: 'be',
  Switzerland: 'ch',
  Netherlands: 'nl',
  Sweden: 'se',
  Norway: 'no',
  Denmark: 'dk',
  Finland: 'fi',
  Portugal: 'pt',
  Ireland: 'ie',
  Poland: 'pl',
  Turkey: 'tr',
  'United Arab Emirates': 'ae',
  'Saudi Arabia': 'sa',
  India: 'in',
  Brazil: 'br',
  Mexico: 'mx',
  'South Africa': 'za',
  'South Korea': 'kr',
  Russia: 'ru',
};

export const IS_TEST = (
  process.env.NODE_ENV === 'test' ||
  process.env.VITEST === 'true' ||
  process.env.npm_lifecycle_event === 'test'
);
