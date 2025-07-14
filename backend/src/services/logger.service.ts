import pino from 'pino';
import loggerConfig from '../config/logger.config';

// Create the main logger instance
export const logger = pino(loggerConfig);

type LogContext = Record<string, unknown>;

// Logger service class for advanced functionality
export class LoggerService {
  private logger: pino.Logger;

  constructor(context?: string) {
    this.logger = context ? logger.child({ context }) : logger;
  }

  // Create a child logger with additional context
  createChildLogger(context: string, additionalFields?: LogContext) {
    return new LoggerService().withContext(context, additionalFields);
  }

  // Add context to the logger
  withContext(context: string, additionalFields?: LogContext) {
    const contextData = { context, ...additionalFields };
    const childLogger = new LoggerService();
    childLogger.logger = this.logger.child(contextData as pino.Bindings);
    return childLogger;
  }

  // Add correlation ID for request tracing
  withCorrelationId(correlationId: string) {
    const childLogger = new LoggerService();
    childLogger.logger = this.logger.child({ correlationId });
    return childLogger;
  }

  // Add user context for audit logging
  withUser(userId: string, userEmail?: string) {
    const childLogger = new LoggerService();
    childLogger.logger = this.logger.child({
      userId,
      userEmail: userEmail || undefined,
    });
    return childLogger;
  }

  // Standard logging methods
  debug(message: string, data?: Record<string, unknown>) {
    if (data) {
      this.logger.debug(data, message);
    } else {
      this.logger.debug(message);
    }
  }

  info(message: string, data?: Record<string, unknown>) {
    if (data) {
      this.logger.info(data, message);
    } else {
      this.logger.info(message);
    }
  }

  warn(message: string, data?: Record<string, unknown>) {
    if (data) {
      this.logger.warn(data, message);
    } else {
      this.logger.warn(message);
    }
  }

  error(
    message: string,
    error?: Error | unknown,
    data?: Record<string, unknown>
  ) {
    let logData: Record<string, unknown> = {};

    if (error) {
      logData.err = error;
    }

    if (data && typeof data === 'object') {
      logData = { ...logData, ...data };
    }

    if (Object.keys(logData).length > 0) {
      this.logger.error(logData, message);
    } else {
      this.logger.error(message);
    }
  }

  fatal(
    message: string,
    error?: Error | unknown,
    data?: Record<string, unknown>
  ) {
    let logData: Record<string, unknown> = {};

    if (error) {
      logData.err = error;
    }

    if (data && typeof data === 'object') {
      logData = { ...logData, ...data };
    }

    if (Object.keys(logData).length > 0) {
      this.logger.fatal(logData, message);
    } else {
      this.logger.fatal(message);
    }
  }

  // Specialized logging methods

  // Log authentication events
  authEvent(
    event: string,
    data: { userId?: string; email?: string; success: boolean; reason?: string }
  ) {
    this.info(`Authentication event: ${event}`, {
      event,
      ...data,
      category: 'authentication',
    });
  }

  // Log database operations
  dbOperation(
    operation: string,
    data: { table?: string; duration?: number; success: boolean; error?: Error }
  ) {
    const level = data.success ? 'debug' : 'error';
    this[level](`Database operation: ${operation}`, {
      operation,
      ...data,
      category: 'database',
    });
  }

  // Log API requests (used by middleware)
  apiRequest(data: {
    method: string;
    url: string;
    statusCode: number;
    duration: number;
    userId?: string;
    correlationId?: string;
  }) {
    const level = data.statusCode >= 400 ? 'warn' : 'info';
    this[level](`API Request: ${data.method} ${data.url}`, {
      ...data,
      category: 'api',
    });
  }

  // Log security events
  securityEvent(
    event: string,
    data: {
      userId?: string;
      ip?: string;
      userAgent?: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      details?: Record<string, unknown>;
    }
  ) {
    const level =
      data.severity === 'low'
        ? 'info'
        : data.severity === 'medium'
          ? 'warn'
          : 'error';

    this[level](`Security event: ${event}`, {
      event,
      ...data,
      category: 'security',
    });
  }

  // Log business events
  businessEvent(
    event: string,
    data: {
      userId?: string;
      action: string;
      resource?: string;
      success: boolean;
      details?: Record<string, unknown>;
    }
  ) {
    this.info(`Business event: ${event}`, {
      event,
      ...data,
      category: 'business',
    });
  }

  // Get the underlying Pino logger instance
  getPinoLogger(): pino.Logger {
    return this.logger;
  }
}

// Export default logger service instance
export const loggerService = new LoggerService('application');

// Export context-specific loggers
export const authLogger = new LoggerService('auth');
export const dbLogger = new LoggerService('database');
export const apiLogger = new LoggerService('api');
export const securityLogger = new LoggerService('security');
