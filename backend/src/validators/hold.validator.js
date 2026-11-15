import { z } from 'zod';

const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export const MAX_SEATS_PER_HOLD = 10;

export const createHoldSchema = z.object({
  showSeatIds: z
    .array(
      z
        .string({ required_error: 'Show seat ID is required' })
        .regex(uuidRegex, 'Invalid ShowSeat ID format')
    )
    .min(1, 'At least one seat must be selected to hold')
    .max(
      MAX_SEATS_PER_HOLD,
      `Cannot hold more than ${MAX_SEATS_PER_HOLD} seats in a single reservation`
    )
    .refine((ids) => new Set(ids).size === ids.length, {
      message: 'Duplicate seat IDs detected in hold request',
      path: ['showSeatIds'],
    }),
});
