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

  private formatEntry(level: string, message: string, context?: Record<string, unknown>, error?: Error): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level: level as 'info' | 'warn' | 'error' | 'debug',
      message,
      context,
      error: error?.stack,
    };
  }

  info(message: string, context?: Record<string, unknown>): void {
    const entry = this.formatEntry('info', message, context);
    console.log(JSON.stringify(entry));
  }

  warn(message: string, context?: Record<string, unknown>): void {
    const entry = this.formatEntry('warn', message, context);
    console.warn(JSON.stringify(entry));
  }

  error(message: string, error?: Error, context?: Record<string, unknown>): void {
    const entry = this.formatEntry('error', message, context, error);
    console.error(JSON.stringify(entry));
  }

  debug(message: string, context?: Record<string, unknown>): void {
    if (this.isDev) {
      const entry = this.formatEntry('debug', message, context);
      console.debug(JSON.stringify(entry));
    }
  }
}

export const logger = new Logger();
