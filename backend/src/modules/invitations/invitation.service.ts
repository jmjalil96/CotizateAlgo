import { prisma } from '../../config/database';
import { supabase } from '../../config/supabase';
import { v4 as uuidv4 } from 'uuid';
import { SendInvitationDto, AcceptInvitationDto } from './dto/invitation.dto';

export class InvitationService {
  async sendInvitation(data: SendInvitationDto, invitedBy: string) {
    // Example RBAC check
    const sender = await prisma.profile.findUnique({
      where: { id: invitedBy },
      include: { userRoles: { include: { role: true } } },
    });
    const canInvite = sender?.userRoles.some(ur => ur.role.name === 'broker_admin'); // Customize based on your roles
    if (!canInvite) {
      throw new Error('Unauthorized to send invitations');
    }

    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await prisma.invitation.create({
      data: {
        token,
        email: data.email,
        brokerId: data.brokerId,
        invitedBy,
        expiresAt,
      },
    });

    // TODO: Implement email sending (e.g., via Supabase or Nodemailer)
    // await sendEmail(data.email, 'Invitation', `Accept: /accept?token=${token}`);

    return { message: 'Invitation sent' };
  }

  async acceptInvitation(data: AcceptInvitationDto) {
    const invite = await prisma.invitation.findUnique({ where: { token: data.token } });
    if (!invite || invite.status !== 'pending' || invite.expiresAt < new Date()) {
      throw new Error('Invalid or expired invitation');
    }

    const { data: authData, error } = await supabase.auth.signUp({
      email: invite.email,
      password: data.password,
    });
    if (error || !authData.user) throw new Error('Failed to create user');

    await prisma.profile.create({
      data: {
        id: authData.user.id,
        firstName: data.firstName,
        lastName: data.lastName,
        cedulaRuc: data.cedulaRuc,
        phone: data.phone,
        brokerId: invite.brokerId, // Attach to existing broker
      },
    });

    await prisma.invitation.update({ where: { id: invite.id }, data: { status: 'accepted' } });

    return { message: 'Invitation accepted, user created' };
  }
} 