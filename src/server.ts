// File role: Orchestrator that initializes the server and route registrations.
import 'dotenv/config';
import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import { port } from './core/config';
import { handleSearch } from './core/controllers/searchController';
import { handleIdentifyProduct } from './core/controllers/productController';
import { observabilityMiddleware, getMetrics, getSearchMetrics } from './middleware/observability';
import { getUsageMetrics } from './core/services/usageService';
import { STORE_ALLOWLIST } from './core/config';

// Middleware to wrap async routes for centralized error handling
const asyncHandler = (fn: any) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

const app = express();

// Middleware setup
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(observabilityMiddleware);

// Health & Metrics
app.get('/', (_req: Request, res: Response) => {
  res.json({ service: 'deal-finder-api', status: 'ok' });
});

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

app.get('/metrics', (_req: Request, res: Response) => {
  const storePatterns: Record<string, string[]> = {};
  STORE_ALLOWLIST.forEach(s => { 
    // Extract human-readable hints from Regex patterns (e.g., /\/dp\//i -> "/dp/")
    storePatterns[s.name] = (s.pathPatterns || []).map(p => {
      const str = String(p);
      return str.replace(/^\/|[\/\\][gimuy]*$/g, '').replace(/\\/g, '');
    });
  });
  res.json({ metrics: getMetrics(), usage: getUsageMetrics(), storePatterns });
});

// Primary Routes
app.post('/api/search', asyncHandler(handleSearch));
app.post('/api/identify-product', asyncHandler(handleIdentifyProduct));

// Error Handling
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not Found' });
});

app.use((error: any, _req: Request, res: Response, next: NextFunction) => {
  console.error('API Error:', error);
  res.status(500).json({ error: 'Internal Server Error' });
});

app.listen(port, () => {
  console.log(`Modular Deal Finder API running on http://localhost:${port}`);
});
