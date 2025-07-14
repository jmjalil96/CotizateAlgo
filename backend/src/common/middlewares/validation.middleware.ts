import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

export const validateRequest = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error } = schema.validate(req.body, { abortEarly: false });

    if (error) {
      const errorMessages = error.details.map((detail: Joi.ValidationErrorItem) => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errorMessages,
      });
      return; // Explicit return for error path
    }

    next();
  };
}; 