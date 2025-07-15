import { prisma } from '../config/database';
import { authLogger } from './logger.service';

export class BrokerHierarchyService {
  /**
   * Get all descendant broker IDs (including the root broker itself)
   * Uses recursive CTE to traverse the broker hierarchy downward
   */
  async getDescendantBrokerIds(brokerId: string): Promise<string[]> {
    if (!brokerId) {
      authLogger.warn('getDescendantBrokerIds called with empty brokerId');
      return [];
    }

    authLogger.debug('Getting descendant brokers', {
      rootBrokerId: brokerId,
      operation: 'get_descendant_brokers',
    });

    try {
      // Use raw SQL with recursive CTE to get all descendant brokers
      const result = await prisma.$queryRaw<Array<{ id: string }>>`
        WITH RECURSIVE broker_hierarchy AS (
          -- Base case: start with the root broker
          SELECT id, parent_id, 0 as level 
          FROM brokers 
          WHERE id = ${brokerId}
          
          UNION ALL
          
          -- Recursive case: find children of current level
          SELECT b.id, b.parent_id, bh.level + 1 
          FROM brokers b 
          INNER JOIN broker_hierarchy bh ON b.parent_id = bh.id
          WHERE bh.level < 10  -- Prevent infinite recursion (max 10 levels)
        )
        SELECT id FROM broker_hierarchy
        ORDER BY level;
      `;

      const brokerIds = result.map(row => row.id);

      authLogger.debug('Descendant brokers retrieved successfully', {
        rootBrokerId: brokerId,
        descendantCount: brokerIds.length,
        descendantIds: brokerIds,
        operation: 'get_descendant_brokers_success',
      });

      return brokerIds;
    } catch (error) {
      authLogger.error('Failed to get descendant brokers', error as Error, {
        rootBrokerId: brokerId,
        operation: 'get_descendant_brokers_failed',
      });

      // On error, return just the root broker to maintain some functionality
      authLogger.warn(
        'Fallback: returning only root broker due to hierarchy query error',
        {
          rootBrokerId: brokerId,
        }
      );

      return [brokerId];
    }
  }

  /**
   * Get all ancestor broker IDs (including the root broker itself)
   * Uses recursive CTE to traverse the broker hierarchy upward
   * Useful for validation and future features
   */
  async getAncestorBrokerIds(brokerId: string): Promise<string[]> {
    if (!brokerId) {
      authLogger.warn('getAncestorBrokerIds called with empty brokerId');
      return [];
    }

    authLogger.debug('Getting ancestor brokers', {
      childBrokerId: brokerId,
      operation: 'get_ancestor_brokers',
    });

    try {
      const result = await prisma.$queryRaw<Array<{ id: string }>>`
        WITH RECURSIVE broker_hierarchy AS (
          -- Base case: start with the child broker
          SELECT id, parent_id, 0 as level 
          FROM brokers 
          WHERE id = ${brokerId}
          
          UNION ALL
          
          -- Recursive case: find parents of current level
          SELECT b.id, b.parent_id, bh.level + 1 
          FROM brokers b 
          INNER JOIN broker_hierarchy bh ON bh.parent_id = b.id
          WHERE bh.level < 10  -- Prevent infinite recursion
        )
        SELECT id FROM broker_hierarchy
        ORDER BY level DESC;  -- Root first, then descendants
      `;

      const brokerIds = result.map(row => row.id);

      authLogger.debug('Ancestor brokers retrieved successfully', {
        childBrokerId: brokerId,
        ancestorCount: brokerIds.length,
        ancestorIds: brokerIds,
        operation: 'get_ancestor_brokers_success',
      });

      return brokerIds;
    } catch (error) {
      authLogger.error('Failed to get ancestor brokers', error as Error, {
        childBrokerId: brokerId,
        operation: 'get_ancestor_brokers_failed',
      });

      return [brokerId];
    }
  }

