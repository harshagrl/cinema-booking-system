import { z } from 'zod';

export const SeatCategoryEnum = z.enum(['SILVER', 'GOLD', 'PREMIUM', 'REGULAR', 'RECLINER']);

export const seatItemSchema = z.object({
  row: z
    .string({ required_error: 'Seat row is required' })
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{1,3}$/, 'Row must be 1 to 3 uppercase letters (e.g. A, B, AA)'),
  seatNumber: z
    .number({ required_error: 'Seat number is required' })
    .int('Seat number must be an integer')
    .min(1, 'Seat number must be at least 1')
    .max(100, 'Seat number cannot exceed 100'),
  category: SeatCategoryEnum,
  isActive: z.boolean().optional().default(true),
});

export const bulkConfigureSeatsSchema = z
  .object({
    seats: z
      .array(seatItemSchema)
      .min(1, 'At least one seat must be configured')
      .max(1000, 'Cannot configure more than 1000 seats at once'),
  })
  .refine(
    (data) => {
      const seen = new Set();
      for (const seat of data.seats) {
        const key = `${seat.row}-${seat.seatNumber}`;
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
      }
      return true;
    },
    {
      message: 'Duplicate seat coordinates detected in layout configuration',
      path: ['seats'],
    }
  );

export const updateSeatItemSchema = z.object({
  id: z.string().uuid().optional(),
  row: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{1,3}$/, 'Row must be 1 to 3 uppercase letters')
    .optional(),
  seatNumber: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional(),
  category: SeatCategoryEnum.optional(),
  isActive: z.boolean().optional(),
});

export const bulkUpdateSeatsSchema = z.object({
  seats: z
    .array(updateSeatItemSchema)
    .min(1, 'At least one seat update is required'),
});

