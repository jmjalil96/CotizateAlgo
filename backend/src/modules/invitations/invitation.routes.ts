import { Router } from 'express';
import { InvitationController } from './invitation.controller';
import { authMiddleware } from '../../common/middlewares/auth.middleware';
import { validateRequest } from '../../common/middlewares/validation.middleware';
import { sendInvitationSchema, acceptInvitationSchema } from './validation/invitation.schemas';

const router = Router();
const controller = new InvitationController();

// Protected: Only authenticated users can send invites
router.post('/send', authMiddleware, validateRequest(sendInvitationSchema), controller.send);

// Public: Accept invite
router.post('/accept', validateRequest(acceptInvitationSchema), controller.accept);

export default router; 