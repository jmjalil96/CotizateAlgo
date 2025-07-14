import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../services/logger.service';

// Generate correlation ID for request tracing
const generateCorrelationId = () => uuidv4();


// Simple request logging middleware (replaces pino-http to avoid stability issues)
export const requestLoggerMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const correlationId = (req as any).correlationId;
  
  // Log incoming request
  logger.info({
    correlationId,
    method: req.method,
    url: req.url,
    userAgent: req.headers['user-agent'],
    ip: req.ip,
    category: 'http'
  }, `Request: ${req.method} ${req.url}`);
  
  // Override res.end to log response
  const originalEnd = res.end.bind(res);
  res.end = function(chunk?: any, encoding?: BufferEncoding | (() => void), cb?: () => void) {
    const duration = Date.now() - start;
    const level = res.statusCode >= 400 ? 'warn' : 'info';
    
    logger[level]({
      correlationId,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
      category: 'http'
    }, `Response: ${req.method} ${req.url} - ${res.statusCode} (${duration}ms)`);
    
    // Call original end method
    if (typeof encoding === 'function') {
      return originalEnd(chunk, encoding);
    } else if (encoding && cb) {
      return originalEnd(chunk, encoding, cb);
    } else if (encoding) {
      return originalEnd(chunk, encoding);
    } else {
      return originalEnd(chunk);
    }
  };
  
  next();
};

// Manual correlation ID middleware (alternative approach)
export const correlationIdMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Get or generate correlation ID
  const correlationId = req.headers['x-correlation-id'] as string || generateCorrelationId();
  
  // Add correlation ID to request object for use in controllers
  (req as any).correlationId = correlationId;
  
  // Add correlation ID to response headers
  res.setHeader('x-correlation-id', correlationId);
  
  next();
};

// Performance monitoring middleware
export const performanceMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  
  // Store original end method
  const originalEnd = res.end.bind(res);
  
  // Override res.end to capture response time
  res.end = function(chunk?: any, encoding?: BufferEncoding | (() => void), cb?: () => void) {
    const duration = Date.now() - startTime;
    
    // Add performance data to request for logging
    (req as any).performanceData = {
      duration,
      startTime,
      endTime: Date.now(),
    };
    
    // Call original end method with proper arguments
    if (typeof encoding === 'function') {
      return originalEnd(chunk, encoding);
    } else if (encoding && cb) {
      return originalEnd(chunk, encoding, cb);
    } else if (encoding) {
      return originalEnd(chunk, encoding);
    } else {
      return originalEnd(chunk);
    }
  };
  
  next();
};

// User context middleware (for authenticated requests)
export const userContextMiddleware = (req: Request, _res: Response, next: NextFunction) => {
  // Extract user info from request (assuming it's added by auth middleware)
  const user = (req as any).user;
  
  if (user) {
    // Add user context to request for logging
    (req as any).userContext = {
      userId: user.id,
      userEmail: user.email,
    };
  }
  
  next();
};