import { prisma } from '../config/database';
import { BrokerHierarchyService } from './brokerHierarchy.service';
import { authLogger } from './logger.service';

export class PermissionService {
  private brokerHierarchyService: BrokerHierarchyService;

  constructor() {
    this.brokerHierarchyService = new BrokerHierarchyService();
  }
  async createPermission(data: {
    resource: string;
    action: string;
    description?: string;
  }) {
    const { resource, action, description } = data;

    // Check if permission already exists
    const existingPermission = await prisma.permission.findUnique({
      where: {
        resource_action: {
          resource,
          action,
        },
      },
    });

    if (existingPermission) {
      throw new Error('Permission already exists');
    }

    const permission = await prisma.permission.create({
      data: {
        resource,
        action,
        description,
      },
    });

    return permission;
  }

  async getPermissions() {
    const permissions = await prisma.permission.findMany({
      orderBy: [{ resource: 'asc' }, { action: 'asc' }],
    });

    return permissions;
  }

  async getPermissionsByResource(resource: string) {
    const permissions = await prisma.permission.findMany({
      where: { resource },
      orderBy: { action: 'asc' },
    });

    return permissions;
  }

  async getPermissionById(id: string) {
    const permission = await prisma.permission.findUnique({
      where: { id },
    });

    if (!permission) {
      throw new Error('Permission not found');
    }

    return permission;
  }

  async updatePermission(id: string, data: { description?: string }) {
    const { description } = data;

    // Check if permission exists
    const permission = await prisma.permission.findUnique({
      where: { id },
    });

    if (!permission) {
      throw new Error('Permission not found');
    }

    const updatedPermission = await prisma.permission.update({
      where: { id },
      data: {
        description,
      },
    });

    return updatedPermission;
  }

  async deletePermission(id: string) {
    // Check if permission exists
    const permission = await prisma.permission.findUnique({
      where: { id },
      include: {
        rolePermissions: true,
      },
    });

    if (!permission) {
      throw new Error('Permission not found');
    }

    // Check if permission is assigned to any roles
    if (permission.rolePermissions.length > 0) {
      throw new Error('Cannot delete permission that is assigned to roles');
    }

    await prisma.permission.delete({
      where: { id },
    });

    return { message: 'Permission deleted successfully' };
  }

