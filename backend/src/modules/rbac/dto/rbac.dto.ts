// Role DTOs
export interface CreateRoleDto {
  name: string;
  description?: string;
  level?: number;
}

export interface UpdateRoleDto {
  name?: string;
  description?: string;
  level?: number;
}

export interface RoleResponseDto {
  id: string;
  name: string;
  description: string | null;
  level: number;
  createdAt: Date;
  permissionCount: number;
  userCount: number;
  permissions: Array<{
    id: string;
    resource: string;
    action: string;
    description: string | null;
  }>;
}

// Permission DTOs
export interface CreatePermissionDto {
  resource: string;
  action: string;
  description?: string;
}

export interface UpdatePermissionDto {
  description?: string;
}

export interface PermissionResponseDto {
  id: string;
  resource: string;
  action: string;
  description: string | null;
  createdAt: Date;
}

// User Role Assignment DTOs
export interface AssignRoleDto {
  userId: string;
  roleId: string;
}

export interface AssignMultipleRolesDto {
  userId: string;
  roleIds: string[];
}

export interface ReplaceUserRolesDto {
  userId: string;
  roleIds: string[];
}

export interface UserRoleResponseDto {
  id: string;
  name: string;
  description: string | null;
  assignedAt: Date;
  assignedBy: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
  permissions: Array<{
    id: string;
    resource: string;
    action: string;
    description: string | null;
  }>;
}

// Role Permission Assignment DTOs
export interface AssignPermissionToRoleDto {
  roleId: string;
  permissionId: string;
}

export interface BulkAssignPermissionsDto {
  roleId: string;
  permissionIds: string[];
}

export interface ReplaceRolePermissionsDto {
  roleId: string;
  permissionIds: string[];
}

// User Permissions DTOs
export interface UserPermissionsResponseDto {
  userId: string;
  permissions: string[];
  detailedPermissions: Array<{
    id: string;
    resource: string;
    action: string;
    description: string | null;
    fromRole: string;
  }>;
  roleCount: number;
}

// Authorization DTOs
export interface CheckPermissionDto {
  userId: string;
  permission: string;
}

export interface CheckMultiplePermissionsDto {
  userId: string;
  permissions: string[];
}

export interface PermissionCheckResponseDto {
  allowed: boolean;
  permission?: string;
  permissions?: string[];
  userId: string;
  error?: string;
}

// User Access Summary DTOs
export interface UserAccessSummaryDto {
  userId: string;
  summary: {
    roleCount: number;
    permissionCount: number;
    resourceCount: number;
  };
  roles: Array<{
    id: string;
    name: string;
    assignedAt: Date;
    assignedBy: {
      id: string;
      firstName: string;
      lastName: string;
    } | null;
    permissionCount: number;
  }>;
  permissionsByResource: Record<string, Array<{
    action: string;
    description: string | null;
    fromRole: string;
  }>>;
  flatPermissions: string[];
}

// Users with Role/Permission DTOs
export interface UsersWithRoleDto {
  roleName: string;
  userCount: number;
  users: Array<{
    user: {
      id: string;
      firstName: string;
      lastName: string;
      cedulaRuc: string;
      phone: string | null;
      isActive: boolean;
      createdAt: Date;
    };
    role: {
      id: string;
      name: string;
    };
    assignedAt: Date;
    assignedBy: {
      id: string;
      firstName: string;
      lastName: string;
    } | null;
  }>;
}

export interface UsersWithPermissionDto {
  permission: string;
  userCount: number;
  users: Array<{
    user: {
      id: string;
      firstName: string;
      lastName: string;
      cedulaRuc: string;
      isActive: boolean;
    };
    roles: Array<{
      id: string;
      name: string;
    }>;
  }>;
}