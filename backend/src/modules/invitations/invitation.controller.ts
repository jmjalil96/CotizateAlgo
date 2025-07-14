import { Request, Response } from 'express';
import { InvitationService } from './invitation.service';
import { SendInvitationDto, AcceptInvitationDto } from './dto/invitation.dto';

export class InvitationController {
  private service: InvitationService = new InvitationService();

  async send(req: Request, res: Response) {
    const data: SendInvitationDto = req.body;
    const invitedBy = (req as any).user.id; // From auth middleware
    const result = await this.service.sendInvitation(data, invitedBy);
    res.status(200).json(result);
  }

  async accept(req: Request, res: Response) {
    const data: AcceptInvitationDto = req.body;
    const result = await this.service.acceptInvitation(data);
    res.status(200).json(result);
  }
} 