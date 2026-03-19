/**
 * Frontend Analytics Utility
 * Tracks user interactions and sends events (can integrate with Google Analytics, Vercel Analytics, etc.)
 */

interface AnalyticsEvent {
  name: string;
  properties?: Record<string, string | number | boolean>;
  timestamp?: number;
}

class Analytics {
  private isEnabled = true;
  private eventQueue: AnalyticsEvent[] = [];
  private isDev = process.env.NODE_ENV === 'development';

  constructor() {
    // Initialize with your analytics provider here
    // Example: Google Analytics, Vercel Analytics, Mixpanel, etc.
    this.initializeProvider();
  }

  private initializeProvider(): void {
    // Placeholder for analytics provider initialization
    if (this.isDev) {
      console.log('[Analytics] Initialized (dev mode)');
    }
  }

  /**
   * Track a search event
   */
  trackSearch(query: string, region: string, resultCount: number): void {
    this.trackEvent('search', {
      query: query.substring(0, 50), // Sanitize query
      region,
      resultCount,
    });
  }

  /**
   * Track image upload
   */
  trackImageUpload(size: number, success: boolean): void {
    this.trackEvent('image_upload', {
      size: Math.round(size / 1024), // Convert to KB
      success,
    });
  }

  /**
   * Track deal click
   */
  trackDealClick(storeName: string, isBest: boolean): void {
    this.trackEvent('deal_click', {
      store: storeName.substring(0, 50),
      isBest,
    });
  }

  /**
   * Track watchlist action
   */
  trackWatchlistAction(action: 'add' | 'remove', storeName: string): void {
    this.trackEvent('watchlist_action', {
      action,
      store: storeName.substring(0, 50),
    });
  }

  /**
   * Track filter usage
   */
  trackFilterUsage(filterType: 'price' | 'store' | 'rating'): void {
    this.trackEvent('filter_used', {
      filterType,
    });
  }

  /**
   * Track view mode switch
   */
  trackViewModeSwitch(mode: 'cards' | 'table'): void {
    this.trackEvent('view_mode_switch', {
      mode,
    });
  }

  /**
   * Track error
   */
  trackError(errorMessage: string, context?: string): void {
    this.trackEvent('error_occurred', {
      error: errorMessage.substring(0, 100),
      context: context || 'unknown',
    });
  }

  /**
   * Track page timing
   */
  trackTiming(operation: string, duration: number): void {
    this.trackEvent('timing', {
      operation,
      duration: Math.round(duration),
    });
  }

  /**
   * Generic event tracking
   */
  private trackEvent(name: string, properties?: Record<string, string | number | boolean>): void {
    if (!this.isEnabled) return;

    const event: AnalyticsEvent = {
      name,
      properties,
      timestamp: Date.now(),
    };

    this.eventQueue.push(event);

    // Log in dev mode
    if (this.isDev) {
      console.log('[Analytics Event]', name, properties);
    }

    // Send to backend for collection (optional)
    this.flushIfNeeded();
  }

  /**
   * Flush events when queue reaches threshold
   */
  private flushIfNeeded(): void {
    if (this.eventQueue.length >= 10) {
      this.flush();
    }
  }

  /**
   * Send all queued events to backend
   */
  flush(): void {
    if (this.eventQueue.length === 0) return;

    const events = [...this.eventQueue];
    this.eventQueue = [];

    // Send to analytics endpoint (optional - you can implement this)
    // fetch('/api/analytics', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ events }),
    //   keepalive: true, // Ensure request completes even if page unloads
    // }).catch(() => {
    //   // Silently fail if analytics endpoint unavailable
    // });

    if (this.isDev) {
      console.log('[Analytics] Flushed', events.length, 'events');
    }
  }

  /**
   * Set user properties (optional)
   */
  setUserProperties(properties: Record<string, string | number | boolean>): void {
    // Store user properties for all future events
    if (this.isDev) {
      console.log('[Analytics] User properties set', properties);
    }
  }

  /**
   * Enable/disable analytics
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    if (this.isDev) {
      console.log('[Analytics]', enabled ? 'Enabled' : 'Disabled');
    }
  }
}

// Export singleton instance
export const analytics = new Analytics();

// Flush events when user leaves page
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    analytics.flush();
  });
}
