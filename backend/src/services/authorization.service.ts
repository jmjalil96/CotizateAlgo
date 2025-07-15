import { prisma } from '../config/database';
import { PermissionService } from './permission.service';
import { UserRoleService } from './userRole.service';
import { ForbiddenError, NotFoundError } from '../common/errors';

export class AuthorizationService {
  private permissionService: PermissionService;
  private userRoleService: UserRoleService;

  constructor() {
    this.permissionService = new PermissionService();
    this.userRoleService = new UserRoleService();
  }

  /**
   * Centralized broker access validation. Throws an error if access is denied.
   * @private
   */
  private async _validateUserAccess(
    targetUserId: string,
    accessibleBrokerIds: string[]
  ) {
    if (!targetUserId) {
      throw new Error('Target user ID is required for validation.');
    }
    const targetUser = await prisma.profile.findUnique({
      where: { id: targetUserId },
    });

    if (!targetUser) {
      throw new NotFoundError('Target user not found.');
    }

    if (!targetUser.brokerId) {
      throw new NotFoundError('Target user does not belong to a broker.');
    }

    if (!accessibleBrokerIds.includes(targetUser.brokerId)) {
      throw new ForbiddenError(
        "Access denied: You cannot manage users outside of your broker's hierarchy."
      );
    }
  }

  async checkUserPermission(
    userId: string,
    permission: string,
    accessibleBrokerIds: string[]
  ) {
    await this._validateUserAccess(userId, accessibleBrokerIds);
    return this.permissionService.userHasPermission(userId, permission);
  }

