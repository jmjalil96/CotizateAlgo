import { Request, Response, NextFunction } from 'express';
import { supabase } from '../../config/supabase';
import { prisma } from '../../config/database';
import { BrokerHierarchyService } from '../../services/brokerHierarchy.service';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    roles: Array<{
      id: string;
      name: string;
      permissions: Array<{
        resource: string;
        action: string;
      }>;
    }>;
    permissions: string[];
    hasRole: (roleName: string) => boolean;
    hasPermission: (permission: string) => boolean;
    hasAnyPermission: (permissions: string[]) => boolean;
  };
  brokerContext?: {
    userBrokerId: string | null;
    accessibleBrokerIds: string[];
    hierarchyLevel: number;
    isRootBroker: boolean;
  };
}

export const authMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const brokerHierarchyService = new BrokerHierarchyService();
  
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        message: 'Access token required',
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      res.status(401).json({
        success: false,
        message: 'Invalid or expired token',
      });
      return;
    }

    // Load user profile with roles and permissions, including broker info
    const profile = await prisma.profile.findUnique({
      where: { id: user.id },
      include: {
        broker: {
          select: {
            id: true,
            name: true,
            parentId: true,
          },
        },
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: {
                    permission: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!profile) {
      res.status(401).json({
        success: false,
        message: 'User profile not found',
      });
      return;
    }

    // Process roles and permissions
    const roles = profile.userRoles.map(ur => ({
      id: ur.role.id,
      name: ur.role.name,
      permissions: ur.role.rolePermissions.map(rp => ({
        resource: rp.permission.resource,
        action: rp.permission.action
      }))
    }));

    // Flatten all permissions into string array
    const permissions = roles.flatMap(role => 
      role.permissions.map(p => `${p.resource}:${p.action}`)
    );

    // Helper methods for permission checking
    const hasRole = (roleName: string) => roles.some(r => r.name === roleName);
    const hasPermission = (permission: string) => permissions.includes(permission);
    const hasAnyPermission = (perms: string[]) => perms.some(p => permissions.includes(p));

    // Add enhanced user to request object
    req.user = {
      id: user.id,
      email: user.email!,
      roles,
      permissions,
      hasRole,
      hasPermission,
      hasAnyPermission
    };

    // Add broker context if user has a broker
    if (profile.brokerId && profile.broker) {
      try {
        // Get all brokers this user can access (their own + all descendants)
        const accessibleBrokerIds = await brokerHierarchyService.getDescendantBrokerIds(profile.brokerId);
        
        // Get hierarchy info to determine level and root status
        const hierarchyInfo = await brokerHierarchyService.getBrokerHierarchyInfo(profile.brokerId);
        
        req.brokerContext = {
          userBrokerId: profile.brokerId,
          accessibleBrokerIds,
          hierarchyLevel: hierarchyInfo.hierarchyStats.hierarchyLevel,
          isRootBroker: !profile.broker.parentId,
        };

        console.log(`[AUTH] Broker context set for user ${user.id}:`, {
          brokerId: profile.brokerId,
          brokerName: profile.broker.name,
          accessibleBrokerCount: accessibleBrokerIds.length,
          hierarchyLevel: hierarchyInfo.hierarchyStats.hierarchyLevel,
          isRootBroker: !profile.broker.parentId,
        });

      } catch (brokerError) {
        console.error('[AUTH] Failed to load broker context:', brokerError);
        
        // Fallback: provide minimal broker context with just the user's own broker
        req.brokerContext = {
          userBrokerId: profile.brokerId,
          accessibleBrokerIds: [profile.brokerId],
          hierarchyLevel: 0,
          isRootBroker: true, // Assume root if we can't determine hierarchy
        };
      }
    } else {
      // User has no broker (system user, etc.)
      req.brokerContext = {
        userBrokerId: null,
        accessibleBrokerIds: [],
        hierarchyLevel: 0,
        isRootBroker: false,
      };
      
      console.log(`[AUTH] No broker context for user ${user.id} (system user)`);
    }

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({
      success: false,
      message: 'Authentication error',
    });
  }
};

export const requirePermission = (permission: string) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    if (!req.user.hasPermission(permission)) {
      res.status(403).json({
        success: false,
        message: `Insufficient permissions. Required: ${permission}`,
      });
      return;
    }

    next();
  };
};

export const requireRole = (roleName: string) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    if (!req.user.hasRole(roleName)) {
      res.status(403).json({
        success: false,
        message: `Insufficient role. Required: ${roleName}`,
      });
      return;
    }

    next();
  };
};

export const requireAnyPermission = (permissions: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    if (!req.user.hasAnyPermission(permissions)) {
      res.status(403).json({
        success: false,
        message: `Insufficient permissions. Required one of: ${permissions.join(', ')}`,
      });
      return;
    }

    next();
  };
};