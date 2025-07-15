import { prisma } from '../../config/database';
import { supabase } from '../../config/supabase';
import { v4 as uuidv4 } from 'uuid';
import { SendInvitationDto, AcceptInvitationDto } from './dto/invitation.dto';
import { authLogger } from '../../services/logger.service';

export class InvitationService {
  constructor() {
    // Reserved for future use
  }

  async sendInvitation(data: SendInvitationDto, invitedBy: string) {
    const { email, childBrokerName, childBrokerDescription } = data;

    authLogger.debug('Invitation send process initiated', {
      invitedBy,
      email,
      childBrokerName,
      hasDescription: !!childBrokerDescription,
      operation: 'send_invitation_start'
    });

    try {
      // Get sender profile with broker and roles information
      const sender = await prisma.profile.findUnique({
        where: { id: invitedBy },
        include: { 
          broker: true,
          userRoles: { 
            include: { role: true } 
          } 
        },
      });

      if (!sender) {
        authLogger.warn('Invitation send failed - sender profile not found', {
          invitedBy,
          operation: 'send_invitation_validation'
        });
        throw new Error('Sender profile not found');
      }

      // Validate sender has a broker (cannot invite without broker context)
      if (!sender.brokerId || !sender.broker) {
        authLogger.warn('Invitation send failed - sender has no broker', {
          invitedBy,
          operation: 'send_invitation_validation'
        });
        throw new Error('Cannot send invitations without broker context');
      }

      // Check RBAC permissions - sender must be able to invite
      const canInvite = sender.userRoles.some(ur => 
        ur.role.name === 'broker_admin' || 
        ur.role.name === 'employee'
      );

      if (!canInvite) {
        authLogger.warn('Invitation send failed - insufficient permissions', {
          invitedBy,
          senderRoles: sender.userRoles.map(ur => ur.role.name),
          operation: 'send_invitation_validation'
        });
        throw new Error('Unauthorized to send invitations');
      }

      // Check for duplicate pending invitations to the same email
      const existingInvitation = await prisma.invitation.findFirst({
        where: {
          email,
          status: 'pending',
          expiresAt: { gt: new Date() },
        },
      });

      if (existingInvitation) {
        authLogger.warn('Invitation send failed - duplicate pending invitation', {
          invitedBy,
          email,
          existingInvitationId: existingInvitation.id,
          operation: 'send_invitation_validation'
        });
        throw new Error('A pending invitation for this email already exists');
      }

      // TODO: Check if email is already registered in Supabase
      // For now, we'll skip this check to test the core functionality
      // This validation will be added back once we confirm the core flow works

      // Generate invitation token and expiry
      const token = uuidv4();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      // Create invitation record
      const invitation = await prisma.invitation.create({
        data: {
          token,
          email,
          invitedBy,
          childBrokerName,
          childBrokerDescription: childBrokerDescription || null,
          expiresAt,
        },
      });

      authLogger.info('Invitation sent successfully', {
        invitationId: invitation.id,
        invitedBy,
        email,
        childBrokerName,
        parentBrokerName: sender.broker.name,
        expiresAt,
        operation: 'send_invitation_success'
      });

      // TODO: Implement email sending (e.g., via Supabase or Nodemailer)
      // await sendEmail(email, 'Invitation to join as Agent', {
      //   inviterName: `${sender.firstName} ${sender.lastName}`,
      //   brokerName: sender.broker.name,
      //   childBrokerName,
      //   acceptUrl: `${process.env.CLIENT_URL}/accept-invitation?token=${token}`,
      //   expiresAt
      // });

      return { 
        message: 'Invitation sent successfully',
        invitationId: invitation.id,
        expiresAt 
      };

    } catch (error) {
      authLogger.error('Invitation send process failed', error as Error, {
        invitedBy,
        email,
        childBrokerName,
        operation: 'send_invitation_error'
      });
      throw error;
    }
  }

