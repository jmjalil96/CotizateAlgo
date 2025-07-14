import swaggerJsdoc from 'swagger-jsdoc';
import { Options } from 'swagger-jsdoc';

const options: Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'CotizateAlgo API',
      version: '1.0.0',
      description:
        'API documentation for CotizateAlgo - Insurance quote management system',
      contact: {
        name: 'API Support',
        email: 'support@cotizatealgo.com',
      },
    },
    servers: [
      {
        url: process.env.API_URL || 'http://localhost:3000',
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter JWT token',
        },
      },
      schemas: {
        // Auth DTOs
        RegisterDto: {
          type: 'object',
          required: ['email', 'password', 'firstName', 'lastName', 'cedulaRuc'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              example: 'user@example.com',
            },
            password: {
              type: 'string',
              minLength: 8,
              example: 'Password123!',
            },
            firstName: {
              type: 'string',
              example: 'Juan',
            },
            lastName: {
              type: 'string',
              example: 'Pérez',
            },
            cedulaRuc: {
              type: 'string',
              example: '1234567890',
              description: 'Ecuador cedula or RUC number',
            },
            phone: {
              type: 'string',
              example: '+593987654321',
            },
          },
        },
        LoginDto: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              example: 'user@example.com',
            },
            password: {
              type: 'string',
              example: 'Password123!',
            },
          },
        },
        ForgotPasswordDto: {
          type: 'object',
          required: ['email'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              example: 'user@example.com',
            },
          },
        },
        ResetPasswordDto: {
          type: 'object',
          required: ['token', 'password'],
          properties: {
            token: {
              type: 'string',
              example: 'reset-token-here',
            },
            password: {
              type: 'string',
              minLength: 8,
              example: 'NewPassword123!',
            },
          },
        },
        ChangePasswordDto: {
          type: 'object',
          required: ['currentPassword', 'newPassword'],
          properties: {
            currentPassword: {
              type: 'string',
              example: 'OldPassword123!',
            },
            newPassword: {
              type: 'string',
              minLength: 8,
              example: 'NewPassword123!',
            },
          },
        },
        UpdateProfileDto: {
          type: 'object',
          required: ['firstName', 'lastName'],
          properties: {
            firstName: {
              type: 'string',
              example: 'Juan',
            },
            lastName: {
              type: 'string',
              example: 'Pérez',
            },
            phone: {
              type: 'string',
              example: '+593987654321',
            },
          },
        },
        RefreshTokenDto: {
          type: 'object',
          required: ['refreshToken'],
          properties: {
            refreshToken: {
              type: 'string',
              example: 'refresh-token-here',
            },
          },
        },
        ChangeEmailDto: {
          type: 'object',
          required: ['newEmail', 'password'],
          properties: {
            newEmail: {
              type: 'string',
              format: 'email',
              example: 'newemail@example.com',
            },
            password: {
              type: 'string',
              example: 'Password123!',
            },
          },
        },
        AuthResponse: {
          type: 'object',
          properties: {
            user: {
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                  example: 'uuid-here',
                },
                email: {
                  type: 'string',
                  format: 'email',
                  example: 'user@example.com',
                },
                firstName: {
                  type: 'string',
                  example: 'Juan',
                },
                lastName: {
                  type: 'string',
                  example: 'Pérez',
                },
                cedulaRuc: {
                  type: 'string',
                  example: '1234567890',
                },
                phone: {
                  type: 'string',
                  example: '+593987654321',
                },
                avatarUrl: {
                  type: 'string',
                  example: 'https://example.com/avatar.jpg',
                },
                isActive: {
                  type: 'boolean',
                  example: true,
                },
              },
            },
            session: {
              type: 'object',
              properties: {
                access_token: {
                  type: 'string',
                  example: 'jwt-access-token-here',
                },
                refresh_token: {
                  type: 'string',
                  example: 'jwt-refresh-token-here',
                },
                expires_at: {
                  type: 'number',
                  example: 1672531200,
                },
              },
            },
          },
        },
        Error: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              example: 'Error message',
            },
            error: {
              type: 'string',
              example: 'Detailed error information',
            },
          },
        },
        ValidationError: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              example: 'Validation failed',
            },
            errors: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: {
                    type: 'string',
                    example: 'email',
                  },
                  message: {
                    type: 'string',
                    example: 'Invalid email format',
                  },
                },
              },
            },
          },
        },
        SuccessMessage: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              example: 'Operation completed successfully',
            },
          },
        },
      },
      responses: {
        BadRequest: {
          description: 'Bad Request',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ValidationError',
              },
            },
          },
        },
        Unauthorized: {
          description: 'Unauthorized',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
              example: {
                message: 'Invalid credentials',
              },
            },
          },
        },
        Forbidden: {
          description: 'Forbidden',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
              example: {
                message: 'Access denied',
              },
            },
          },
        },
        NotFound: {
          description: 'Not Found',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
              example: {
                message: 'Resource not found',
              },
            },
          },
        },
        InternalServerError: {
          description: 'Internal Server Error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
              example: {
                message: 'Internal server error',
              },
            },
          },
        },
      },
    },
    tags: [
      {
        name: 'Authentication',
        description: 'User authentication and account management endpoints',
      },
    ],
  },
  apis: [
    'src/modules/**/*.routes.ts',
    './src/modules/**/*.routes.ts',
    __dirname + '/../modules/**/*.routes.ts',
  ], // Multiple path patterns to ensure files are found
};

const specs = swaggerJsdoc(options);

export default specs;
