import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import swaggerSpecs from './config/swagger.config';
import { loggerService } from './services/logger.service';
import { requestLoggerMiddleware, correlationIdMiddleware } from './common/middlewares/request-logger.middleware';
import invitationRoutes from './modules/invitations/invitation.routes';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Logging middleware (should be early in the chain)
app.use(correlationIdMiddleware);
app.use(requestLoggerMiddleware);

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Swagger documentation (only in development)
if (process.env.NODE_ENV !== 'production') {
  // Serve OpenAPI JSON spec BEFORE Swagger UI middleware
  app.get('/api-docs/json', (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpecs);
  });
  
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs, {
    explorer: true,
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'CotizateAlgo API Documentation',
  }));
  
  loggerService.info('API Documentation enabled', {
    docsUrl: `http://localhost:${PORT}/api-docs`,
    jsonUrl: `http://localhost:${PORT}/api-docs/json`
  });
}

// API routes
import authRoutes from './modules/auth/auth.routes';
import rbacRoutes from './modules/rbac/rbac.routes';

app.use('/api/auth', authRoutes);
app.use('/api/invitations', invitationRoutes);
app.use('/api/rbac', rbacRoutes);

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const correlationId = (req as any).correlationId;
  
  loggerService
    .withCorrelationId(correlationId)
    .error('Unhandled application error', err, {
      method: req.method,
      url: req.url,
      userAgent: req.headers['user-agent'],
      ip: req.ip
    });
    
  res.status(500).json({ 
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
    correlationId
  });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

app.listen(PORT, () => {
  // Log server startup
  loggerService.info('Server started successfully', {
    port: PORT,
    env: process.env.NODE_ENV || 'development',
    healthCheck: `http://localhost:${PORT}/health`,
    nodeVersion: process.version,
    uptime: process.uptime()
  });
  
  // Log environment validation status (moved from supabase.ts to avoid circular dependency)
  loggerService.info('Environment validation completed', {
    supabaseConfigured: true,
    nodeEnv: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});