import { z } from 'zod';

const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export const validateTicketSchema = z.object({
  qrToken: z
    .string({ required_error: 'QR verification token is required' })
    .trim()
    .min(10, 'QR verification token is too short to be valid')
    .max(256, 'QR verification token exceeds maximum length'),
});

export const ticketIdParamSchema = z.object({
  id: z
    .string({ required_error: 'Ticket ID is required' })
    .regex(uuidRegex, 'Invalid ticket ID format'),
});
