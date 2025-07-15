import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.middleware';
import { authLogger } from '../../services/logger.service';

export type BrokerAccessScope = 'own' | 'hierarchy';

/**
 * Middleware to enforce broker isolation based on user roles and permissions
 * 
 * @param scope - 'own' restricts to user's own broker only, 'hierarchy' allows access to own + child brokers
 * @param skipForSystemUsers - if true, allows system users (no brokerId) to bypass checks
 */
export const requireBrokerAccess = (
  scope: BrokerAccessScope = 'hierarchy',
  skipForSystemUsers: boolean = false
) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const correlationId = (req as any).correlationId;
    const logger = authLogger.withCorrelationId(correlationId);

    try {
      // Check if user is authenticated
      if (!req.user) {
        logger.warn('Broker access check failed - user not authenticated', {
          scope,
          operation: 'broker_access_check'
        });
        
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      // Check if broker context exists
      if (!req.brokerContext) {
        logger.error('Broker access check failed - broker context missing', {
          userId: req.user.id,
          scope,
          operation: 'broker_access_check'
        });
        
        res.status(500).json({
          success: false,
          message: 'Broker context not available',
        });
        return;
      }

      const { userBrokerId, accessibleBrokerIds } = req.brokerContext;

      // Handle system users (no brokerId)
      if (!userBrokerId) {
        if (skipForSystemUsers) {
          logger.debug('System user bypassing broker access check', {
            userId: req.user.id,
            scope,
            operation: 'broker_access_system_user_bypass'
          });
          next();
          return;
        } else {
          logger.warn('Broker access denied - system user attempted restricted operation', {
            userId: req.user.id,
            scope,
            operation: 'broker_access_system_user_denied'
          });
          
          res.status(403).json({
            success: false,
            message: 'Broker access required. System users cannot perform this operation.',
          });
          return;
        }
      }

      // Validate broker access scope
      let allowedBrokerIds: string[] = [];
      
      switch (scope) {
        case 'own':
          // Restrict to user's own broker only (for agent role)
          allowedBrokerIds = [userBrokerId];
          logger.debug('Broker access scope set to own broker only', {
            userId: req.user.id,
            userBrokerId,
            scope,
            operation: 'broker_access_own_scope'
          });
          break;
          
        case 'hierarchy':
          // Allow access to own + all child brokers (for broker_admin, employee)
          allowedBrokerIds = accessibleBrokerIds;
          logger.debug('Broker access scope set to broker hierarchy', {
            userId: req.user.id,
            userBrokerId,
            accessibleBrokerCount: accessibleBrokerIds.length,
            scope,
            operation: 'broker_access_hierarchy_scope'
          });
          break;
          
        default:
          logger.error('Invalid broker access scope specified', {
            userId: req.user.id,
            scope,
            operation: 'broker_access_invalid_scope'
          });
          
          res.status(500).json({
            success: false,
            message: 'Invalid broker access configuration',
          });
          return;
      }

      // Attach allowed broker IDs to request for use in services
      (req as any).allowedBrokerIds = allowedBrokerIds;

      logger.debug('Broker access check passed', {
        userId: req.user.id,
        userBrokerId,
        scope,
        allowedBrokerCount: allowedBrokerIds.length,
        operation: 'broker_access_check_passed'
      });

      next();

    } catch (error) {
      authLogger.error('Error in broker access middleware', error as Error, {
        userId: req.user?.id,
        scope,
        operation: 'broker_access_middleware_error'
      });
      
      res.status(500).json({
        success: false,
        message: 'Broker access validation error',
      });
    }
  };
};

/**
 * Middleware to check if user can access a specific broker
 * Validates that the target brokerId is within the user's accessible broker hierarchy
 */
