import { prisma } from '../config/database';

export class RoleService {
  async createRole(data: {
    name: string;
    description?: string;
    level?: number;
  }) {
    const { name, description, level = 1 } = data;

    // Check if role already exists
    const existingRole = await prisma.role.findUnique({
      where: { name },
    });

    if (existingRole) {
      throw new Error('Role already exists');
    }

    const role = await prisma.role.create({
      data: {
        name,
        description,
        level,
      },
    });

    return role;
  }

  async getRoles() {
    const roles = await prisma.role.findMany({
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
        userRoles: {
          select: {
            userId: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return roles.map(role => ({
      id: role.id,
      name: role.name,
      description: role.description,
      createdAt: role.createdAt,
      permissionCount: role.rolePermissions.length,
      userCount: role.userRoles.length,
      permissions: role.rolePermissions.map(rp => ({
        id: rp.permission.id,
        resource: rp.permission.resource,
        action: rp.permission.action,
        description: rp.permission.description,
      })),
    }));
  }

  async getRoleById(id: string) {
    const role = await prisma.role.findUnique({
      where: { id },
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
        userRoles: {
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
            assigner: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    if (!role) {
      throw new Error('Role not found');
    }

    return {
      id: role.id,
      name: role.name,
      description: role.description,
      createdAt: role.createdAt,
      permissions: role.rolePermissions.map(rp => ({
        id: rp.permission.id,
        resource: rp.permission.resource,
        action: rp.permission.action,
        description: rp.permission.description,
      })),
      users: role.userRoles.map(ur => ({
        user: ur.user,
        assignedAt: ur.assignedAt,
        assignedBy: ur.assigner,
      })),
    };
  }

  async getRoleByName(name: string) {
    const role = await prisma.role.findUnique({
      where: { name },
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    if (!role) {
      throw new Error('Role not found');
    }

    return {
      id: role.id,
      name: role.name,
      description: role.description,
      createdAt: role.createdAt,
      permissions: role.rolePermissions.map(rp => ({
        id: rp.permission.id,
        resource: rp.permission.resource,
        action: rp.permission.action,
        description: rp.permission.description,
      })),
    };
  }

  async updateRole(
    id: string,
    data: { name?: string; description?: string; level?: number }
  ) {
    const { name, description, level } = data;

    // Check if role exists
    const role = await prisma.role.findUnique({
      where: { id },
    });

    if (!role) {
      throw new Error('Role not found');
    }

    // If updating name, check if new name already exists
    if (name && name !== role.name) {
      const existingRole = await prisma.role.findUnique({
        where: { name },
      });

      if (existingRole) {
        throw new Error('Role name already exists');
      }
    }

    const updatedRole = await prisma.role.update({
      where: { id },
      data: {
        name,
        description,
        level,
      },
    });

    return updatedRole;
  }

  async deleteRole(id: string) {
    // Check if role exists
    const role = await prisma.role.findUnique({
      where: { id },
      include: {
        userRoles: true,
        rolePermissions: true,
      },
    });

    if (!role) {
      throw new Error('Role not found');
    }

    // Check if role is assigned to any users
    if (role.userRoles.length > 0) {
      throw new Error('Cannot delete role that is assigned to users');
    }

    // Delete role (this will cascade delete role permissions due to schema)
    await prisma.role.delete({
      where: { id },
    });

    return { message: 'Role deleted successfully' };
  }

  async assignPermissionToRole(roleId: string, permissionId: string) {
    // Check if role exists
    const role = await prisma.role.findUnique({
      where: { id: roleId },
    });

    if (!role) {
      throw new Error('Role not found');
    }

    // Check if permission exists
    const permission = await prisma.permission.findUnique({
      where: { id: permissionId },
    });

    if (!permission) {
      throw new Error('Permission not found');
    }

    // Check if role already has this permission
    const existingRolePermission = await prisma.rolePermission.findUnique({
      where: {
        roleId_permissionId: {
          roleId,
          permissionId,
        },
      },
    });

    if (existingRolePermission) {
      throw new Error('Role already has this permission');
    }

    // Assign permission to role
    const rolePermission = await prisma.rolePermission.create({
      data: {
        roleId,
        permissionId,
      },
      include: {
        role: true,
        permission: true,
      },
    });

    return {
      role: rolePermission.role,
      permission: rolePermission.permission,
      message: 'Permission assigned to role successfully',
    };
  }

  async removePermissionFromRole(roleId: string, permissionId: string) {
    // Check if role has this permission
    const rolePermission = await prisma.rolePermission.findUnique({
      where: {
        roleId_permissionId: {
          roleId,
          permissionId,
        },
      },
    });

    if (!rolePermission) {
      throw new Error('Role does not have this permission');
    }

    // Remove permission from role
    await prisma.rolePermission.delete({
      where: {
        roleId_permissionId: {
          roleId,
          permissionId,
        },
      },
    });

    return { message: 'Permission removed from role successfully' };
  }

  async getRolePermissions(roleId: string) {
    const role = await prisma.role.findUnique({
      where: { id: roleId },
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    if (!role) {
      throw new Error('Role not found');
    }

    return {
      roleId: role.id,
      roleName: role.name,
      permissions: role.rolePermissions.map(rp => ({
        id: rp.permission.id,
        resource: rp.permission.resource,
        action: rp.permission.action,
        description: rp.permission.description,
        assignedAt: rp.createdAt,
      })),
    };
  }

  async bulkAssignPermissions(roleId: string, permissionIds: string[]) {
    // Check if role exists
    const role = await prisma.role.findUnique({
      where: { id: roleId },
    });

    if (!role) {
      throw new Error('Role not found');
    }

    // Check if all permissions exist
    const permissions = await prisma.permission.findMany({
      where: {
        id: {
          in: permissionIds,
        },
      },
    });

    if (permissions.length !== permissionIds.length) {
      throw new Error('One or more permissions not found');
    }

    // Get existing role permissions
    const existingRolePermissions = await prisma.rolePermission.findMany({
      where: {
        roleId,
        permissionId: {
          in: permissionIds,
        },
      },
    });

    // Filter out permissions the role already has
    const existingPermissionIds = existingRolePermissions.map(
      rp => rp.permissionId
    );
    const newPermissionIds = permissionIds.filter(
      permissionId => !existingPermissionIds.includes(permissionId)
    );

    if (newPermissionIds.length === 0) {
      throw new Error('Role already has all specified permissions');
    }

    // Create multiple role permissions
    const rolePermissions = await prisma.rolePermission.createMany({
      data: newPermissionIds.map(permissionId => ({
        roleId,
        permissionId,
      })),
    });

    return {
      message: `Successfully assigned ${rolePermissions.count} new permissions to role`,
      assignedPermissions: newPermissionIds.length,
      skippedPermissions: existingPermissionIds.length,
    };
  }

  async replaceRolePermissions(roleId: string, permissionIds: string[]) {
    // Check if role exists
    const role = await prisma.role.findUnique({
      where: { id: roleId },
    });

    if (!role) {
      throw new Error('Role not found');
    }

    // Check if all permissions exist
    const permissions = await prisma.permission.findMany({
      where: {
        id: {
          in: permissionIds,
        },
      },
    });

    if (permissions.length !== permissionIds.length) {
      throw new Error('One or more permissions not found');
    }

    // Use transaction to replace permissions atomically
    const result = await prisma.$transaction(async tx => {
      // Remove all existing permissions
      await tx.rolePermission.deleteMany({
        where: { roleId },
      });

      // Add new permissions
      const rolePermissions = await tx.rolePermission.createMany({
        data: permissionIds.map(permissionId => ({
          roleId,
          permissionId,
        })),
      });

      return rolePermissions;
    });

    return {
      message: 'Role permissions replaced successfully',
      assignedPermissions: result.count,
    };
  }
}
