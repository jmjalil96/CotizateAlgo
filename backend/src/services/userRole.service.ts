import { prisma } from '../config/database';

export class UserRoleService {
  async assignRoleToUser(
    userId: string,
    roleId: string,
    assignedBy: string,
    allowedBrokerIds?: string[]
  ) {
    // Check if role exists
    const role = await prisma.role.findUnique({
      where: { id: roleId },
    });

    if (!role) {
      throw new Error('Role not found');
    }

    // Check if user exists and include broker information
    const user = await prisma.profile.findUnique({
      where: { id: userId },
      include: {
        broker: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // CRITICAL: Validate broker access for security
    if (allowedBrokerIds && user.brokerId) {
      if (!allowedBrokerIds.includes(user.brokerId)) {
        throw new Error(
          `Access denied: Cannot assign roles to users outside your broker hierarchy. User belongs to broker: ${user.broker?.name || 'Unknown'}`
        );
      }
    }

    // Check if user already has this role
    const existingUserRole = await prisma.userRole.findUnique({
      where: {
        userId_roleId: {
          userId,
          roleId,
        },
      },
    });

    if (existingUserRole) {
      throw new Error('User already has this role');
    }

    // Assign role to user
    const userRole = await prisma.userRole.create({
      data: {
        userId,
        roleId,
        assignedBy,
      },
      include: {
        role: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        assigner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return userRole;
  }

  async removeRoleFromUser(
    userId: string,
    roleId: string,
    allowedBrokerIds?: string[]
  ) {
    // Check if user exists and include broker information
    const user = await prisma.profile.findUnique({
      where: { id: userId },
      include: {
        broker: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // CRITICAL: Validate broker access for security
    if (allowedBrokerIds && user.brokerId) {
      if (!allowedBrokerIds.includes(user.brokerId)) {
        throw new Error(
          `Access denied: Cannot remove roles from users outside your broker hierarchy. User belongs to broker: ${user.broker?.name || 'Unknown'}`
        );
      }
    }

    // Check if user has this role
    const userRole = await prisma.userRole.findUnique({
      where: {
        userId_roleId: {
          userId,
          roleId,
        },
      },
    });

    if (!userRole) {
      throw new Error('User does not have this role');
    }

    // Remove role from user
    await prisma.userRole.delete({
      where: {
        userId_roleId: {
          userId,
          roleId,
        },
      },
    });

    return { message: 'Role removed from user successfully' };
  }

  async getUserRoles(userId: string) {
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
        assigner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return userRoles.map(ur => ({
      id: ur.role.id,
      name: ur.role.name,
      description: ur.role.description,
      assignedAt: ur.assignedAt,
      assignedBy: ur.assigner,
      permissions: ur.role.rolePermissions.map(rp => ({
        id: rp.permission.id,
        resource: rp.permission.resource,
        action: rp.permission.action,
        description: rp.permission.description,
      })),
    }));
  }

  async getUsersWithRole(roleName: string, brokerFilter: any) {
    const usersWithRole = await prisma.userRole.findMany({
      where: {
        role: {
          name: roleName,
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
            phone: true,
            isActive: true,
            createdAt: true,
          },
        },
        role: true,
        assigner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return usersWithRole.map(ur => ({
      user: ur.user,
      role: ur.role,
      assignedAt: ur.assignedAt,
      assignedBy: ur.assigner,
    }));
  }

  async assignMultipleRoles(
    userId: string,
    roleIds: string[],
    assignedBy: string,
    allowedBrokerIds?: string[]
  ) {
    // Check if user exists and include broker information
    const user = await prisma.profile.findUnique({
      where: { id: userId },
      include: {
        broker: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // CRITICAL: Validate broker access for security
    if (allowedBrokerIds && user.brokerId) {
      if (!allowedBrokerIds.includes(user.brokerId)) {
        throw new Error(
          `Access denied: Cannot assign roles to users outside your broker hierarchy. User belongs to broker: ${user.broker?.name || 'Unknown'}`
        );
      }
    }

    // Check if all roles exist
    const roles = await prisma.role.findMany({
      where: {
        id: {
          in: roleIds,
        },
      },
    });

    if (roles.length !== roleIds.length) {
      throw new Error('One or more roles not found');
    }

    // Get existing user roles
    const existingUserRoles = await prisma.userRole.findMany({
      where: {
        userId,
        roleId: {
          in: roleIds,
        },
      },
    });

    // Filter out roles the user already has
    const existingRoleIds = existingUserRoles.map(ur => ur.roleId);
    const newRoleIds = roleIds.filter(
      roleId => !existingRoleIds.includes(roleId)
    );

    if (newRoleIds.length === 0) {
      throw new Error('User already has all specified roles');
    }

    // Create multiple user roles
    const userRoles = await prisma.userRole.createMany({
      data: newRoleIds.map(roleId => ({
        userId,
        roleId,
        assignedBy,
      })),
    });

    return {
      message: `Successfully assigned ${userRoles.count} new roles to user`,
      assignedRoles: newRoleIds.length,
      skippedRoles: existingRoleIds.length,
    };
  }

  async replaceUserRoles(
    userId: string,
    roleIds: string[],
    assignedBy: string,
    allowedBrokerIds?: string[]
  ) {
    // Check if user exists and include broker information
    const user = await prisma.profile.findUnique({
      where: { id: userId },
      include: {
        broker: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // CRITICAL: Validate broker access for security
    if (allowedBrokerIds && user.brokerId) {
      if (!allowedBrokerIds.includes(user.brokerId)) {
        throw new Error(
          `Access denied: Cannot assign roles to users outside your broker hierarchy. User belongs to broker: ${user.broker?.name || 'Unknown'}`
        );
      }
    }

    // Check if all roles exist
    const roles = await prisma.role.findMany({
      where: {
        id: {
          in: roleIds,
        },
      },
    });

    if (roles.length !== roleIds.length) {
      throw new Error('One or more roles not found');
    }

    // Use transaction to replace roles atomically
    const result = await prisma.$transaction(async tx => {
      // Remove all existing roles
      await tx.userRole.deleteMany({
        where: { userId },
      });

      // Add new roles
      const userRoles = await tx.userRole.createMany({
        data: roleIds.map(roleId => ({
          userId,
          roleId,
          assignedBy,
        })),
      });

      return userRoles;
    });

    return {
      message: 'User roles replaced successfully',
      assignedRoles: result.count,
    };
  }

  async getUserPermissions(userId: string) {
    const userRoles = await this.getUserRoles(userId);

    // Flatten all permissions from all roles
    const permissions = userRoles.flatMap(role =>
      role.permissions.map(
        permission => `${permission.resource}:${permission.action}`
      )
    );

    // Remove duplicates
    const uniquePermissions = [...new Set(permissions)];

    return {
      userId,
      permissions: uniquePermissions,
      roles: userRoles.map(role => ({
        id: role.id,
        name: role.name,
        permissionCount: role.permissions.length,
      })),
    };
  }
}