export const requireSpecificBrokerAccess = (brokerIdParam: string = 'brokerId') => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const correlationId = (req as any).correlationId;
    const logger = authLogger.withCorrelationId(correlationId);

    try {
      if (!req.user || !req.brokerContext) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      // Get target broker ID from request params, body, or query
      const targetBrokerId = req.params[brokerIdParam] || 
                            req.body[brokerIdParam] || 
                            req.query[brokerIdParam] as string;

      if (!targetBrokerId) {
        logger.warn('Specific broker access check failed - no target broker ID', {
          userId: req.user.id,
          brokerIdParam,
          operation: 'specific_broker_access_check'
        });
        
        res.status(400).json({
          success: false,
          message: `Missing required parameter: ${brokerIdParam}`,
        });
        return;
      }

      const { accessibleBrokerIds, userBrokerId } = req.brokerContext;

      // Check if user can access the target broker
      const hasAccess = accessibleBrokerIds.includes(targetBrokerId);

      if (!hasAccess) {
        logger.warn('Specific broker access denied', {
          userId: req.user.id,
          userBrokerId,
          targetBrokerId,
          accessibleBrokerIds,
          operation: 'specific_broker_access_denied'
        });
        
        res.status(403).json({
          success: false,
          message: 'Access denied. You do not have permission to access this broker.',
        });
        return;
      }

      logger.debug('Specific broker access granted', {
        userId: req.user.id,
        userBrokerId,
        targetBrokerId,
        operation: 'specific_broker_access_granted'
      });

      // Attach target broker ID to request for use in services
      (req as any).targetBrokerId = targetBrokerId;

      next();

    } catch (error) {
      authLogger.error('Error in specific broker access middleware', error as Error, {
        userId: req.user?.id,
        brokerIdParam,
        operation: 'specific_broker_access_error'
      });
      
      res.status(500).json({
        success: false,
        message: 'Broker access validation error',
      });
    }
  };
};

/**
 * Middleware that automatically enforces broker filtering based on permission scope
 * Detects :own permissions and applies appropriate broker filtering
 */
export const enforceBrokerPermissionScope = () => {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    const correlationId = (req as any).correlationId;
    const logger = authLogger.withCorrelationId(correlationId);

    try {
      if (!req.user || !req.brokerContext) {
        next();
        return;
      }

      // Check if user has any :own permissions (indicating agent role restrictions)
      const hasOwnPermissions = req.user.permissions.some(permission => 
        permission.endsWith(':own')
      );

      if (hasOwnPermissions) {
        // Determine if this request should be restricted to own broker
        const isAgentRole = req.user.hasRole('agent');
        
        if (isAgentRole) {
          // Force own-broker scope for agents
          (req as any).allowedBrokerIds = [req.brokerContext.userBrokerId].filter(Boolean);
          
          logger.debug('Agent role detected - enforcing own-broker scope', {
            userId: req.user.id,
            userBrokerId: req.brokerContext.userBrokerId,
            operation: 'agent_scope_enforcement'
          });
        } else {
          // For other roles with :own permissions, use hierarchy scope
          (req as any).allowedBrokerIds = req.brokerContext.accessibleBrokerIds;
          
          logger.debug('Non-agent role with :own permissions - using hierarchy scope', {
            userId: req.user.id,
            userBrokerId: req.brokerContext.userBrokerId,
            accessibleBrokerCount: req.brokerContext.accessibleBrokerIds.length,
            operation: 'hierarchy_scope_enforcement'
          });
        }
      } else {
        // No :own permissions, use full hierarchy access
        (req as any).allowedBrokerIds = req.brokerContext.accessibleBrokerIds;
        
        logger.debug('No :own permissions detected - using hierarchy scope', {
          userId: req.user.id,
          userBrokerId: req.brokerContext.userBrokerId,
          accessibleBrokerCount: req.brokerContext.accessibleBrokerIds.length,
          operation: 'full_hierarchy_scope'
        });
      }

      next();

    } catch (error) {
      authLogger.error('Error in broker permission scope enforcement', error as Error, {
        userId: req.user?.id,
        operation: 'broker_permission_scope_error'
      });
      
      next(); // Continue without filtering on error
    }
  };
};

/**
 * Helper function to get broker filter for database queries
 * Use this in services to apply broker isolation to Prisma queries
 */
export const getBrokerFilter = (req: AuthenticatedRequest) => {
  const allowedBrokerIds = (req as any).allowedBrokerIds as string[] | undefined;
  
  if (!allowedBrokerIds || allowedBrokerIds.length === 0) {
    // No broker access - return filter that matches nothing
    return { brokerId: { in: [] } };
  }
  
  if (allowedBrokerIds.length === 1) {
    // Single broker access
    return { brokerId: allowedBrokerIds[0] };
  }
  
  // Multiple broker access
  return { brokerId: { in: allowedBrokerIds } };
};

/**
 * Helper function to validate if user can access specific data
 * Use this in services for additional validation
 */
export const validateBrokerAccess = (req: AuthenticatedRequest, dataBrokerId: string): boolean => {
  const allowedBrokerIds = (req as any).allowedBrokerIds as string[] | undefined;
  
  if (!allowedBrokerIds || allowedBrokerIds.length === 0) {
    return false;
  }
  
  return allowedBrokerIds.includes(dataBrokerId);
};