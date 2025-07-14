import pino from 'pino';

interface UserLog {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  isActive?: boolean;
}

const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.NODE_ENV === 'development';

// Create logger configuration based on environment
const loggerConfig: pino.LoggerOptions = {
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),

  // Base configuration
  base: {
    pid: false, // Don't include process ID in logs
    hostname: false, // Don't include hostname in logs
  },

  // Custom timestamp format
  timestamp: pino.stdTimeFunctions.isoTime,

  // Redact sensitive information
  redact: {
    paths: [
      'password',
      'newPassword',
      'currentPassword',
      'token',
      'refreshToken',
      'access_token',
      'refresh_token',
      'authorization',
      'cookie',
    ],
    censor: '[REDACTED]',
  },

  // Custom serializers
  serializers: {
    err: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,

    // Custom user serializer to log only safe user data
    user: (user: UserLog) => {
      if (!user) return user;
      return {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isActive: user.isActive,
      };
    },
  },

  // Development-specific configuration
  ...(isDevelopment && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
        singleLine: false,
        levelFirst: true,
        messageFormat: '{levelLabel} - {msg}',
      },
    },
  }),

  // Production-specific configuration
  ...(isProduction && {
    formatters: {
      level: (label: string) => {
        return { level: label };
      },
    },
  }),
};

export default loggerConfig;
