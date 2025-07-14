import Joi from 'joi';

// Schema for RegisterDto
export const registerSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Invalid email format',
    'any.required': 'Email is required',
  }),
  password: Joi.string().min(8).required().messages({
    'string.min': 'Password must be at least 8 characters',
    'any.required': 'Password is required',
  }),
  firstName: Joi.string().required().messages({
    'any.required': 'First name is required',
  }),
  lastName: Joi.string().required().messages({
    'any.required': 'Last name is required',
  }),
  cedulaRuc: Joi.string().required().messages({
    'any.required': 'Cedula/RUC is required',
  }),
  phone: Joi.string().optional().allow(''),
  brokerName: Joi.string().optional(),
});

// Schema for LoginDto
export const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

// Schema for ForgotPasswordDto
export const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().required(),
});

// Schema for ResetPasswordDto
export const resetPasswordSchema = Joi.object({
  token: Joi.string().required(),
  password: Joi.string().min(8).required(),
});

// Schema for ChangePasswordDto
export const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(8).required(),
});

// Schema for UpdateProfileDto
export const updateProfileSchema = Joi.object({
  firstName: Joi.string().optional(),
  lastName: Joi.string().optional(),
  phone: Joi.string().optional().allow(''),
});

// Schema for RefreshTokenDto
export const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required(),
});

// Schema for ChangeEmailDto
export const changeEmailSchema = Joi.object({
  newEmail: Joi.string().email().required(),
  password: Joi.string().required(),
}); 