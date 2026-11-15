import { z } from 'zod';

const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export const createBookingSchema = z.object({
  holdId: z
    .string({ required_error: 'Hold ID is required to create a booking' })
    .regex(uuidRegex, 'Invalid hold ID format'),
  idempotencyKey: z
    .string()
    .trim()
    .min(1, 'Idempotency key cannot be empty')
    .max(100, 'Idempotency key cannot exceed 100 characters')
    .optional(),
});

export const simulatePaymentSchema = z.object({
  paymentMethod: z
    .enum(['CARD', 'UPI', 'NET_BANKING'], {
      errorMap: () => ({ message: 'Payment method must be CARD, UPI, or NET_BANKING' }),
    })
    .default('CARD'),
  simulateResult: z
    .enum(['SUCCESS', 'FAILURE'], {
      errorMap: () => ({ message: 'Simulation result must be SUCCESS or FAILURE' }),
    })
    .default('SUCCESS'),
  idempotencyKey: z
    .string()
    .trim()
    .min(1, 'Idempotency key cannot be empty')
    .max(100, 'Idempotency key cannot exceed 100 characters')
    .optional(),
});

export const bookingIdParamSchema = z.object({
  id: z
    .string({ required_error: 'Booking ID is required' })
    .regex(uuidRegex, 'Invalid Booking ID format'),
});
