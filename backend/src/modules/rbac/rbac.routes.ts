import { Router } from 'express';
import { RbacController } from './rbac.controller';
import { authMiddleware, requirePermission, requireRole } from '../../common/middlewares/auth.middleware';
import { requireBrokerAccess } from '../../common/middlewares/brokerIsolation.middleware';
import { validateRequest } from '../../common/middlewares/validation.middleware';
import {
  createRoleSchema,
  updateRoleSchema,
  createPermissionSchema,
  updatePermissionSchema,
  assignRoleSchema,
  assignMultipleRolesSchema,
  replaceUserRolesSchema,
  assignPermissionToRoleSchema,
  bulkAssignPermissionsSchema,
  replaceRolePermissionsSchema,
  checkPermissionSchema,
  // checkMultiplePermissionsSchema,
  uuidParamSchema,
  roleNameParamSchema,
  resourceParamSchema,
  permissionParamSchema,
} from './validation/rbac.schemas';

const router = Router();
const rbacController = new RbacController();

// Validate UUID params middleware
const validateUuidParam = validateRequest(uuidParamSchema);
const validateRoleNameParam = validateRequest(roleNameParamSchema);
const validateResourceParam = validateRequest(resourceParamSchema);
const validatePermissionParam = validateRequest(permissionParamSchema);

// Role Management Routes
router.post(
  '/roles',
  authMiddleware,
  requirePermission('users:assign:roles'),
  validateRequest(createRoleSchema),
  rbacController.createRole
);

router.get(
  '/roles',
  authMiddleware,
  requirePermission('users:read'),
  rbacController.getRoles
);

router.get(
  '/roles/:id',
  authMiddleware,
  requirePermission('users:read'),
  validateUuidParam,
  rbacController.getRoleById
);

router.put(
  '/roles/:id',
  authMiddleware,
  requirePermission('users:assign:roles'),
  validateUuidParam,
  validateRequest(updateRoleSchema),
  rbacController.updateRole
);

router.delete(
  '/roles/:id',
  authMiddleware,
  requirePermission('users:assign:roles'),
  validateUuidParam,
  rbacController.deleteRole
);

// Permission Management Routes
router.post(
  '/permissions',
  authMiddleware,
  requireRole('broker_admin'),
  validateRequest(createPermissionSchema),
  rbacController.createPermission
);

router.get(
  '/permissions',
  authMiddleware,
  requirePermission('users:read'),
  rbacController.getPermissions
);

router.get(
  '/permissions/resource/:resource',
  authMiddleware,
  requirePermission('users:read'),
  validateResourceParam,
  rbacController.getPermissionsByResource
);

router.put(
  '/permissions/:id',
  authMiddleware,
  requireRole('broker_admin'),
  validateUuidParam,
  validateRequest(updatePermissionSchema),
  rbacController.updatePermission
);

router.delete(
  '/permissions/:id',
  authMiddleware,
  requireRole('broker_admin'),
  validateUuidParam,
  rbacController.deletePermission
);

// User Role Assignment Routes (Broker Isolation Required)
router.post(
  '/users/roles/assign',
  authMiddleware,
  requireBrokerAccess('hierarchy'),
  requirePermission('users:assign:roles'),
  validateRequest(assignRoleSchema),
  rbacController.assignRoleToUser
);

router.delete(
  '/users/roles/remove',
  authMiddleware,
  requireBrokerAccess('hierarchy'),
  requirePermission('users:assign:roles'),
  validateRequest(assignRoleSchema),
  rbacController.removeRoleFromUser
);

router.get(
  '/users/:userId/roles',
  authMiddleware,
  requireBrokerAccess('hierarchy'),
  requirePermission('users:read'),
  validateUuidParam,
  rbacController.getUserRoles
);

router.get(
  '/roles/:roleName/users',
  authMiddleware,
  requireBrokerAccess('hierarchy'),
  requirePermission('users:read'),
  validateRoleNameParam,
  rbacController.getUsersWithRole
);

router.post(
  '/users/roles/assign-multiple',
  authMiddleware,
  requireBrokerAccess('hierarchy'),
  requirePermission('users:assign:roles'),
  validateRequest(assignMultipleRolesSchema),
  rbacController.assignMultipleRoles
);

router.put(
  '/users/roles/replace',
  authMiddleware,
  requireBrokerAccess('hierarchy'),
  requirePermission('users:assign:roles'),
  validateRequest(replaceUserRolesSchema),
  rbacController.replaceUserRoles
);

// Role Permission Assignment Routes
router.post(
  '/roles/permissions/assign',
  authMiddleware,
  requireRole('broker_admin'),
  validateRequest(assignPermissionToRoleSchema),
  rbacController.assignPermissionToRole
);

router.delete(
  '/roles/permissions/remove',
  authMiddleware,
  requireRole('broker_admin'),
  validateRequest(assignPermissionToRoleSchema),
  rbacController.removePermissionFromRole
);

router.get(
  '/roles/:roleId/permissions',
  authMiddleware,
  requirePermission('users:read'),
  validateUuidParam,
  rbacController.getRolePermissions
);

router.post(
  '/roles/permissions/assign-multiple',
  authMiddleware,
  requireRole('broker_admin'),
  validateRequest(bulkAssignPermissionsSchema),
  rbacController.bulkAssignPermissionsToRole
);

router.put(
  '/roles/permissions/replace',
  authMiddleware,
  requireRole('broker_admin'),
  validateRequest(replaceRolePermissionsSchema),
  rbacController.replaceRolePermissions
);

// User Permissions & Authorization Routes (Broker Isolation Required)
router.get(
  '/users/:userId/permissions',
  authMiddleware,
  requireBrokerAccess('hierarchy'),
  requirePermission('users:read'),
  validateUuidParam,
  rbacController.getUserPermissions
);

router.post(
  '/users/check-permission',
  authMiddleware,
  requireBrokerAccess('hierarchy'),
  requirePermission('users:read'),
  validateRequest(checkPermissionSchema),
  rbacController.checkUserPermission
);

router.get(
  '/users/:userId/access-summary',
  authMiddleware,
  requireBrokerAccess('hierarchy'),
  requirePermission('users:read'),
  validateUuidParam,
  rbacController.getUserAccessSummary
);

router.get(
  '/permissions/:permission/users',
  authMiddleware,
  requireBrokerAccess('hierarchy'),
  requirePermission('users:read'),
  validatePermissionParam,
  rbacController.getUsersWithPermission
);

// Self-service routes (users can view their own permissions)
router.get(
  '/me/roles',
  authMiddleware,
  async (req, _res, next) => {
    const user = (req as any).user;
    req.params.userId = user.id;
    next();
  },
  rbacController.getUserRoles
);

router.get(
  '/me/permissions',
  authMiddleware,
  async (req, _res, next) => {
    const user = (req as any).user;
    req.params.userId = user.id;
    next();
  },
  rbacController.getUserPermissions
);

router.get(
  '/me/access-summary',
  authMiddleware,
  async (req, _res, next) => {
    const user = (req as any).user;
    req.params.userId = user.id;
    next();
  },
  rbacController.getUserAccessSummary
);

export default router;