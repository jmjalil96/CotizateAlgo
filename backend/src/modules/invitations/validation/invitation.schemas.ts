import Joi from 'joi';

export const sendInvitationSchema = Joi.object({
  email: Joi.string().email().required(),
  brokerId: Joi.string().required(),
});

export const acceptInvitationSchema = Joi.object({
  token: Joi.string().required(),
  password: Joi.string().min(8).required(),
  firstName: Joi.string().required(),
  lastName: Joi.string().required(),
  cedulaRuc: Joi.string().required(),
  phone: Joi.string().optional().allow(''),
}); 