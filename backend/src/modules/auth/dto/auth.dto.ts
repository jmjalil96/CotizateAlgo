export interface RegisterDto {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  cedulaRuc: string;
  phone?: string;
  brokerName?: string; // Optional: If provided, create a new broker with this name
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface ForgotPasswordDto {
  email: string;
}

export interface ResetPasswordDto {
  token: string;
  password: string;
}

export interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
}

export interface UpdateProfileDto {
  firstName: string;
  lastName: string;
  phone?: string;
}

export interface RefreshTokenDto {
  refreshToken: string;
}

export interface ChangeEmailDto {
  newEmail: string;
  password: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    cedulaRuc: string;
    phone?: string;
    avatarUrl?: string;
    isActive: boolean;
  };
  session: {
    access_token: string;
    refresh_token: string;
    expires_at: number;
  };
}