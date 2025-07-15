import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { authLogger } from '../../services/logger.service';
import { 
  RegisterDto, 
  LoginDto, 
  ForgotPasswordDto, 
  ResetPasswordDto, 
  ChangePasswordDto,
  UpdateProfileDto,
  RefreshTokenDto,
  ChangeEmailDto
} from './dto/auth.dto';

export class AuthController {
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  register = async (req: Request, res: Response): Promise<void> => {
    const correlationId = (req as any).correlationId;
    const logger = authLogger.withCorrelationId(correlationId);
    
    try {
      const registerData: RegisterDto = req.body;
      logger.info('User registration attempt', {
        email: registerData.email,
        firstName: registerData.firstName,
        lastName: registerData.lastName,
        hasPhone: !!registerData.phone
      });
      
      const result = await this.authService.register(registerData);

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: result,
      });
    } catch (error) {
      logger.error('User registration failed', error as Error, {
        email: req.body.email,
        operation: 'register'
      });
      
      logger.authEvent('registration_failed', {
        email: req.body.email,
        success: false,
        reason: (error as Error).message
      });
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Registration failed',
      });
    }
  };

  login = async (req: Request, res: Response): Promise<void> => {
    try {
      const loginData: LoginDto = req.body;
      const result = await this.authService.login(loginData);

      res.status(200).json({
        success: true,
        message: 'Login successful',
        data: result,
      });
    } catch (error) {
      res.status(401).json({
        success: false,
        message: error instanceof Error ? error.message : 'Login failed',
      });
    }
  };

  logout = async (req: Request, res: Response): Promise<void> => {
    const correlationId = (req as any).correlationId;
    const logger = authLogger.withCorrelationId(correlationId);
    
    try {
      // Get user from auth middleware
      const user = (req as any).user;
      const accessToken = req.headers.authorization?.replace('Bearer ', '') || '';
      
      if (!user) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated',
        });
        return;
      }

      logger.info('User logout attempt', {
        userId: user.id,
        email: user.email,
        userAgent: req.headers['user-agent'],
        ip: req.ip
      });
      
      await this.authService.logout(accessToken, user.id);

      logger.info('User logout successful', {
        userId: user.id,
        email: user.email
      });
      
      logger.authEvent('user_logout', {
        userId: user.id,
        email: user.email,
        success: true
      });

      res.status(200).json({
        success: true,
        message: 'Logout successful',
      });
    } catch (error) {
      logger.error('User logout failed', error as Error, {
        operation: 'logout'
      });
      
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Logout failed',
      });
    }
  };

  me = async (req: Request, res: Response): Promise<void> => {
    const correlationId = (req as any).correlationId;
    const logger = authLogger.withCorrelationId(correlationId);
    
    try {
      // User ID comes from auth middleware
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated',
        });
        return;
      }

      logger.debug('Getting user context', {
        userId,
        operation: 'get_me_context'
      });

      const userContext = await this.authService.getCurrentUserWithContext(userId);

      logger.info('User context retrieved successfully', {
        userId,
        brokerId: userContext.broker?.id,
        rolesCount: userContext.roles.length,
        permissionsCount: userContext.permissions.length
      });

      res.status(200).json({
        success: true,
        message: 'User context retrieved successfully',
        data: userContext,
      });
    } catch (error) {
      logger.error('Failed to get user context', error as Error, {
        userId: (req as any).user?.id,
        operation: 'get_me_context'
      });
      
      res.status(404).json({
        success: false,
        message: error instanceof Error ? error.message : 'User not found',
      });
    }
  };

  forgotPassword = async (req: Request, res: Response): Promise<void> => {
    try {
      const forgotPasswordData: ForgotPasswordDto = req.body;
      await this.authService.forgotPassword(forgotPasswordData);

      res.status(200).json({
        success: true,
        message: 'Password reset email sent successfully',
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to send password reset email',
      });
    }
  };

  resetPassword = async (req: Request, res: Response): Promise<void> => {
    try {
      const resetPasswordData: ResetPasswordDto = req.body;
      await this.authService.resetPassword(resetPasswordData);

      res.status(200).json({
        success: true,
        message: 'Password reset successfully',
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to reset password',
      });
    }
  };

  changePassword = async (req: Request, res: Response): Promise<void> => {
    const correlationId = (req as any).correlationId;
    const logger = authLogger.withCorrelationId(correlationId);
    
    try {
      const user = (req as any).user;
      const userId = user?.id;

      if (!userId) {
        logger.warn('Password change attempt without authentication', {
          ip: req.ip,
          userAgent: req.headers['user-agent'],
          operation: 'change_password'
        });
        
        res.status(401).json({
          success: false,
          message: 'User not authenticated',
        });
        return;
      }

      logger.info('Password change attempt initiated', {
        userId,
        email: user.email,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        operation: 'change_password_attempt'
      });

      const changePasswordData: ChangePasswordDto = req.body;
      await this.authService.changePassword(userId, changePasswordData);

      logger.info('Password change completed successfully', {
        userId,
        email: user.email,
        operation: 'change_password_success'
      });
      
      logger.authEvent('password_changed', {
        userId,
        email: user.email,
        success: true
      });

      res.status(200).json({
        success: true,
        message: 'Password changed successfully',
      });
    } catch (error) {
      const user = (req as any).user;
      
      logger.error('Password change failed', error as Error, {
        userId: user?.id,
        email: user?.email,
        operation: 'change_password_failed',
        errorMessage: error instanceof Error ? error.message : 'unknown_error'
      });
      
      logger.authEvent('password_change_failed', {
        userId: user?.id || 'unknown',
        email: user?.email || 'unknown',
        success: false,
        reason: error instanceof Error ? error.message : 'unknown_error'
      });
      
      // Provide specific error status codes based on error type
      const isAuthError = error instanceof Error && 
        (error.message.includes('Current password is incorrect') || 
         error.message.includes('User not found'));
      
      res.status(isAuthError ? 401 : 400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to change password',
      });
    }
  };

  updateProfile = async (req: Request, res: Response): Promise<void> => {
    const correlationId = (req as any).correlationId;
    const logger = authLogger.withCorrelationId(correlationId);
    
    try {
      const user = (req as any).user;
      const userId = user?.id;

      if (!userId) {
        logger.warn('Profile update attempt without authentication', {
          ip: req.ip,
          userAgent: req.headers['user-agent'],
          operation: 'update_profile'
        });
        
        res.status(401).json({
          success: false,
          message: 'User not authenticated',
        });
        return;
      }

      const updateProfileData: UpdateProfileDto = req.body;
      
      logger.info('Profile update attempt initiated', {
        userId,
        email: user.email,
        fieldsToUpdate: Object.keys(updateProfileData),
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        operation: 'update_profile_attempt'
      });

      const updatedUser = await this.authService.updateProfile(userId, updateProfileData);

      logger.info('Profile update completed successfully', {
        userId,
        email: user.email,
        updatedFields: Object.keys(updateProfileData),
        operation: 'update_profile_success'
      });
      
      logger.authEvent('profile_updated', {
        userId,
        email: user.email,
        success: true
      });

      res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        data: { user: updatedUser },
      });
    } catch (error) {
      const user = (req as any).user;
      
      logger.error('Profile update failed', error as Error, {
        userId: user?.id,
        email: user?.email,
        operation: 'update_profile_failed',
        errorMessage: error instanceof Error ? error.message : 'unknown_error'
      });
      
      logger.authEvent('profile_update_failed', {
        userId: user?.id || 'unknown',
        email: user?.email || 'unknown',
        success: false,
        reason: error instanceof Error ? error.message : 'unknown_error'
      });
      
      // Provide specific error status codes based on error type
      const isNotFoundError = error instanceof Error && 
        error.message.includes('not found');
      
      res.status(isNotFoundError ? 404 : 400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update profile',
      });
    }
  };

  refreshToken = async (req: Request, res: Response): Promise<void> => {
    try {
      const refreshTokenData: RefreshTokenDto = req.body;
      const result = await this.authService.refreshToken(refreshTokenData);

      res.status(200).json({
        success: true,
        message: 'Token refreshed successfully',
        data: result,
      });
    } catch (error) {
      res.status(401).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to refresh token',
      });
    }
  };

  changeEmail = async (req: Request, res: Response): Promise<void> => {
    const correlationId = (req as any).correlationId;
    const logger = authLogger.withCorrelationId(correlationId);
    
    try {
      const user = (req as any).user;
      const userId = user?.id;

      if (!userId) {
        logger.warn('Email change attempt without authentication', {
          ip: req.ip,
          userAgent: req.headers['user-agent'],
          operation: 'change_email'
        });
        
        res.status(401).json({
          success: false,
          message: 'User not authenticated',
        });
        return;
      }

      const changeEmailData: ChangeEmailDto = req.body;
      
      logger.info('Email change attempt initiated', {
        userId,
        currentEmail: user.email,
        newEmail: changeEmailData.newEmail,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        operation: 'change_email_attempt'
      });

      await this.authService.changeEmail(userId, changeEmailData);

      logger.info('Email change completed successfully', {
        userId,
        oldEmail: user.email,
        newEmail: changeEmailData.newEmail,
        operation: 'change_email_success'
      });
      
      logger.authEvent('email_changed', {
        userId,
        email: user.email,
        success: true
      });

      res.status(200).json({
        success: true,
        message: 'Email address updated successfully',
      });
    } catch (error) {
      const user = (req as any).user;
      
      logger.error('Email change failed', error as Error, {
        userId: user?.id,
        currentEmail: user?.email,
        requestedEmail: req.body?.newEmail,
        operation: 'change_email_failed',
        errorMessage: error instanceof Error ? error.message : 'unknown_error'
      });
      
      logger.authEvent('email_change_failed', {
        userId: user?.id || 'unknown',
        email: user?.email || 'unknown',
        success: false,
        reason: error instanceof Error ? error.message : 'unknown_error'
      });
      
      // Provide specific error status codes based on error type
      const isAuthError = error instanceof Error && 
        (error.message.includes('Current password is incorrect') || 
         error.message.includes('User not found'));
      
      const isConflictError = error instanceof Error && 
        error.message.includes('already in use');
      
      let statusCode = 400;
      if (isAuthError) statusCode = 401;
      else if (isConflictError) statusCode = 409;
      
      res.status(statusCode).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update email address',
      });
    }
  };
}