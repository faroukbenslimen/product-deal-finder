// File role: Frontend analytics wrapper for tracking key user interactions.
/**
 * Frontend Analytics Utility
 * Tracks user interactions and sends events (can integrate with Google Analytics, Vercel Analytics, etc.)
 */

import { track } from '@vercel/analytics';

interface AnalyticsEvent {
  name: string;
  properties?: Record<string, string | number | boolean>;
  timestamp?: number;
}

class Analytics {
  private isEnabled = true;
  private eventQueue: AnalyticsEvent[] = [];
  private isDev = typeof window !== 'undefined' && window.location.hostname === 'localhost';

    /**
   * Constructor so this code stays predictable and easier to maintain.
   *
   * @returns Nothing meaningful; this function exists for side effects and flow control.
   */
constructor() {
    // Initialize with your analytics provider here
    // Example: Google Analytics, Vercel Analytics, Mixpanel, etc.
    this.initializeProvider();
  }

    /**
 * Initialize Provider so this code stays predictable and easier to maintain.
 *
 * @returns Nothing meaningful; this function exists for side effects and flow control.
 */
private initializeProvider(): void {
    // Vercel Analytics is enabled via <Analytics /> in main.tsx.
    if (this.isDev) {
      console.log('[Analytics] Initialized with Vercel Analytics (dev mode)');
    }
  }

    /**
   * Track Search so this code stays predictable and easier to maintain.
   *
   * @param query - query passed by the caller to control this behavior.
   * @param region - region passed by the caller to control this behavior.
   * @param resultCount - resultCount passed by the caller to control this behavior.
   * @returns Nothing meaningful; this function exists for side effects and flow control.
   */
  trackSearch(query: string, region: string, resultCount: number): void {
    this.trackEvent('search', {
      query: query.substring(0, 50), // Sanitize query
      region,
      resultCount,
    });
  }

    /**
   * Track Image Upload so this code stays predictable and easier to maintain.
   *
   * @param size - size passed by the caller to control this behavior.
   * @param success - success passed by the caller to control this behavior.
   * @returns Nothing meaningful; this function exists for side effects and flow control.
   */
  trackImageUpload(size: number, success: boolean): void {
    this.trackEvent('image_upload', {
      size: Math.round(size / 1024), // Convert to KB
      success,
    });
  }

    /**
   * Track Deal Click so this code stays predictable and easier to maintain.
   *
   * @param storeName - storeName passed by the caller to control this behavior.
   * @param isBest - isBest passed by the caller to control this behavior.
   * @returns Nothing meaningful; this function exists for side effects and flow control.
   */
  trackDealClick(storeName: string, isBest: boolean): void {
    this.trackEvent('deal_click', {
      store: storeName.substring(0, 50),
      isBest,
    });
  }

    /**
   * Track Watchlist Action so this code stays predictable and easier to maintain.
   *
   * @param action - action passed by the caller to control this behavior.
   * @param storeName - storeName passed by the caller to control this behavior.
   * @returns Nothing meaningful; this function exists for side effects and flow control.
   */
  trackWatchlistAction(action: 'add' | 'remove', storeName: string): void {
    this.trackEvent('watchlist_action', {
      action,
      store: storeName.substring(0, 50),
    });
  }

    /**
   * Track Filter Usage so this code stays predictable and easier to maintain.
   *
   * @param filterType - filterType passed by the caller to control this behavior.
   * @returns Nothing meaningful; this function exists for side effects and flow control.
   */
  trackFilterUsage(filterType: 'price' | 'store' | 'rating'): void {
    this.trackEvent('filter_used', {
      filterType,
    });
  }

    /**
   * Track View Mode Switch so this code stays predictable and easier to maintain.
   *
   * @param mode - mode passed by the caller to control this behavior.
   * @returns Nothing meaningful; this function exists for side effects and flow control.
   */
  trackViewModeSwitch(mode: 'cards' | 'table'): void {
    this.trackEvent('view_mode_switch', {
      mode,
    });
  }

    /**
   * Track Error so this code stays predictable and easier to maintain.
   *
   * @param errorMessage - errorMessage passed by the caller to control this behavior.
   * @param context - context passed by the caller to control this behavior.
   * @returns Nothing meaningful; this function exists for side effects and flow control.
   */
  trackError(errorMessage: string, context?: string): void {
    this.trackEvent('error_occurred', {
      error: errorMessage.substring(0, 100),
      context: context || 'unknown',
    });
  }

    /**
   * Track Timing so this code stays predictable and easier to maintain.
   *
   * @param operation - operation passed by the caller to control this behavior.
   * @param duration - duration passed by the caller to control this behavior.
   * @returns Nothing meaningful; this function exists for side effects and flow control.
   */
  trackTiming(operation: string, duration: number): void {
    this.trackEvent('timing', {
      operation,
      duration: Math.round(duration),
    });
  }

    /**
   * Track Event so this code stays predictable and easier to maintain.
   *
   * @param name - name passed by the caller to control this behavior.
   * @param properties - properties passed by the caller to control this behavior.
   * @returns Nothing meaningful; this function exists for side effects and flow control.
   */
  private trackEvent(name: string, properties?: Record<string, string | number | boolean>): void {
    if (!this.isEnabled) return;

    try {
      track(name, properties);
    } catch {
      // If analytics provider is unavailable, queue for best-effort retry.
      this.eventQueue.push({
        name,
        properties,
        timestamp: Date.now(),
      });
    }

    // Log in dev mode
    if (this.isDev) {
      console.log('[Analytics Event]', name, properties);
    }

    // Send to backend for collection (optional)
    this.flushIfNeeded();
  }

    /**
   * Flush If Needed so this code stays predictable and easier to maintain.
   *
   * @returns Nothing meaningful; this function exists for side effects and flow control.
   */
  private flushIfNeeded(): void {
    if (this.eventQueue.length >= 10) {
      this.flush();
    }
  }

    /**
   * Flush so this code stays predictable and easier to maintain.
   *
   * @returns Nothing meaningful; this function exists for side effects and flow control.
   */
  flush(): void {
    if (this.eventQueue.length === 0) return;

    const events = [...this.eventQueue];
    this.eventQueue = [];

    events.forEach((event) => {
      try {
        track(event.name, event.properties);
      } catch {
        // Ignore retry failures so analytics never impacts UX.
      }
    });

    if (this.isDev) {
      console.log('[Analytics] Flushed', events.length, 'events');
    }
  }

    /**
   * Set User Properties so this code stays predictable and easier to maintain.
   *
   * @param properties - properties passed by the caller to control this behavior.
   * @returns Nothing meaningful; this function exists for side effects and flow control.
   */
  setUserProperties(properties: Record<string, string | number | boolean>): void {
    // Store user properties for all future events
    if (this.isDev) {
      console.log('[Analytics] User properties set', properties);
    }
  }

    /**
   * Set Enabled so this code stays predictable and easier to maintain.
   *
   * @param enabled - enabled passed by the caller to control this behavior.
   * @returns Nothing meaningful; this function exists for side effects and flow control.
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

