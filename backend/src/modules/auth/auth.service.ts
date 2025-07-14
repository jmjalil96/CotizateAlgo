import { supabase, supabaseAdmin } from '../../config/supabase';
import { prisma } from '../../config/database';
import { authLogger } from '../../services/logger.service';
import { 
  RegisterDto, 
  LoginDto, 
  AuthResponse, 
  ForgotPasswordDto, 
  ResetPasswordDto, 
  ChangePasswordDto,
  UpdateProfileDto,
  RefreshTokenDto,
  ChangeEmailDto
} from './dto/auth.dto';

export class AuthService {
  async register(data: RegisterDto): Promise<AuthResponse> {
    const { email, password, firstName, lastName, cedulaRuc, phone, brokerName } = data;

    // Create user with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError || !authData.user) {
      throw new Error(authError?.message || 'Failed to create user');
    }

    try {
      // Create profile in our database
      authLogger.debug('Creating user profile in database', {
        userId: authData.user.id,
        email,
        firstName,
        lastName,
        cedulaRuc,
        hasPhone: !!phone
      });
      
      let brokerId: string | undefined;
      if (brokerName) {
        const newBroker = await prisma.broker.create({
          data: { name: brokerName },
        });
        brokerId = newBroker.id;
      }

      const profile = await prisma.profile.create({
        data: {
          id: authData.user.id,
          firstName,
          lastName,
          cedulaRuc,
          phone,
          brokerId, // Attach to new broker if created
        },
      });
      
      authLogger.info('User profile created successfully', {
        userId: profile.id,
        email: authData.user.email
      });
      
      authLogger.authEvent('user_registered', {
        userId: profile.id,
        email: authData.user.email!,
        success: true
      });

      return {
        user: {
          id: profile.id,
          email: authData.user.email!,
          firstName: profile.firstName,
          lastName: profile.lastName,
          cedulaRuc: profile.cedulaRuc,
          phone: profile.phone || undefined,
          avatarUrl: profile.avatarUrl || undefined,
          isActive: profile.isActive,
        },
        session: authData.session ? {
          access_token: authData.session.access_token,
          refresh_token: authData.session.refresh_token,
          expires_at: authData.session.expires_at!,
        } : {
          access_token: '',
          refresh_token: '',
          expires_at: 0,
        },
      };
    } catch (dbError) {
      authLogger.error('Database error during profile creation', dbError as Error, {
        userId: authData.user.id,
        email,
        operation: 'profile_creation'
      });
      
      authLogger.authEvent('user_registration_failed', {
        email,
        success: false,
        reason: 'database_error'
      });
      
      // If profile creation fails, delete the auth user
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      
      // Re-throw with more specific error info
      if (dbError instanceof Error) {
        throw new Error(`Failed to create user profile: ${dbError.message}`);
      }
      throw new Error('Failed to create user profile: Unknown database error');
    }
  }

  async login(data: LoginDto): Promise<AuthResponse> {
    const { email, password } = data;

    // Sign in with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !authData.user || !authData.session) {
      throw new Error(authError?.message || 'Invalid credentials');
    }

    // Get user profile
    const profile = await prisma.profile.findUnique({
      where: { id: authData.user.id },
    });

    if (!profile) {
      throw new Error('User profile not found');
    }

    if (!profile.isActive) {
      throw new Error('User account is deactivated');
    }

    return {
      user: {
        id: profile.id,
        email: authData.user.email!,
        firstName: profile.firstName,
        lastName: profile.lastName,
        cedulaRuc: profile.cedulaRuc,
        phone: profile.phone || undefined,
        avatarUrl: profile.avatarUrl || undefined,
        isActive: profile.isActive,
      },
      session: {
        access_token: authData.session.access_token,
        refresh_token: authData.session.refresh_token,
        expires_at: authData.session.expires_at!,
      },
    };
  }

  async logout(_accessToken: string): Promise<void> {
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw new Error('Failed to logout');
    }
  }

  async getCurrentUser(userId: string) {
    const profile = await prisma.profile.findUnique({
      where: { id: userId },
    });

    if (!profile) {
      throw new Error('User profile not found');
    }

    return {
      id: profile.id,
      firstName: profile.firstName,
      lastName: profile.lastName,
      cedulaRuc: profile.cedulaRuc,
      phone: profile.phone || undefined,
      avatarUrl: profile.avatarUrl || undefined,
      isActive: profile.isActive,
    };
  }

  async forgotPassword(data: ForgotPasswordDto): Promise<void> {
    const { email } = data;

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.CLIENT_URL}/reset-password`,
    });

    if (error) {
      throw new Error('Failed to send password reset email');
    }
  }

  async resetPassword(data: ResetPasswordDto): Promise<void> {
    const { token, password } = data;

    // Note: In a real implementation, this would require a session with the token
    // For now, we'll use the admin client to update the password
    const { error } = await supabaseAdmin.auth.admin.updateUserById(token, {
      password: password,
    });

    if (error) {
      throw new Error('Failed to reset password');
    }
  }

  async changePassword(userId: string, data: ChangePasswordDto): Promise<void> {
    const { currentPassword, newPassword } = data;

    // Get user email first
    const profile = await prisma.profile.findUnique({
      where: { id: userId },
    });

    if (!profile) {
      throw new Error('User not found');
    }

    // Get user email from Supabase
    const { data: userData, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(userId);
    
    if (getUserError || !userData.user?.email) {
      throw new Error('User not found');
    }

    // Verify current password by attempting to sign in
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: userData.user.email,
      password: currentPassword,
    });

    if (signInError) {
      throw new Error('Current password is incorrect');
    }

    // Update password
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: newPassword,
    });

    if (updateError) {
      throw new Error('Failed to update password');
    }
  }

  async updateProfile(userId: string, data: UpdateProfileDto) {
    const { firstName, lastName, phone } = data;

    const profile = await prisma.profile.update({
      where: { id: userId },
      data: {
        firstName,
        lastName,
        phone,
      },
    });

    return {
      id: profile.id,
      firstName: profile.firstName,
      lastName: profile.lastName,
      cedulaRuc: profile.cedulaRuc,
      phone: profile.phone || undefined,
      avatarUrl: profile.avatarUrl || undefined,
      isActive: profile.isActive,
    };
  }

  async refreshToken(data: RefreshTokenDto): Promise<AuthResponse> {
    const { refreshToken } = data;

    const { data: refreshData, error } = await supabase.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error || !refreshData.session || !refreshData.user) {
      throw new Error('Invalid or expired refresh token');
    }

    // Get user profile from database
    const profile = await prisma.profile.findUnique({
      where: { id: refreshData.user.id },
    });

    if (!profile) {
      throw new Error('User profile not found');
    }

    return {
      user: {
        id: profile.id,
        email: refreshData.user.email!,
        firstName: profile.firstName,
        lastName: profile.lastName,
        cedulaRuc: profile.cedulaRuc,
        phone: profile.phone || undefined,
        avatarUrl: profile.avatarUrl || undefined,
        isActive: profile.isActive,
      },
      session: {
        access_token: refreshData.session.access_token,
        refresh_token: refreshData.session.refresh_token,
        expires_at: refreshData.session.expires_at!,
      },
    };
  }

  async changeEmail(userId: string, data: ChangeEmailDto): Promise<void> {
    const { newEmail, password } = data;

    // Get current user email from Supabase
    const { data: userData, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(userId);
    
    if (getUserError || !userData.user?.email) {
      throw new Error('User not found');
    }

    // Verify current password by attempting to sign in
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: userData.user.email,
      password: password,
    });

    if (signInError) {
      throw new Error('Current password is incorrect');
    }

    // Update email in Supabase Auth
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      email: newEmail,
    });

    if (updateError) {
      throw new Error('Failed to update email address');
    }
  }
}