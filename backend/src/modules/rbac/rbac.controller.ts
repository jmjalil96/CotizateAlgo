import { Request, Response } from 'express';
import { RoleService } from '../../services/role.service';
import { UserRoleService } from '../../services/userRole.service';
import { PermissionService } from '../../services/permission.service';
import { AuthorizationService } from '../../services/authorization.service';
import { AuthenticatedRequest } from '../../common/middlewares/auth.middleware';
import { getBrokerFilter } from '../../common/middlewares/brokerIsolation.middleware';
import { prisma } from '../../config/database';
import {
  CreateRoleDto,
  UpdateRoleDto,
  CreatePermissionDto,
  UpdatePermissionDto,
  AssignRoleDto,
  // AssignMultipleRolesDto,
  // ReplaceUserRolesDto,
  AssignPermissionToRoleDto,
  BulkAssignPermissionsDto,
  ReplaceRolePermissionsDto,
  CheckPermissionDto,
  // CheckMultiplePermissionsDto,
} from './dto/rbac.dto';

export class RbacController {
  private roleService: RoleService;
  private userRoleService: UserRoleService;
  private permissionService: PermissionService;
  private authorizationService: AuthorizationService;

  constructor() {
    this.roleService = new RoleService();
    this.userRoleService = new UserRoleService();
    this.permissionService = new PermissionService();
    this.authorizationService = new AuthorizationService();
  }

  // Role Management
  createRole = async (req: Request, res: Response): Promise<void> => {
    try {
      const roleData: CreateRoleDto = req.body;
      const role = await this.roleService.createRole(roleData);

      res.status(201).json({
        success: true,
        message: 'Role created successfully',
        data: { role },
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create role',
      });
    }
  };

  getRoles = async (_req: Request, res: Response): Promise<void> => {
    try {
      const roles = await this.roleService.getRoles();

      res.status(200).json({
        success: true,
        message: 'Roles retrieved successfully',
        data: { roles },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to retrieve roles',
      });
    }
  };

  getRoleById = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const role = await this.roleService.getRoleById(id);

