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
  brokerName: Joi.string().required().messages({
    'any.required': 'Broker name is required',
  }),
  brokerDescription: Joi.string().optional().allow(''),
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
  token_hash: Joi.string().required().messages({
    'any.required': 'Reset token is required',
  }),
  password: Joi.string().min(8).required().messages({
    'string.min': 'Password must be at least 8 characters',
    'any.required': 'Password is required',
  }),
});

// Schema for ChangePasswordDto
export const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required().messages({
    'any.required': 'Current password is required',
    'string.empty': 'Current password cannot be empty',
  }),
  newPassword: Joi.string().min(8).required().messages({
    'string.min': 'New password must be at least 8 characters long',
    'any.required': 'New password is required',
    'string.empty': 'New password cannot be empty',
  }),
}).custom((value, helpers) => {
  // Additional validation: new password should be different from current
  if (value.currentPassword === value.newPassword) {
    return helpers.error('password.same');
  }
  return value;
}).messages({
  'password.same': 'New password must be different from current password',
});

// Schema for UpdateProfileDto
export const updateProfileSchema = Joi.object({
  firstName: Joi.string().optional().min(1).max(50).messages({
    'string.min': 'First name cannot be empty',
    'string.max': 'First name cannot exceed 50 characters',
    'string.empty': 'First name cannot be empty',
  }),
  lastName: Joi.string().optional().min(1).max(50).messages({
    'string.min': 'Last name cannot be empty',
    'string.max': 'Last name cannot exceed 50 characters',
    'string.empty': 'Last name cannot be empty',
  }),
  phone: Joi.string().optional().allow('').min(8).max(20).messages({
    'string.min': 'Phone number must be at least 8 characters',
    'string.max': 'Phone number cannot exceed 20 characters',
  }),
}).min(1).messages({
  'object.min': 'At least one field must be provided for update',
});

// Schema for RefreshTokenDto
export const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required(),
});

// Schema for ChangeEmailDto
export const changeEmailSchema = Joi.object({
  newEmail: Joi.string().email().required().messages({
    'string.email': 'Invalid email format',
    'any.required': 'New email is required',
    'string.empty': 'New email cannot be empty',
  }),
  password: Joi.string().required().messages({
    'any.required': 'Current password is required',
    'string.empty': 'Current password cannot be empty',
  }),
}); 