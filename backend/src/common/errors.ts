// src/common/errors.ts

/**
 * Represents an error where the user is authenticated but not authorized
 * to perform the requested action (HTTP 403).
 */
export class ForbiddenError extends Error {
  public readonly statusCode = 403;

  constructor(message: string = 'Forbidden') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

/**
 * Represents an error where a requested resource could not be found (HTTP 404).
 */
export class NotFoundError extends Error {
  public readonly statusCode = 404;

  constructor(message: string = 'Not Found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

/**
 * Represents an error due to invalid input from the client (HTTP 400).
 */
export class BadRequestError extends Error {
  public readonly statusCode = 400;

  constructor(message: string = 'Bad Request') {
    super(message);
    this.name = 'BadRequestError';
  }
}

/**
 * Represents an authentication error (HTTP 401).
 */
export class UnauthorizedError extends Error {
  public readonly statusCode = 401;

  constructor(message: string = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}
