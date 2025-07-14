export interface SendInvitationDto {
  email: string; // Invitee email
  brokerId: string; // Existing broker to attach to
}

export interface AcceptInvitationDto {
  token: string; // Invite token
  password: string; // New user's password
  firstName: string;
  lastName: string;
  cedulaRuc: string;
  phone?: string;
} 