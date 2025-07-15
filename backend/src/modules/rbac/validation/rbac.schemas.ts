import Joi from 'joi';

// Role Schemas
export const createRoleSchema = Joi.object({
  name: Joi.string().trim().min(2).max(50).required().messages({
    'string.min': 'Role name must be at least 2 characters',
    'string.max': 'Role name cannot exceed 50 characters',
    'any.required': 'Role name is required',
  }),
  description: Joi.string().trim().max(255).optional().allow(''),
  level: Joi.number().integer().min(1).max(10).optional().default(1).messages({
    'number.min': 'Role level must be at least 1',
    'number.max': 'Role level cannot exceed 10',
  }),
});

export const updateRoleSchema = Joi.object({
  name: Joi.string().trim().min(2).max(50).optional(),
  description: Joi.string().trim().max(255).optional().allow(''),
  level: Joi.number().integer().min(1).max(10).optional().messages({
    'number.min': 'Role level must be at least 1',
    'number.max': 'Role level cannot exceed 10',
  }),
}).min(1).messages({
  'object.min': 'At least one field must be provided for update',
});

// Permission Schemas
export const createPermissionSchema = Joi.object({
  resource: Joi.string().trim().min(2).max(50).required().messages({
    'string.min': 'Resource must be at least 2 characters',
    'string.max': 'Resource cannot exceed 50 characters',
    'any.required': 'Resource is required',
  }),
  action: Joi.string().trim().min(2).max(50).required().messages({
    'string.min': 'Action must be at least 2 characters',
    'string.max': 'Action cannot exceed 50 characters',
    'any.required': 'Action is required',
  }),
  description: Joi.string().trim().max(255).optional().allow(''),
});

export const updatePermissionSchema = Joi.object({
  description: Joi.string().trim().max(255).optional().allow(''),
});

// User Role Assignment Schemas
export const assignRoleSchema = Joi.object({
  userId: Joi.string().uuid().required().messages({
    'string.uuid': 'User ID must be a valid UUID',
    'any.required': 'User ID is required',
  }),
  roleId: Joi.string().uuid().required().messages({
    'string.uuid': 'Role ID must be a valid UUID',
    'any.required': 'Role ID is required',
  }),
});

export const assignMultipleRolesSchema = Joi.object({
  userId: Joi.string().uuid().required().messages({
    'string.uuid': 'User ID must be a valid UUID',
    'any.required': 'User ID is required',
  }),
  roleIds: Joi.array().items(
    Joi.string().uuid().messages({
      'string.uuid': 'Each role ID must be a valid UUID',
    })
  ).min(1).required().messages({
    'array.min': 'At least one role ID is required',
    'any.required': 'Role IDs are required',
  }),
});

export const replaceUserRolesSchema = Joi.object({
  userId: Joi.string().uuid().required().messages({
    'string.uuid': 'User ID must be a valid UUID',
    'any.required': 'User ID is required',
  }),
  roleIds: Joi.array().items(
    Joi.string().uuid().messages({
      'string.uuid': 'Each role ID must be a valid UUID',
    })
  ).required().messages({
    'any.required': 'Role IDs are required',
  }),
});

// Role Permission Assignment Schemas
export const assignPermissionToRoleSchema = Joi.object({
  roleId: Joi.string().uuid().required().messages({
    'string.uuid': 'Role ID must be a valid UUID',
    'any.required': 'Role ID is required',
  }),
  permissionId: Joi.string().uuid().required().messages({
    'string.uuid': 'Permission ID must be a valid UUID',
    'any.required': 'Permission ID is required',
  }),
});

export const bulkAssignPermissionsSchema = Joi.object({
  roleId: Joi.string().uuid().required().messages({
    'string.uuid': 'Role ID must be a valid UUID',
    'any.required': 'Role ID is required',
  }),
  permissionIds: Joi.array().items(
    Joi.string().uuid().messages({
      'string.uuid': 'Each permission ID must be a valid UUID',
    })
  ).min(1).required().messages({
    'array.min': 'At least one permission ID is required',
    'any.required': 'Permission IDs are required',
  }),
});

export const replaceRolePermissionsSchema = Joi.object({
  roleId: Joi.string().uuid().required().messages({
    'string.uuid': 'Role ID must be a valid UUID',
    'any.required': 'Role ID is required',
  }),
  permissionIds: Joi.array().items(
    Joi.string().uuid().messages({
      'string.uuid': 'Each permission ID must be a valid UUID',
    })
  ).required().messages({
    'any.required': 'Permission IDs are required',
  }),
});

// Authorization Schemas
export const checkPermissionSchema = Joi.object({
  userId: Joi.string().uuid().required().messages({
    'string.uuid': 'User ID must be a valid UUID',
    'any.required': 'User ID is required',
  }),
  permission: Joi.string().pattern(/^[a-zA-Z0-9_]+:[a-zA-Z0-9_:]+$/).required().messages({
    'string.pattern.base': 'Permission must be in format "resource:action"',
    'any.required': 'Permission is required',
  }),
});

export const checkMultiplePermissionsSchema = Joi.object({
  userId: Joi.string().uuid().required().messages({
    'string.uuid': 'User ID must be a valid UUID',
    'any.required': 'User ID is required',
  }),
  permissions: Joi.array().items(
    Joi.string().pattern(/^[a-zA-Z0-9_]+:[a-zA-Z0-9_:]+$/).messages({
      'string.pattern.base': 'Each permission must be in format "resource:action"',
    })
  ).min(1).required().messages({
    'array.min': 'At least one permission is required',
    'any.required': 'Permissions are required',
  }),
});

// Param validation schemas
export const uuidParamSchema = Joi.object({
  id: Joi.string().uuid().required().messages({
    'string.uuid': 'ID must be a valid UUID',
    'any.required': 'ID is required',
  }),
});

export const roleNameParamSchema = Joi.object({
  roleName: Joi.string().trim().min(2).max(50).required().messages({
    'string.min': 'Role name must be at least 2 characters',
    'string.max': 'Role name cannot exceed 50 characters',
    'any.required': 'Role name is required',
  }),
});

export const resourceParamSchema = Joi.object({
  resource: Joi.string().trim().min(2).max(50).required().messages({
    'string.min': 'Resource must be at least 2 characters',
    'string.max': 'Resource cannot exceed 50 characters',
    'any.required': 'Resource is required',
  }),
});

export const permissionParamSchema = Joi.object({
  permission: Joi.string().pattern(/^[a-zA-Z0-9_]+:[a-zA-Z0-9_:]+$/).required().messages({
    'string.pattern.base': 'Permission must be in format "resource:action"',
    'any.required': 'Permission is required',
  }),
});