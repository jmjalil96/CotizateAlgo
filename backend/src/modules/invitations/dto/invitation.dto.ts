export interface SendInvitationDto {
  email: string; // Invitee email
  childBrokerName: string; // Name for the new child broker to be created
  childBrokerDescription?: string; // Optional description for the new child broker
}

export interface AcceptInvitationDto {
  token: string; // Invite token
  password: string; // New user's password
  firstName: string;
  lastName: string;
  cedulaRuc: string;
  phone?: string;
} 