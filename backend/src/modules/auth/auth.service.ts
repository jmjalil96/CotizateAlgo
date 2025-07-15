import { supabase, supabaseAdmin } from '../../config/supabase';
import { prisma } from '../../config/database';
import { authLogger } from '../../services/logger.service';
import { UserRoleService } from '../../services/userRole.service';
import { PermissionService } from '../../services/permission.service';
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
  private userRoleService: UserRoleService;
  private permissionService: PermissionService;

  constructor() {
    this.userRoleService = new UserRoleService();
    this.permissionService = new PermissionService();
  }

  async register(data: RegisterDto): Promise<AuthResponse> {
    const { email, password, firstName, lastName, cedulaRuc, phone, brokerName, brokerDescription } = data;

    // Create user with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError || !authData.user) {
      throw new Error(authError?.message || 'Failed to create user');
    }

    // CRITICAL: Validate JWT token integrity to prevent corruption bugs
    if (authData.session?.access_token) {
      try {
        // Decode JWT payload to check for corruption
        const payload = JSON.parse(atob(authData.session.access_token.split('.')[1]));
        const mainSub = payload.sub;
        const metadataSub = payload.user_metadata?.sub;
        
        if (metadataSub && mainSub !== metadataSub) {
          authLogger.error('JWT token corruption detected during registration', {
            userId: authData.user.id,
            email,
            mainSub,
            metadataSub,
            operation: 'jwt_validation'
          });
          
          // Clean up the corrupted user immediately
          await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
          throw new Error('Registration failed due to authentication system error. Please try again.');
        }
        
        authLogger.debug('JWT token validation passed', {
          userId: authData.user.id,
          mainSub,
          hasMetadataSub: !!metadataSub,
          operation: 'jwt_validation'
        });
      } catch (jwtError) {
        authLogger.error('Failed to validate JWT token', jwtError as Error, {
          userId: authData.user.id,
          email,
          operation: 'jwt_validation_error'
        });
        
        // Clean up the user if validation fails
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
        throw new Error('Registration failed due to authentication system error. Please try again.');
      }
    }

    try {
      // Create everything in a transaction to ensure atomicity
      const result = await prisma.$transaction(async (tx) => {
        authLogger.debug('Creating user profile and broker in database', {
          userId: authData.user?.id,
          email,
          firstName,
          lastName,
          cedulaRuc,
          hasPhone: !!phone,
          brokerName
        });
        
        // Create new broker
        const newBroker = await tx.broker.create({
          data: { 
            name: brokerName,
            description: brokerDescription || null,
          },
        });
        
        authLogger.debug('Broker created successfully', {
          brokerId: newBroker.id,
          brokerName: newBroker.name
        });

        // Create profile and assign to broker
        const profile = await tx.profile.create({
          data: {
            id: authData.user?.id || '',
            firstName,
            lastName,
            cedulaRuc,
            phone,
            brokerId: newBroker.id,
          },
        });
        
        authLogger.debug('User profile created successfully', {
          userId: profile.id,
          brokerId: profile.brokerId
        });

        // Get broker_admin role
        const brokerAdminRole = await tx.role.findUnique({
          where: { name: 'broker_admin' },
        });
        
        if (!brokerAdminRole) {
          throw new Error('broker_admin role not found in database');
        }
        
        // Assign broker_admin role to user
        await tx.userRole.create({
          data: {
            userId: profile.id,
            roleId: brokerAdminRole.id,
            assignedBy: profile.id, // Self-assigned during registration
          },
        });
        
        authLogger.debug('broker_admin role assigned to user', {
          userId: profile.id,
          roleId: brokerAdminRole.id
        });
        
        return { profile, broker: newBroker };
      });
      
      const { profile, broker } = result;
      
      // Get user roles and permissions for complete auth response
      const userRoles = await this.userRoleService.getUserRoles(profile.id);
      const userPermissionsResult = await this.permissionService.getUserPermissions(profile.id);
      
      authLogger.info('User registration completed successfully', {
        userId: profile.id,
        email: authData.user.email,
        brokerId: profile.brokerId,
        brokerName,
        roleAssigned: 'broker_admin'
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
        broker: {
          id: broker.id,
          name: broker.name,
          description: broker.description || undefined,
        },
        roles: userRoles.map(role => ({
          id: role.id,
          name: role.name,
          description: role.description || undefined,
        })),
        permissions: userPermissionsResult.permissions,
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

    // Get user profile with broker information
    const profile = await prisma.profile.findUnique({
      where: { id: authData.user.id },
      include: {
        broker: true,
      },
    });

    if (!profile) {
      throw new Error('User profile not found');
    }

    if (!profile.isActive) {
      throw new Error('User account is deactivated');
    }

    // Get user roles and permissions for complete auth context
    const userRoles = await this.userRoleService.getUserRoles(profile.id);
    const userPermissionsResult = await this.permissionService.getUserPermissions(profile.id);

    authLogger.info('User login successful', {
      userId: profile.id,
      email: authData.user.email,
      brokerId: profile.brokerId,
      rolesCount: userRoles.length,
      permissionsCount: userPermissionsResult.permissions.length
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
      broker: profile.broker ? {
        id: profile.broker.id,
        name: profile.broker.name,
        description: profile.broker.description || undefined,
      } : undefined,
      roles: userRoles.map(role => ({
        id: role.id,
        name: role.name,
        description: role.description || undefined,
      })),
      permissions: userPermissionsResult.permissions,
      session: {
        access_token: authData.session.access_token,
        refresh_token: authData.session.refresh_token,
        expires_at: authData.session.expires_at!,
      },
    };
  }

  async logout(accessToken: string, userId?: string): Promise<void> {
    try {
      // Log the logout attempt for audit purposes
      if (userId) {
        authLogger.debug('Processing logout for user', {
          userId,
          hasAccessToken: !!accessToken
        });
      }
      
      // Sign out from Supabase Auth
      const { error } = await supabase.auth.signOut();
      if (error) {
        authLogger.error('Supabase logout error', error, {
          userId,
          operation: 'supabase_signout'
        });
        throw new Error('Failed to logout from authentication service');
      }
      
      // Additional cleanup could be added here:
      // - Invalidate refresh tokens in database
      // - Clear session-related data
      // - Notify other services of logout
      
      authLogger.debug('Logout completed successfully', {
        userId,
        operation: 'logout_complete'
      });
      
    } catch (error) {
      authLogger.error('Logout process failed', error as Error, {
        userId,
        operation: 'logout'
      });
      throw error;
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

  async getCurrentUserWithContext(userId: string) {
    // Get user profile with broker information
    const profile = await prisma.profile.findUnique({
      where: { id: userId },
      include: {
        broker: true,
      },
    });

    if (!profile) {
      throw new Error('User profile not found');
    }

    if (!profile.isActive) {
      throw new Error('User account is deactivated');
    }

    // Get user roles and permissions for complete auth context
    const userRoles = await this.userRoleService.getUserRoles(profile.id);
    const userPermissionsResult = await this.permissionService.getUserPermissions(profile.id);

    authLogger.debug('User context retrieved', {
      userId: profile.id,
      brokerId: profile.brokerId,
      rolesCount: userRoles.length,
      permissionsCount: userPermissionsResult.permissions.length
    });

    return {
      user: {
        id: profile.id,
        firstName: profile.firstName,
        lastName: profile.lastName,
        cedulaRuc: profile.cedulaRuc,
        phone: profile.phone || undefined,
        avatarUrl: profile.avatarUrl || undefined,
        isActive: profile.isActive,
      },
      broker: profile.broker ? {
        id: profile.broker.id,
        name: profile.broker.name,
        description: profile.broker.description || undefined,
      } : undefined,
      roles: userRoles.map(role => ({
        id: role.id,
        name: role.name,
        description: role.description || undefined,
      })),
      permissions: userPermissionsResult.permissions,
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
    const { token_hash, password } = data;

    authLogger.debug('Password reset attempt', {
      hasTokenHash: !!token_hash,
      operation: 'password_reset'
    });

    try {
      // Verify the reset token using Supabase's verifyOtp
      const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
        token_hash,
        type: 'recovery'
      });

      if (verifyError || !verifyData.user) {
        authLogger.error('Password reset token verification failed', verifyError, {
          hasTokenHash: !!token_hash,
          operation: 'token_verification'
        });
        throw new Error('Invalid or expired reset token');
      }

      authLogger.debug('Token verified successfully', {
        userId: verifyData.user.id,
        operation: 'token_verification'
      });

      // Create a temporary client with the verified session to update password
      const tempSupabase = supabase;
      const { error: updateError } = await tempSupabase.auth.updateUser({
        password: password
      });

      if (updateError) {
        authLogger.error('Password update failed', updateError, {
          userId: verifyData.user.id,
          operation: 'password_update'
        });
        throw new Error('Failed to update password');
      }

      authLogger.info('Password reset completed successfully', {
        userId: verifyData.user.id,
        operation: 'password_reset_complete'
      });

      authLogger.authEvent('password_reset', {
        userId: verifyData.user.id,
        email: verifyData.user.email || 'unknown',
        success: true
      });

    } catch (error) {
      authLogger.error('Password reset process failed', error as Error, {
        operation: 'password_reset'
      });
      
      authLogger.authEvent('password_reset_failed', {
        success: false,
        reason: error instanceof Error ? error.message : 'unknown_error'
      });
      
      throw error;
    }
  }

  async changePassword(userId: string, data: ChangePasswordDto): Promise<void> {
    const { currentPassword, newPassword } = data;

    authLogger.debug('Password change process initiated', {
      userId,
      hasCurrentPassword: !!currentPassword,
      hasNewPassword: !!newPassword,
      newPasswordLength: newPassword.length,
      operation: 'change_password_start'
    });

    try {
      // Get user profile from database
      const profile = await prisma.profile.findUnique({
        where: { id: userId },
      });

      if (!profile) {
        authLogger.warn('Password change failed - profile not found', {
          userId,
          operation: 'profile_lookup'
        });
        throw new Error('User not found');
      }

      authLogger.debug('User profile retrieved for password change', {
        userId,
        isActive: profile.isActive,
        operation: 'profile_verification'
      });

      // Get user email from Supabase
      const { data: userData, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(userId);
      
      if (getUserError || !userData.user?.email) {
        authLogger.error('Failed to get user from Supabase', getUserError, {
          userId,
          operation: 'supabase_user_lookup'
        });
        throw new Error('User not found in authentication system');
      }

      authLogger.debug('Supabase user data retrieved', {
        userId,
        email: userData.user.email,
        operation: 'supabase_user_verification'
      });

      // Verify current password by attempting to sign in
      authLogger.debug('Verifying current password', {
        userId,
        email: userData.user.email,
        operation: 'password_verification'
      });

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: userData.user.email,
        password: currentPassword,
      });

      if (signInError) {
        authLogger.warn('Current password verification failed', {
          userId,
          email: userData.user.email,
          errorCode: signInError.message,
          operation: 'password_verification_failed'
        });
        throw new Error('Current password is incorrect');
      }

      authLogger.debug('Current password verified successfully', {
        userId,
        operation: 'password_verification_success'
      });

      // Additional password strength validation
      if (newPassword.length < 8) {
        authLogger.warn('New password does not meet strength requirements', {
          userId,
          passwordLength: newPassword.length,
          operation: 'password_strength_check'
        });
        throw new Error('New password must be at least 8 characters long');
      }

      // Update password using Supabase admin
      authLogger.debug('Updating password in Supabase', {
        userId,
        operation: 'password_update'
      });

      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: newPassword,
      });

      if (updateError) {
        authLogger.error('Password update failed in Supabase', updateError, {
          userId,
          operation: 'password_update_failed'
        });
        throw new Error('Failed to update password');
      }

      authLogger.info('Password change completed successfully', {
        userId,
        email: userData.user.email,
        operation: 'password_change_complete'
      });

      // Note: Consider invalidating other active sessions here for enhanced security
      // This would require additional session management implementation
      
    } catch (error) {
      authLogger.error('Password change process failed', error as Error, {
        userId,
        operation: 'change_password',
        errorType: error instanceof Error ? error.constructor.name : 'unknown'
      });
      throw error;
    }
  }

  async updateProfile(userId: string, data: UpdateProfileDto) {
    const { firstName, lastName, phone } = data;

    authLogger.debug('Profile update process initiated', {
      userId,
      fieldsToUpdate: Object.keys(data),
      hasFirstName: !!firstName,
      hasLastName: !!lastName,
      hasPhone: !!phone,
      operation: 'update_profile_start'
    });

    try {
      // First check if user exists and is active
      const existingProfile = await prisma.profile.findUnique({
        where: { id: userId },
      });

      if (!existingProfile) {
        authLogger.warn('Profile update failed - user not found', {
          userId,
          operation: 'profile_lookup'
        });
        throw new Error('User profile not found');
      }

      if (!existingProfile.isActive) {
        authLogger.warn('Profile update attempted on inactive user', {
          userId,
          operation: 'profile_active_check'
        });
        throw new Error('Cannot update profile for inactive user');
      }

      authLogger.debug('Existing profile retrieved for update', {
        userId,
        isActive: existingProfile.isActive,
        currentFirstName: existingProfile.firstName,
        currentLastName: existingProfile.lastName,
        hasCurrentPhone: !!existingProfile.phone,
        operation: 'profile_verification'
      });

      // Track what fields are actually changing
      const changes: string[] = [];
      if (firstName !== existingProfile.firstName) changes.push('firstName');
      if (lastName !== existingProfile.lastName) changes.push('lastName');
      if (phone !== existingProfile.phone) changes.push('phone');

      authLogger.debug('Profile changes detected', {
        userId,
        changedFields: changes,
        hasChanges: changes.length > 0,
        operation: 'profile_change_detection'
      });

      // Additional validation
      if (firstName && firstName.trim().length === 0) {
        throw new Error('First name cannot be empty');
      }
      if (lastName && lastName.trim().length === 0) {
        throw new Error('Last name cannot be empty');
      }
      if (phone && phone.trim().length > 0 && phone.trim().length < 8) {
        throw new Error('Phone number must be at least 8 characters');
      }

      // Update the profile
      authLogger.debug('Updating profile in database', {
        userId,
        changedFields: changes,
        operation: 'profile_database_update'
      });

      const profile = await prisma.profile.update({
        where: { id: userId },
        data: {
          firstName: firstName || existingProfile.firstName,
          lastName: lastName || existingProfile.lastName,
          phone: phone !== undefined ? phone : existingProfile.phone,
          updatedAt: new Date(),
        },
      });

      authLogger.info('Profile update completed successfully', {
        userId,
        changedFields: changes,
        operation: 'profile_update_complete'
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
      
    } catch (error) {
      authLogger.error('Profile update process failed', error as Error, {
        userId,
        operation: 'update_profile',
        errorType: error instanceof Error ? error.constructor.name : 'unknown'
      });
      throw error;
    }
  }

  async refreshToken(data: RefreshTokenDto): Promise<AuthResponse> {
    const { refreshToken } = data;

    const { data: refreshData, error } = await supabase.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error || !refreshData.session || !refreshData.user) {
      throw new Error('Invalid or expired refresh token');
    }

    // Get user profile with broker information
    const profile = await prisma.profile.findUnique({
      where: { id: refreshData.user.id },
      include: {
        broker: true,
      },
    });

    if (!profile) {
      throw new Error('User profile not found');
    }

    // Get user roles and permissions for complete auth context
    const userRoles = await this.userRoleService.getUserRoles(profile.id);
    const userPermissionsResult = await this.permissionService.getUserPermissions(profile.id);

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
      broker: profile.broker ? {
        id: profile.broker.id,
        name: profile.broker.name,
        description: profile.broker.description || undefined,
      } : undefined,
      roles: userRoles.map(role => ({
        id: role.id,
        name: role.name,
        description: role.description || undefined,
      })),
      permissions: userPermissionsResult.permissions,
      session: {
        access_token: refreshData.session.access_token,
        refresh_token: refreshData.session.refresh_token,
        expires_at: refreshData.session.expires_at!,
      },
    };
  }

  async changeEmail(userId: string, data: ChangeEmailDto): Promise<void> {
    const { newEmail, password } = data;

    authLogger.debug('Email change process initiated', {
      userId,
      newEmail,
      hasPassword: !!password,
      operation: 'change_email_start'
    });

    try {
      // First check if user exists and is active
      const existingProfile = await prisma.profile.findUnique({
        where: { id: userId },
      });

      if (!existingProfile) {
        authLogger.warn('Email change failed - user profile not found', {
          userId,
          operation: 'profile_lookup'
        });
        throw new Error('User profile not found');
      }

      if (!existingProfile.isActive) {
        authLogger.warn('Email change attempted on inactive user', {
          userId,
          operation: 'profile_active_check'
        });
        throw new Error('Cannot change email for inactive user');
      }

      authLogger.debug('User profile verified for email change', {
        userId,
        isActive: existingProfile.isActive,
        operation: 'profile_verification'
      });

      // Get current user email from Supabase
      authLogger.debug('Retrieving current user data from Supabase', {
        userId,
        operation: 'supabase_user_lookup'
      });

      const { data: userData, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(userId);
      
      if (getUserError || !userData.user?.email) {
        authLogger.error('Failed to get user from Supabase for email change', getUserError, {
          userId,
          operation: 'supabase_user_lookup'
        });
        throw new Error('User not found in authentication system');
      }

      const currentEmail = userData.user.email;

      authLogger.debug('Current user data retrieved', {
        userId,
        currentEmail,
        newEmail,
        operation: 'user_data_verification'
      });

      // Check if new email is different from current
      if (newEmail.toLowerCase() === currentEmail.toLowerCase()) {
        authLogger.warn('Email change attempted with same email', {
          userId,
          email: currentEmail,
          operation: 'same_email_check'
        });
        throw new Error('New email must be different from current email');
      }

      // Check if new email is already in use by another user
      authLogger.debug('Checking for email conflicts', {
        userId,
        newEmail,
        operation: 'email_conflict_check'
      });

      const { data: existingUser, error: checkError } = await supabaseAdmin.auth.admin.listUsers();
      
      if (checkError) {
        authLogger.error('Failed to check for email conflicts', checkError, {
          userId,
          newEmail,
          operation: 'email_conflict_check'
        });
        throw new Error('Failed to verify email availability');
      }

      const emailExists = existingUser.users.some(
        user => user.email?.toLowerCase() === newEmail.toLowerCase() && user.id !== userId
      );

      if (emailExists) {
        authLogger.warn('Email change failed - email already in use', {
          userId,
          newEmail,
          operation: 'email_conflict_detected'
        });
        throw new Error('Email address is already in use by another account');
      }

      authLogger.debug('Email availability verified', {
        userId,
        newEmail,
        operation: 'email_availability_confirmed'
      });

      // Verify current password by attempting to sign in
      authLogger.debug('Verifying current password for email change', {
        userId,
        currentEmail,
        operation: 'password_verification'
      });

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: currentEmail,
        password: password,
      });

      if (signInError) {
        authLogger.warn('Password verification failed for email change', {
          userId,
          currentEmail,
          errorCode: signInError.message,
          operation: 'password_verification_failed'
        });
        throw new Error('Current password is incorrect');
      }

      authLogger.debug('Password verified successfully for email change', {
        userId,
        operation: 'password_verification_success'
      });

      // Update email in Supabase Auth
      authLogger.debug('Updating email in Supabase', {
        userId,
        currentEmail,
        newEmail,
        operation: 'email_update'
      });

      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        email: newEmail,
      });

      if (updateError) {
        authLogger.error('Email update failed in Supabase', updateError, {
          userId,
          currentEmail,
          newEmail,
          operation: 'email_update_failed'
        });
        throw new Error('Failed to update email address');
      }

      authLogger.info('Email change completed successfully', {
        userId,
        oldEmail: currentEmail,
        newEmail,
        operation: 'email_change_complete'
      });

      authLogger.authEvent('email_changed', {
        userId,
        email: newEmail,
        success: true
      });

    } catch (error) {
      authLogger.error('Email change process failed', error as Error, {
        userId,
        newEmail,
        operation: 'change_email',
        errorType: error instanceof Error ? error.constructor.name : 'unknown'
      });

      authLogger.authEvent('email_change_failed', {
        userId,
        email: newEmail,
        success: false,
        reason: error instanceof Error ? error.message : 'unknown_error'
      });

      throw error;
    }
  }
}