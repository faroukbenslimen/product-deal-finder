/**
 * Observability middleware for request tracking and metrics collection
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

interface RequestMetrics {
  method: string;
  path: string;
  query?: Record<string, unknown>;
  responseTime: number;
  statusCode: number;
  success: boolean;
}

// In-memory metrics store (replace with database/time-series DB in production)
const metricsStore: RequestMetrics[] = [];
const MAX_METRICS = 1000;

export function observabilityMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();

  // Capture original res.send
  const originalSend = res.send;

  res.send = function (data: any) {
    const responseTime = Date.now() - startTime;
    const statusCode = res.statusCode;
    const success = statusCode < 400;

    const metrics: RequestMetrics = {
      method: req.method,
      path: req.path,
      query: req.query as Record<string, unknown>,
      responseTime,
      statusCode,
      success,
    };

    // Log the request
    logger.info(`${req.method} ${req.path}`, {
      statusCode,
      responseTime: `${responseTime}ms`,
      query: req.query,
    });

    // Store metrics
    metricsStore.push(metrics);
    if (metricsStore.length > MAX_METRICS) {
      metricsStore.shift();
    }

    // Call original send
    return originalSend.call(this, data);
  };

  next();
}

/**
 * Get current metrics (for debugging/monitoring)
 */
export function getMetrics() {
  const totalRequests = metricsStore.length;
  const successCount = metricsStore.filter((m) => m.success).length;
  const avgResponseTime = metricsStore.length > 0 
    ? metricsStore.reduce((sum, m) => sum + m.responseTime, 0) / metricsStore.length 
    : 0;

  return {
    totalRequests,
    successCount,
    errorCount: totalRequests - successCount,
    successRate: totalRequests > 0 ? ((successCount / totalRequests) * 100).toFixed(2) : 0,
    avgResponseTime: avgResponseTime.toFixed(2),
    recentMetrics: metricsStore.slice(-20),
  };
}

/**
 * Get search-specific metrics
 */
export function getSearchMetrics() {
  const searchMetrics = metricsStore.filter((m) => m.path.includes('/api/search'));
  const emptyResults = metricsStore.filter(
    (m) => m.path.includes('/api/search') && m.responseTime > 2500 && m.success
  ).length;

  if (searchMetrics.length === 0) {
    return {
      totalSearches: 0,
      avgLatency: 0,
      successRate: 0,
      emptyResultRate: 0,
    };
  }

  const successCount = searchMetrics.filter((m) => m.success).length;
  const avgLatency = searchMetrics.reduce((sum, m) => sum + m.responseTime, 0) / searchMetrics.length;

  return {
    totalSearches: searchMetrics.length,
    avgLatency: avgLatency.toFixed(2),
    successRate: ((successCount / searchMetrics.length) * 100).toFixed(2),
    emptyResultRate: ((emptyResults / searchMetrics.length) * 100).toFixed(2),
  };
}