  async userHasPermission(userId: string, permission: string) {
    const [resource, action] = permission.split(':');

    if (!resource || !action) {
      throw new Error('Invalid permission format. Use "resource:action"');
    }

    const userPermission = await prisma.userRole.findFirst({
      where: {
        userId,
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
    });

    return !!userPermission;
  }

  async userHasAnyPermission(userId: string, permissions: string[]) {
    for (const permission of permissions) {
      const hasPermission = await this.userHasPermission(userId, permission);
      if (hasPermission) {
        return true;
      }
    }
    return false;
  }

  async getUserPermissions(userId: string) {
    const userRoles = await prisma.userRole.findMany({
      where: { userId },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    // Flatten and deduplicate permissions
    const permissionsSet = new Set<string>();
    const detailedPermissions: Array<{
      id: string;
      resource: string;
      action: string;
      description: string | null;
      fromRole: string;
    }> = [];

    userRoles.forEach(userRole => {
      userRole.role.rolePermissions.forEach(rolePermission => {
        const permission = rolePermission.permission;
        const permissionString = `${permission.resource}:${permission.action}`;

        if (!permissionsSet.has(permissionString)) {
          permissionsSet.add(permissionString);
          detailedPermissions.push({
            id: permission.id,
            resource: permission.resource,
            action: permission.action,
            description: permission.description,
            fromRole: userRole.role.name,
          });
        }
      });
    });

    return {
      userId,
      permissions: Array.from(permissionsSet),
      detailedPermissions,
      roleCount: userRoles.length,
    };
  }

  async getResourcePermissions() {
    const permissions = await this.getPermissions();

    // Group permissions by resource
    const resourcePermissions = permissions.reduce(
      (acc, permission) => {
        if (!acc[permission.resource]) {
          acc[permission.resource] = [];
        }
        acc[permission.resource].push({
          id: permission.id,
          action: permission.action,
          description: permission.description,
        });
        return acc;
      },
      {} as Record<
        string,
        Array<{ id: string; action: string; description: string | null }>
      >
    );

    return resourcePermissions;
  }

  async getUsersWithPermission(permission: string, brokerFilter: any) {
    const [resource, action] = permission.split(':');

    if (!resource || !action) {
      throw new Error('Invalid permission format. Use "resource:action"');
    }

    const usersWithPermission = await prisma.userRole.findMany({
      where: {
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
        user: brokerFilter,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            cedulaRuc: true,
            isActive: true,
          },
        },
        role: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Deduplicate users (in case they have multiple roles with the same permission)
    const uniqueUsers = usersWithPermission.reduce(
      (acc, item) => {
        const existingUser = acc.find(u => u.user.id === item.user.id);
        if (existingUser) {
          existingUser.roles.push(item.role);
        } else {
          acc.push({
            user: item.user,
            roles: [item.role],
          });
        }
        return acc;
      },
      [] as Array<{
        user: (typeof usersWithPermission)[0]['user'];
        roles: Array<{ id: string; name: string }>;
      }>
    );

    return {
      permission: `${resource}:${action}`,
      userCount: uniqueUsers.length,
      users: uniqueUsers,
    };
  }

  /**
   * Check if user has permission within a specific broker context
   * Handles broker-scoped permissions and :own scope validation
   */
  async userHasPermissionInBroker(
    userId: string,
    permission: string,
    targetBrokerId: string
  ): Promise<boolean> {
    authLogger.debug('Checking user permission in broker context', {
      userId,
      permission,
      targetBrokerId,
      operation: 'user_permission_broker_check',
    });

    try {
      const [resource, action, scope] = permission.split(':');

      if (!resource || !action) {
        throw new Error(
          'Invalid permission format. Use "resource:action" or "resource:action:scope"'
        );
      }

      // Get user's profile with broker information
      const userProfile = await prisma.profile.findUnique({
        where: { id: userId },
        include: {
          broker: true,
          userRoles: {
            include: {
              role: {
                include: {
                  rolePermissions: {
                    include: {
                      permission: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!userProfile) {
        authLogger.warn('User profile not found for permission check', {
          userId,
          permission,
          targetBrokerId,
          operation: 'user_permission_broker_check',
        });
        return false;
      }

      // Check if user has the base permission (resource:action)
      const hasBasePermission = userProfile.userRoles.some(userRole =>
        userRole.role.rolePermissions.some(
          rolePermission =>
            rolePermission.permission.resource === resource &&
            rolePermission.permission.action === action
        )
      );

      if (!hasBasePermission) {
        authLogger.debug('User lacks base permission', {
          userId,
          permission,
          targetBrokerId,
          operation: 'user_permission_broker_check',
        });
        return false;
      }

      // If no scope specified, check if user can access the target broker
      if (!scope) {
        if (!userProfile.brokerId) {
          // System user with no broker - allow if they have the permission
          return true;
        }

        const canAccessBroker =
          await this.brokerHierarchyService.canUserAccessBroker(
            userProfile.brokerId,
            targetBrokerId
          );

        authLogger.debug('Broker access check result', {
          userId,
          userBrokerId: userProfile.brokerId,
          targetBrokerId,
          canAccessBroker,
          operation: 'user_permission_broker_check',
        });

        return canAccessBroker;
      }

      // Handle :own scope - user can only access their own broker
      if (scope === 'own') {
        const isOwnBroker = userProfile.brokerId === targetBrokerId;

        authLogger.debug('Own scope permission check result', {
          userId,
          userBrokerId: userProfile.brokerId,
          targetBrokerId,
          isOwnBroker,
          operation: 'user_permission_own_scope_check',
        });

        return isOwnBroker;
      }

      // Unknown scope
      authLogger.warn('Unknown permission scope', {
        userId,
        permission,
        scope,
        targetBrokerId,
        operation: 'user_permission_unknown_scope',
      });

      return false;
    } catch (error) {
      authLogger.error(
        'Error checking user permission in broker',
        error as Error,
        {
          userId,
          permission,
          targetBrokerId,
          operation: 'user_permission_broker_check_error',
        }
      );
      return false;
    }
  }

  /**
   * Validate permission scope against user's broker context
   * Returns the effective broker IDs the user can access for this permission
   */
  async getEffectiveBrokerIds(
    userId: string,
    permission: string
  ): Promise<string[]> {
    authLogger.debug('Getting effective broker IDs for user permission', {
      userId,
      permission,
      operation: 'get_effective_broker_ids',
    });

    try {
      const [resource, action, scope] = permission.split(':');

      if (!resource || !action) {
        throw new Error(
          'Invalid permission format. Use "resource:action" or "resource:action:scope"'
        );
      }

      // Get user's profile with broker information
      const userProfile = await prisma.profile.findUnique({
        where: { id: userId },
        include: {
          broker: true,
          userRoles: {
            include: {
              role: {
                include: {
                  rolePermissions: {
                    include: {
                      permission: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!userProfile) {
        authLogger.warn('User profile not found for effective broker IDs', {
          userId,
          permission,
          operation: 'get_effective_broker_ids',
        });
        return [];
      }

      // Check if user has the permission
      const hasPermission = userProfile.userRoles.some(userRole =>
        userRole.role.rolePermissions.some(
          rolePermission =>
            rolePermission.permission.resource === resource &&
            rolePermission.permission.action === action
        )
      );

      if (!hasPermission) {
        authLogger.debug('User lacks permission for effective broker IDs', {
          userId,
          permission,
          operation: 'get_effective_broker_ids',
        });
        return [];
      }

      // If user has no broker (system user), return empty array
      if (!userProfile.brokerId) {
        authLogger.debug('System user has no broker context', {
          userId,
          permission,
          operation: 'get_effective_broker_ids',
        });
        return [];
      }

      // Handle :own scope - only user's own broker
      if (scope === 'own') {
        authLogger.debug('Own scope - returning user broker only', {
          userId,
          userBrokerId: userProfile.brokerId,
          permission,
          operation: 'get_effective_broker_ids',
        });
        return [userProfile.brokerId];
      }

      // No scope or unknown scope - return user's accessible broker hierarchy
      const accessibleBrokerIds =
        await this.brokerHierarchyService.getDescendantBrokerIds(
          userProfile.brokerId
        );

      authLogger.debug('Hierarchy scope - returning accessible brokers', {
        userId,
        userBrokerId: userProfile.brokerId,
        accessibleBrokerCount: accessibleBrokerIds.length,
        permission,
        operation: 'get_effective_broker_ids',
      });

      return accessibleBrokerIds;
    } catch (error) {
      authLogger.error('Error getting effective broker IDs', error as Error, {
        userId,
        permission,
        operation: 'get_effective_broker_ids_error',
      });
      return [];
    }
  }

  /**
   * Check if a permission has broker scope restrictions
   * Returns true if the permission ends with :own or is broker-scoped
   */
  isPermissionBrokerScoped(permission: string): boolean {
    const [resource, , scope] = permission.split(':');

    // Check if it's an :own permission
    if (scope === 'own') {
      return true;
    }

    // Check if it's a resource that should be broker-scoped
    const brokerScopedResources = [
      'clients',
      'policies',
      'records',
      'invitations',
    ];
    return brokerScopedResources.includes(resource);
  }

  /**
   * Get all permissions for a user with their effective broker scope
   */
  async getUserPermissionsWithBrokerScope(userId: string) {
    authLogger.debug('Getting user permissions with broker scope', {
      userId,
      operation: 'get_user_permissions_broker_scope',
    });

    try {
      const basePermissions = await this.getUserPermissions(userId);

      // Enhance each permission with broker scope information
      const enhancedPermissions = await Promise.all(
        basePermissions.permissions.map(async permission => {
          const effectiveBrokerIds = await this.getEffectiveBrokerIds(
            userId,
            permission
          );
          const isBrokerScoped = this.isPermissionBrokerScoped(permission);

          return {
            permission,
            isBrokerScoped,
            effectiveBrokerIds,
            effectiveBrokerCount: effectiveBrokerIds.length,
          };
        })
      );

      return {
        ...basePermissions,
        enhancedPermissions,
      };
    } catch (error) {
      authLogger.error(
        'Error getting user permissions with broker scope',
        error as Error,
        {
          userId,
          operation: 'get_user_permissions_broker_scope_error',
        }
      );
      throw error;
    }
  }
}
