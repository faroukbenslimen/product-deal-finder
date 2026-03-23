// File role: Shared logging utility for consistent backend log formatting.
/**
 * Simple structured logger utility for production logging
 */

export interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  context?: Record<string, unknown>;
  error?: string;
}

class Logger {
  private isDev = process.env.NODE_ENV === 'development';

    /**
   * Format Entry so this code stays predictable and easier to maintain.
   *
   * @param level - level passed by the caller to control this behavior.
   * @param message - message passed by the caller to control this behavior.
   * @param context - context passed by the caller to control this behavior.
   * @param error - error passed by the caller to control this behavior.
   * @returnsVoid.
   */
private formatEntry(level: string, message: string, context?: Record<string, unknown>, error?: Error): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level: level as 'info' | 'warn' | 'error' | 'debug',
      message,
      context,
      error: error?.stack,
    };
  }

    /**
   * Info.
   *
   * @param message - messagesupplied by the caller.
   * @param context - contextsupplied by the caller.
   * @returnsVoid.
   */
info(message: string, context?: Record<string, unknown>): void {
    const entry = this.formatEntry('info', message, context);
    console.log(JSON.stringify(entry));
  }

    /**
   * Warn.
   *
   * @param message - messagesupplied by the caller.
   * @param context - contextsupplied by the caller.
   * @returnsVoid.
   */
warn(message: string, context?: Record<string, unknown>): void {
    const entry = this.formatEntry('warn', message, context);
    console.warn(JSON.stringify(entry));
  }

    /**
   * Error.
   *
   * @param message - messagesupplied by the caller.
   * @param error - errorsupplied by the caller.
   * @param context - contextsupplied by the caller.
   * @returnsVoid.
   */
error(message: string, error?: Error, context?: Record<string, unknown>): void {
    const entry = this.formatEntry('error', message, context, error);
    console.error(JSON.stringify(entry));
  }

    /**
   * Debug.
   *
   * @param message - messagesupplied by the caller.
   * @param context - contextsupplied by the caller.
   * @returnsVoid.
   */
debug(message: string, context?: Record<string, unknown>): void {
    if (this.isDev) {
      const entry = this.formatEntry('debug', message, context);
      console.debug(JSON.stringify(entry));
    }
  }
}

export const logger = new Logger();

