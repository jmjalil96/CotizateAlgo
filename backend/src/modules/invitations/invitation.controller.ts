import { Request, Response } from 'express';
import { InvitationService } from './invitation.service';
import { SendInvitationDto, AcceptInvitationDto } from './dto/invitation.dto';

export class InvitationController {
  private service: InvitationService = new InvitationService();

  send = async (req: Request, res: Response): Promise<void> => {
    try {
      const data: SendInvitationDto = req.body;
      const invitedBy = (req as any).user.id; // From auth middleware
      const result = await this.service.sendInvitation(data, invitedBy);
      res.status(200).json(result);
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to send invitation',
      });
    }
  };

  accept = async (req: Request, res: Response): Promise<void> => {
    try {
      const data: AcceptInvitationDto = req.body;
      const result = await this.service.acceptInvitation(data);
      res.status(201).json(result);
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to accept invitation',
      });
    }
  };
} 