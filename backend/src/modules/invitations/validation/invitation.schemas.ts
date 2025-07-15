import Joi from 'joi';

export const sendInvitationSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Invalid email format',
    'any.required': 'Email is required',
    'string.empty': 'Email cannot be empty',
  }),
  childBrokerName: Joi.string().required().min(2).max(100).messages({
    'any.required': 'Child broker name is required',
    'string.empty': 'Child broker name cannot be empty',
    'string.min': 'Child broker name must be at least 2 characters',
    'string.max': 'Child broker name cannot exceed 100 characters',
  }),
  childBrokerDescription: Joi.string().optional().allow('').max(500).messages({
    'string.max': 'Child broker description cannot exceed 500 characters',
  }),
});

export const acceptInvitationSchema = Joi.object({
  token: Joi.string().required().messages({
    'any.required': 'Invitation token is required',
    'string.empty': 'Invitation token cannot be empty',
  }),
  password: Joi.string().min(8).required().messages({
    'string.min': 'Password must be at least 8 characters',
    'any.required': 'Password is required',
    'string.empty': 'Password cannot be empty',
  }),
  firstName: Joi.string().required().min(1).max(50).messages({
    'any.required': 'First name is required',
    'string.empty': 'First name cannot be empty',
    'string.min': 'First name cannot be empty',
    'string.max': 'First name cannot exceed 50 characters',
  }),
  lastName: Joi.string().required().min(1).max(50).messages({
    'any.required': 'Last name is required',
    'string.empty': 'Last name cannot be empty',
    'string.min': 'Last name cannot be empty',
    'string.max': 'Last name cannot exceed 50 characters',
  }),
  cedulaRuc: Joi.string().required().min(10).max(13).messages({
    'any.required': 'Cedula/RUC is required',
    'string.empty': 'Cedula/RUC cannot be empty',
    'string.min': 'Cedula/RUC must be at least 10 characters',
    'string.max': 'Cedula/RUC cannot exceed 13 characters',
  }),
  phone: Joi.string().optional().allow('').min(8).max(20).messages({
    'string.min': 'Phone number must be at least 8 characters',
    'string.max': 'Phone number cannot exceed 20 characters',
  }),
}); 