      res.status(200).json({
        success: true,
        message: 'Role retrieved successfully',
        data: { role },
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        message: error instanceof Error ? error.message : 'Role not found',
      });
    }
  };

  updateRole = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const updateData: UpdateRoleDto = req.body;
      const role = await this.roleService.updateRole(id, updateData);

      res.status(200).json({
        success: true,
        message: 'Role updated successfully',
        data: { role },
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update role',
      });
    }
  };

  deleteRole = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const result = await this.roleService.deleteRole(id);

      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to delete role',
      });
    }
  };

  // Permission Management
  createPermission = async (req: Request, res: Response): Promise<void> => {
    try {
      const permissionData: CreatePermissionDto = req.body;
      const permission = await this.permissionService.createPermission(permissionData);

      res.status(201).json({
        success: true,
        message: 'Permission created successfully',
        data: { permission },
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create permission',
      });
    }
  };

  getPermissions = async (_req: Request, res: Response): Promise<void> => {
    try {
      const permissions = await this.permissionService.getPermissions();

      res.status(200).json({
        success: true,
        message: 'Permissions retrieved successfully',
        data: { permissions },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to retrieve permissions',
      });
    }
  };

  getPermissionsByResource = async (req: Request, res: Response): Promise<void> => {
    try {
      const { resource } = req.params;
      const permissions = await this.permissionService.getPermissionsByResource(resource);

      res.status(200).json({
        success: true,
        message: 'Permissions retrieved successfully',
        data: { permissions },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to retrieve permissions',
      });
    }
  };

  updatePermission = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const updateData: UpdatePermissionDto = req.body;
      const permission = await this.permissionService.updatePermission(id, updateData);

      res.status(200).json({
        success: true,
        message: 'Permission updated successfully',
        data: { permission },
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update permission',
      });
    }
  };

  deletePermission = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const result = await this.permissionService.deletePermission(id);

      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to delete permission',
      });
    }
  };

  // User Role Assignment
  assignRoleToUser = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const assignData: AssignRoleDto = req.body;
      const assignerId = req.user!.id;
      const allowedBrokerIds = (req as any).allowedBrokerIds as string[] | undefined;
      
      const userRole = await this.userRoleService.assignRoleToUser(
        assignData.userId,
        assignData.roleId,
        assignerId,
        allowedBrokerIds
      );

      res.status(201).json({
        success: true,
        message: 'Role assigned to user successfully',
        data: { userRole },
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to assign role to user',
      });
    }
  };

  removeRoleFromUser = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { userId, roleId } = req.body;
      const allowedBrokerIds = (req as any).allowedBrokerIds as string[] | undefined;
      
      const result = await this.userRoleService.removeRoleFromUser(userId, roleId, allowedBrokerIds);

      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to remove role from user',
      });
    }
  };

  getUserRoles = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { userId } = req.params;
      // The service will validate if the requester can see the target user.
      const roles = await this.userRoleService.getUserRoles(userId);

      res.status(200).json({
        success: true,
        message: 'User roles retrieved successfully',
        data: { roles },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to retrieve user roles',
      });
    }
  };

  getUsersWithRole = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { roleName } = req.params;
      const brokerFilter = getBrokerFilter(req);
      const usersWithRole = await this.userRoleService.getUsersWithRole(roleName, brokerFilter);

      res.status(200).json({
        success: true,
        message: 'Users with role retrieved successfully',
        data: { usersWithRole },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to retrieve users with role',
      });
    }
  };

  assignMultipleRoles = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const assignerId = req.user!.id;
      const { userId, roleIds } = req.body;
      const allowedBrokerIds = (req as any).allowedBrokerIds as string[] | undefined;

      const result = await this.userRoleService.assignMultipleRoles(
        userId,
        roleIds,
        assignerId,
        allowedBrokerIds
      );

      res.status(201).json({
        success: true,
        message: result.message,
        data: result,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to assign multiple roles',
      });
    }
  };

  replaceUserRoles = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const assignerId = req.user!.id;
      const { userId, roleIds } = req.body;
      const allowedBrokerIds = (req as any).allowedBrokerIds as string[] | undefined;

      const result = await this.userRoleService.replaceUserRoles(
        userId,
        roleIds,
        assignerId,
        allowedBrokerIds
      );

      res.status(200).json({
        success: true,
        message: result.message,
        data: result,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to replace user roles',
      });
    }
  };

  // Role Permission Assignment
  assignPermissionToRole = async (req: Request, res: Response): Promise<void> => {
    try {
      const assignData: AssignPermissionToRoleDto = req.body;
      const result = await this.roleService.assignPermissionToRole(
        assignData.roleId,
        assignData.permissionId
      );

      res.status(201).json({
        success: true,
        message: result.message,
        data: { role: result.role, permission: result.permission },
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to assign permission to role',
      });
    }
  };

  removePermissionFromRole = async (req: Request, res: Response): Promise<void> => {
    try {
      const { roleId, permissionId } = req.body;
      const result = await this.roleService.removePermissionFromRole(roleId, permissionId);

      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to remove permission from role',
      });
    }
  };

  bulkAssignPermissionsToRole = async (req: Request, res: Response): Promise<void> => {
    try {
      const assignData: BulkAssignPermissionsDto = req.body;
      const result = await this.roleService.bulkAssignPermissions(
        assignData.roleId,
        assignData.permissionIds
      );

      res.status(201).json({
        success: true,
        message: result.message,
        data: { 
          roleId: assignData.roleId,
          assignedPermissions: result.assignedPermissions,
          skippedPermissions: result.skippedPermissions 
        },
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to assign permissions to role',
      });
    }
  };

  replaceRolePermissions = async (req: Request, res: Response): Promise<void> => {
    try {
      const replaceData: ReplaceRolePermissionsDto = req.body;
      const result = await this.roleService.replaceRolePermissions(
        replaceData.roleId,
        replaceData.permissionIds
      );

      res.status(200).json({
        success: true,
        message: result.message,
        data: { 
          roleId: replaceData.roleId,
          assignedPermissions: result.assignedPermissions
        },
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to replace role permissions',
      });
    }
  };

  getRolePermissions = async (req: Request, res: Response): Promise<void> => {
    try {
      const { roleId } = req.params;
      const permissions = await this.roleService.getRolePermissions(roleId);

      res.status(200).json({
        success: true,
        message: 'Role permissions retrieved successfully',
        data: { permissions },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to retrieve role permissions',
      });
    }
  };

  // Authorization & User Permissions
  getUserPermissions = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { userId } = req.params;
      const allowedBrokerIds = (req as any).allowedBrokerIds as string[] | undefined;
      
      // First validate that the user can access the target user
      if (allowedBrokerIds) {
        const user = await prisma.profile.findUnique({
          where: { id: userId },
          select: { brokerId: true, broker: { select: { name: true } } }
        });
        
        if (!user) {
          res.status(404).json({
            success: false,
            message: 'User not found',
          });
          return;
        }
        
        if (user.brokerId && !allowedBrokerIds.includes(user.brokerId)) {
          res.status(403).json({
            success: false,
            message: `Access denied: Cannot view permissions for users outside your broker hierarchy. User belongs to broker: ${user.broker?.name || 'Unknown'}`,
          });
          return;
        }
      }
      
      const permissions = await this.permissionService.getUserPermissions(userId);

      res.status(200).json({
        success: true,
        message: 'User permissions retrieved successfully',
        data: { permissions },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to retrieve user permissions',
      });
    }
  };

  checkUserPermission = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const checkData: CheckPermissionDto = req.body;
      const accessibleBrokerIds = req.brokerContext!.accessibleBrokerIds;
      const result = await this.authorizationService.checkUserPermission(
        checkData.userId,
        checkData.permission,
        accessibleBrokerIds
      );

      res.status(200).json({
        success: true,
        message: 'Permission check successful',
        data: { hasPermission: result },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to check permission',
      });
    }
  };

  getUserAccessSummary = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { userId } = req.params;
      const accessibleBrokerIds = req.brokerContext!.accessibleBrokerIds;
      const summary = await this.authorizationService.getUserAccessSummary(userId, accessibleBrokerIds);

      res.status(200).json({
        success: true,
        message: 'User access summary retrieved successfully',
        data: { summary },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to retrieve user access summary',
      });
    }
  };

  getUsersWithPermission = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { permission } = req.params;
      const brokerFilter = getBrokerFilter(req);
      const result = await this.permissionService.getUsersWithPermission(permission, brokerFilter);

      res.status(200).json({
        success: true,
        message: 'Users with permission retrieved successfully',
        data: result,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'Failed to retrieve users with permission',
      });
    }
  };

  // Self-service routes
  getMeRoles = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const roles = await this.userRoleService.getUserRoles(req.user!.id);
      res.status(200).json({
        success: true,
        message: 'Your roles retrieved successfully',
        data: { roles },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to retrieve your roles',
      });
    }
  };
}