  /**
   * Validate that setting parentId wouldn't create a cycle
   * Prevents circular references in broker hierarchy
   */
  async validateNoCycles(parentId: string, childId: string): Promise<boolean> {
    if (!parentId || !childId) {
      return true; // No cycle possible with empty IDs
    }

    if (parentId === childId) {
      authLogger.warn('Cycle detection: broker cannot be its own parent', {
        parentId,
        childId,
        operation: 'cycle_validation',
      });
      return false;
    }

    authLogger.debug('Validating broker hierarchy for cycles', {
      parentId,
      childId,
      operation: 'cycle_validation',
    });

    try {
      // Get all descendants of the proposed child
      const childDescendants = await this.getDescendantBrokerIds(childId);

      // If the proposed parent is in the child's descendants, it would create a cycle
      const wouldCreateCycle = childDescendants.includes(parentId);

      if (wouldCreateCycle) {
        authLogger.warn('Cycle detected in broker hierarchy', {
          parentId,
          childId,
          childDescendants,
          operation: 'cycle_detected',
        });
      } else {
        authLogger.debug('No cycle detected, hierarchy is valid', {
          parentId,
          childId,
          operation: 'cycle_validation_success',
        });
      }

      return !wouldCreateCycle;
    } catch (error) {
      authLogger.error('Error during cycle validation', error as Error, {
        parentId,
        childId,
        operation: 'cycle_validation_error',
      });

      // On error, be conservative and reject the operation
      return false;
    }
  }

  /**
   * Get broker hierarchy information for a specific broker
   * Returns the broker with its position in the hierarchy
   */
  async getBrokerHierarchyInfo(brokerId: string) {
    if (!brokerId) {
      throw new Error('Broker ID is required');
    }

    authLogger.debug('Getting broker hierarchy info', {
      brokerId,
      operation: 'get_hierarchy_info',
    });

    try {
      const broker = await prisma.broker.findUnique({
        where: { id: brokerId },
        include: {
          parent: {
            select: {
              id: true,
              name: true,
            },
          },
          children: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      if (!broker) {
        throw new Error('Broker not found');
      }

      // Get full hierarchy context
      const [descendants, ancestors] = await Promise.all([
        this.getDescendantBrokerIds(brokerId),
        this.getAncestorBrokerIds(brokerId),
      ]);

      const hierarchyInfo = {
        broker: {
          id: broker.id,
          name: broker.name,
          description: broker.description,
          parentId: broker.parentId,
        },
        parent: broker.parent,
        directChildren: broker.children,
        hierarchyStats: {
          totalDescendants: descendants.length - 1, // Exclude self
          totalAncestors: ancestors.length - 1, // Exclude self
          hierarchyLevel: ancestors.length - 1, // 0 for root, 1 for first level child, etc.
        },
        accessibleBrokerIds: descendants, // All brokers this broker can access
      };

      authLogger.debug('Broker hierarchy info retrieved successfully', {
        brokerId,
        hierarchyStats: hierarchyInfo.hierarchyStats,
        operation: 'get_hierarchy_info_success',
      });

      return hierarchyInfo;
    } catch (error) {
      authLogger.error('Failed to get broker hierarchy info', error as Error, {
        brokerId,
        operation: 'get_hierarchy_info_failed',
      });
      throw error;
    }
  }

  /**
   * Check if a user can access a specific broker based on hierarchy
   * Returns true if targetBrokerId is in the user's accessible broker hierarchy
   */
  async canUserAccessBroker(
    userBrokerId: string,
    targetBrokerId: string
  ): Promise<boolean> {
    if (!userBrokerId || !targetBrokerId) {
      return false;
    }

    if (userBrokerId === targetBrokerId) {
      return true; // Can always access own broker
    }

    authLogger.debug('Checking broker access permissions', {
      userBrokerId,
      targetBrokerId,
      operation: 'check_broker_access',
    });

    try {
      const accessibleBrokerIds =
        await this.getDescendantBrokerIds(userBrokerId);
      const hasAccess = accessibleBrokerIds.includes(targetBrokerId);

      authLogger.debug('Broker access check completed', {
        userBrokerId,
        targetBrokerId,
        hasAccess,
        accessibleBrokerIds,
        operation: 'check_broker_access_result',
      });

      return hasAccess;
    } catch (error) {
      authLogger.error('Error checking broker access', error as Error, {
        userBrokerId,
        targetBrokerId,
        operation: 'check_broker_access_error',
      });

      // On error, deny access for security
      return false;
    }
  }
}