  async canUserAccessResource(
    userId: string,
    resource: string,
    action: string
  ) {
    const permission = `${resource}:${action}`;

    try {
      const hasPermission = await this.permissionService.userHasPermission(
        userId,
        permission
      );
      return {
        allowed: hasPermission,
        permission,
        userId,
      };
    } catch (error) {
      return {
        allowed: false,
        permission,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async canUserAccessAnyResource(
    userId: string,
    resourceActions: Array<{ resource: string; action: string }>
  ) {
    const permissions = resourceActions.map(
      ra => `${ra.resource}:${ra.action}`
    );

    try {
      const hasAnyPermission =
        await this.permissionService.userHasAnyPermission(userId, permissions);
      return {
        allowed: hasAnyPermission,
        permissions,
        userId,
      };
    } catch (error) {
      return {
        allowed: false,
        permissions,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async filterUsersByPermission(
    userIds: string[],
    permission: string,
    accessibleBrokerIds: string[]
  ) {
    const [resource, action] = permission.split(':');

    if (!resource || !action) {
      throw new Error('Invalid permission format. Use "resource:action"');
    }

    // Pre-filter users to only those accessible by the requester
    const accessibleUsers = await prisma.profile.findMany({
      where: {
        id: { in: userIds },
        brokerId: { in: accessibleBrokerIds },
      },
      select: { id: true },
    });
    const accessibleUserIds = accessibleUsers.map(u => u.id);

    // Get users who have the specified permission from the accessible list
    const usersWithPermission = await prisma.userRole.findMany({
      where: {
        userId: {
          in: accessibleUserIds,
        },
        role: {
          rolePermissions: {
            some: {
              permission: {
                resource,
                action,
              },
            },
          },
        },
      },
      select: {
        userId: true,
      },
    });

    const authorizedUserIds = usersWithPermission.map(u => u.userId);
    const unauthorizedUserIds = userIds.filter(
      id => !authorizedUserIds.includes(id)
    );

    return {
      permission,
      authorizedUsers: authorizedUserIds,
      unauthorizedUsers: unauthorizedUserIds,
      totalUsers: userIds.length,
      authorizedCount: authorizedUserIds.length,
    };
  }

  async filterResourcesByUserPermissions(
    userId: string,
    resources: Array<{ id: string; resource: string; requiredAction: string }>
  ) {
    const userPermissions =
      await this.permissionService.getUserPermissions(userId);

    const accessibleResources = resources.filter(resource => {
      const requiredPermission = `${resource.resource}:${resource.requiredAction}`;
      return userPermissions.permissions.includes(requiredPermission);
    });

    const inaccessibleResources = resources.filter(resource => {
      const requiredPermission = `${resource.resource}:${resource.requiredAction}`;
      return !userPermissions.permissions.includes(requiredPermission);
    });

    return {
      userId,
      accessibleResources,
      inaccessibleResources,
      totalResources: resources.length,
      accessibleCount: accessibleResources.length,
    };
  }

  async canUserManageUser(managerId: string, targetUserId: string) {
    // Check if manager has user management permissions
    const canManageUsers = await this.permissionService.userHasAnyPermission(
      managerId,
      ['users:update', 'users:delete', 'users:assign:roles']
    );

    if (!canManageUsers) {
      return {
        allowed: false,
        reason: 'Manager does not have user management permissions',
        managerId,
        targetUserId,
      };
    }

    // Additional business logic can be added here
    // For example: prevent users from managing themselves for certain actions
    if (managerId === targetUserId) {
      const canManageSelf = await this.permissionService.userHasPermission(
        managerId,
        'users:update:own'
      );
      return {
        allowed: canManageSelf,
        reason: canManageSelf
          ? 'Self-management allowed'
          : 'Self-management not permitted',
        managerId,
        targetUserId,
        isSelfManagement: true,
      };
    }

    return {
      allowed: true,
      reason: 'User management authorized',
      managerId,
      targetUserId,
    };
  }

  async getUserAccessSummary(userId: string, accessibleBrokerIds: string[]) {
    await this._validateUserAccess(userId, accessibleBrokerIds);

    const userRoles = await this.userRoleService.getUserRoles(userId);
    const userPermissions =
      await this.permissionService.getUserPermissions(userId);

    // Group permissions by resource
    const permissionsByResource = userPermissions.detailedPermissions.reduce(
      (acc, permission) => {
        if (!acc[permission.resource]) {
          acc[permission.resource] = [];
        }
        acc[permission.resource].push({
          action: permission.action,
          description: permission.description,
          fromRole: permission.fromRole,
        });
        return acc;
      },
      {} as Record<
        string,
        Array<{ action: string; description: string | null; fromRole: string }>
      >
    );

    return {
      userId,
      summary: {
        roleCount: userRoles.length,
        permissionCount: userPermissions.permissions.length,
        resourceCount: Object.keys(permissionsByResource).length,
      },
      roles: userRoles.map(role => ({
        id: role.id,
        name: role.name,
        assignedAt: role.assignedAt,
        assignedBy: role.assignedBy,
        permissionCount: role.permissions.length,
      })),
      permissionsByResource,
      flatPermissions: userPermissions.permissions,
    };
  }

  async validateRoleAssignment(
    assignerId: string,
    targetUserId: string,
    roleId: string
  ) {
    // Check if assigner has role assignment permissions
    const canAssignRoles = await this.permissionService.userHasPermission(
      assignerId,
      'users:assign:roles'
    );

    if (!canAssignRoles) {
      return {
        valid: false,
        reason: 'Assigner does not have role assignment permissions',
        assignerId,
        targetUserId,
        roleId,
      };
    }

    // Check if target user exists
    const targetUser = await prisma.profile.findUnique({
      where: { id: targetUserId },
    });

    if (!targetUser) {
      return {
        valid: false,
        reason: 'Target user not found',
        assignerId,
        targetUserId,
        roleId,
      };
    }

    // Check if role exists
    const role = await prisma.role.findUnique({
      where: { id: roleId },
    });

    if (!role) {
      return {
        valid: false,
        reason: 'Role not found',
        assignerId,
        targetUserId,
        roleId,
      };
    }

    // Check if user already has the role
    const existingUserRole = await prisma.userRole.findUnique({
      where: {
        userId_roleId: {
          userId: targetUserId,
          roleId,
        },
      },
    });

    if (existingUserRole) {
      return {
        valid: false,
        reason: 'User already has this role',
        assignerId,
        targetUserId,
        roleId,
      };
    }

    return {
      valid: true,
      reason: 'Role assignment is valid',
      assignerId,
      targetUserId,
      roleId,
      targetUser: {
        id: targetUser.id,
        firstName: targetUser.firstName,
        lastName: targetUser.lastName,
      },
      role: {
        id: role.id,
        name: role.name,
        description: role.description,
      },
    };
  }

  async logPermissionCheck(
    userId: string,
    permission: string,
    granted: boolean,
    context?: Record<string, any>
  ) {
    // This could be extended to write to a separate audit log table
    // For now, we'll just console.log for development
    const logEntry = {
      timestamp: new Date().toISOString(),
      userId,
      permission,
      granted,
      context,
    };

    console.log('Permission Check:', logEntry);

    // In production, you might want to:
    // - Write to an audit log table
    // - Send to a logging service
    // - Trigger alerts for failed permission checks

    return logEntry;
  }

  async getResourceAccessMatrix(userIds: string[], resources: string[]) {
    const matrix: Record<string, Record<string, boolean>> = {};

    // Initialize matrix
    userIds.forEach(userId => {
      matrix[userId] = {};
      resources.forEach(resource => {
        matrix[userId][resource] = false;
      });
    });

    // Populate matrix with actual permissions
    for (const userId of userIds) {
      const userPermissions =
        await this.permissionService.getUserPermissions(userId);

      resources.forEach(resource => {
        const hasPermission = userPermissions.permissions.includes(resource);
        matrix[userId][resource] = hasPermission;
      });
    }

    return {
      matrix,
      userCount: userIds.length,
      resourceCount: resources.length,
      summary: {
        totalCells: userIds.length * resources.length,
        grantedCells: Object.values(matrix).reduce(
          (count, userPermissions) =>
            count + Object.values(userPermissions).filter(Boolean).length,
          0
        ),
      },
    };
  }
}