  async acceptInvitation(data: AcceptInvitationDto) {
    const { token, password, firstName, lastName, cedulaRuc, phone } = data;

    authLogger.debug('Invitation acceptance process initiated', {
      token,
      firstName,
      lastName,
      cedulaRuc,
      hasPhone: !!phone,
      operation: 'accept_invitation_start'
    });

    try {
      // Get invitation with sender information
      const invite = await prisma.invitation.findUnique({ 
        where: { token },
        include: { 
          invitedByUser: { 
            include: { 
              broker: true 
            } 
          } 
        }
      });

      // Validate invitation
      if (!invite) {
        authLogger.warn('Invitation acceptance failed - invitation not found', {
          token,
          operation: 'accept_invitation_validation'
        });
        throw new Error('Invitation not found');
      }

      if (invite.status !== 'pending') {
        authLogger.warn('Invitation acceptance failed - invitation not pending', {
          token,
          status: invite.status,
          operation: 'accept_invitation_validation'
        });
        throw new Error('Invitation has already been processed');
      }

      if (invite.expiresAt < new Date()) {
        authLogger.warn('Invitation acceptance failed - invitation expired', {
          token,
          expiresAt: invite.expiresAt,
          operation: 'accept_invitation_validation'
        });
        throw new Error('Invitation has expired');
      }

      // Validate sender has broker context (edge case)
      if (!invite.invitedByUser.brokerId || !invite.invitedByUser.broker) {
        authLogger.error('Invitation acceptance failed - sender has no broker context', {
          token,
          invitedBy: invite.invitedBy,
          operation: 'accept_invitation_validation'
        });
        throw new Error('Invitation sender has no broker context');
      }

      authLogger.debug('Invitation validation passed', {
        token,
        invitedBy: invite.invitedBy,
        parentBrokerId: invite.invitedByUser.brokerId,
        parentBrokerName: invite.invitedByUser.broker.name,
        childBrokerName: invite.childBrokerName,
        operation: 'accept_invitation_validation_success'
      });

      // Check for duplicate cedulaRuc
      const existingProfile = await prisma.profile.findUnique({
        where: { cedulaRuc },
      });

      if (existingProfile) {
        authLogger.warn('Invitation acceptance failed - cedula/RUC already exists', {
          token,
          cedulaRuc,
          operation: 'accept_invitation_validation'
        });
        throw new Error('Cedula/RUC is already registered');
      }

      // Perform everything in a database transaction
      const result = await prisma.$transaction(async (tx) => {
        authLogger.debug('Starting invitation acceptance transaction', {
          token,
          operation: 'accept_invitation_transaction_start'
        });

        // 1. Create Supabase user
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: invite.email,
          password: password,
        });

        if (authError || !authData.user) {
          authLogger.error('Failed to create Supabase user', authError, {
            token,
            email: invite.email,
            operation: 'accept_invitation_supabase_signup'
          });
          throw new Error('Failed to create user account');
        }

        authLogger.debug('Supabase user created successfully', {
          token,
          userId: authData.user.id,
          email: authData.user.email,
          operation: 'accept_invitation_supabase_success'
        });

        // 2. Create child broker with parentId = sender's brokerId
        const childBroker = await tx.broker.create({
          data: {
            name: invite.childBrokerName,
            description: invite.childBrokerDescription,
            parentId: invite.invitedByUser.brokerId,
          },
        });

        authLogger.debug('Child broker created successfully', {
          token,
          childBrokerId: childBroker.id,
          childBrokerName: childBroker.name,
          parentBrokerId: invite.invitedByUser.brokerId,
          operation: 'accept_invitation_broker_creation'
        });

        // 3. Create user profile with new child broker
        const profile = await tx.profile.create({
          data: {
            id: authData.user.id,
            firstName,
            lastName,
            cedulaRuc,
            phone: phone || null,
            brokerId: childBroker.id, // Attach to NEW child broker
          },
        });

        authLogger.debug('User profile created successfully', {
          token,
          userId: profile.id,
          brokerId: profile.brokerId,
          operation: 'accept_invitation_profile_creation'
        });

        // 4. Get "agent" role
        const agentRole = await tx.role.findUnique({ 
          where: { name: 'agent' } 
        });

        if (!agentRole) {
          authLogger.error('Agent role not found in database', null, {
            token,
            operation: 'accept_invitation_role_lookup'
          });
          throw new Error('Agent role not found in system');
        }

        // 5. Assign "agent" role to new user
        await tx.userRole.create({
          data: {
            userId: authData.user.id,
            roleId: agentRole.id,
            assignedBy: invite.invitedBy, // Assigned by invitation sender
          },
        });

        authLogger.debug('Agent role assigned successfully', {
          token,
          userId: authData.user.id,
          roleId: agentRole.id,
          assignedBy: invite.invitedBy,
          operation: 'accept_invitation_role_assignment'
        });

        // 6. Update invitation status
        await tx.invitation.update({ 
          where: { id: invite.id }, 
          data: { status: 'accepted' } 
        });

        authLogger.debug('Invitation marked as accepted', {
          token,
          invitationId: invite.id,
          operation: 'accept_invitation_status_update'
        });

        return {
          user: {
            id: profile.id,
            email: authData.user.email!,
            firstName: profile.firstName,
            lastName: profile.lastName,
            cedulaRuc: profile.cedulaRuc,
            phone: profile.phone || undefined,
            isActive: profile.isActive,
          },
          childBroker: {
            id: childBroker.id,
            name: childBroker.name,
            description: childBroker.description || undefined,
            parentId: childBroker.parentId,
          },
          parentBroker: {
            id: invite.invitedByUser.broker?.id || '',
            name: invite.invitedByUser.broker?.name || '',
          },
          role: {
            id: agentRole.id,
            name: agentRole.name,
            description: agentRole.description || undefined,
          },
        };
      });

      authLogger.info('Invitation acceptance completed successfully', {
        token,
        userId: result.user.id,
        email: result.user.email,
        childBrokerId: result.childBroker.id,
        childBrokerName: result.childBroker.name,
        parentBrokerId: result.parentBroker.id,
        parentBrokerName: result.parentBroker.name,
        roleName: result.role.name,
        operation: 'accept_invitation_success'
      });

      return {
        message: 'Invitation accepted successfully. Child broker created and agent role assigned.',
        data: result,
      };

    } catch (error) {
      authLogger.error('Invitation acceptance process failed', error as Error, {
        token,
        firstName,
        lastName,
        cedulaRuc,
        operation: 'accept_invitation_error'
      });
      throw error;
    }
  }
} 