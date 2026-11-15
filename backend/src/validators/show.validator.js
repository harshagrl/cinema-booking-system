import { z } from 'zod';

export const categoryPricingSchema = z.object({
  REGULAR: z.number().min(1, 'Price must be greater than 0').max(10000).optional(),
  SILVER: z.number().min(1, 'Price must be greater than 0').max(10000).optional(),
  GOLD: z.number().min(1, 'Price must be greater than 0').max(10000).optional(),
  PREMIUM: z.number().min(1, 'Price must be greater than 0').max(10000).optional(),
  RECLINER: z.number().min(1, 'Price must be greater than 0').max(10000).optional(),
});

const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export const createShowSchema = z.object({
  movieId: z
    .string({ required_error: 'Movie ID is required' })
    .regex(uuidRegex, 'Invalid movie ID format'),
  screenId: z
    .string({ required_error: 'Screen ID is required' })
    .regex(uuidRegex, 'Invalid screen ID format'),
  startTime: z
    .string({ required_error: 'Start time is required' })
    .datetime({ message: 'Start time must be a valid ISO-8601 datetime string' }),
  endTime: z
    .string()
    .datetime({ message: 'End time must be a valid ISO-8601 datetime string' })
    .optional(),
  format: z
    .string({ required_error: 'Show format is required' })
    .trim()
    .min(1, 'Format cannot be empty')
    .max(20, 'Format cannot exceed 20 characters'),
  bufferMinutes: z
    .number()
    .int('Buffer minutes must be an integer')
    .min(0, 'Buffer minutes cannot be negative')
    .max(180, 'Buffer minutes cannot exceed 180')
    .optional()
    .default(15),
  pricing: categoryPricingSchema.optional(),
});

export const updateShowSchema = z.object({
  startTime: z
    .string()
    .datetime({ message: 'Start time must be a valid ISO-8601 datetime string' })
    .optional(),
  endTime: z
    .string()
    .datetime({ message: 'End time must be a valid ISO-8601 datetime string' })
    .optional(),
  format: z
    .string()
    .trim()
    .min(1)
    .max(20)
    .optional(),
  bufferMinutes: z
    .number()
    .int()
    .min(0)
    .max(180)
    .optional(),
  pricing: categoryPricingSchema.optional(),
  isActive: z.boolean().optional(),
});

export const showStatusSchema = z.object({
  isActive: z.boolean({ required_error: 'isActive status boolean is required' }),
});

export const showQuerySchema = z.object({
  movieId: z.string().regex(uuidRegex, 'Invalid movie ID format').optional(),
  theatreId: z.string().regex(uuidRegex, 'Invalid theatre ID format').optional(),
  screenId: z.string().regex(uuidRegex, 'Invalid screen ID format').optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be formatted as YYYY-MM-DD')
    .optional(),
  city: z.string().trim().optional(),
  format: z.string().trim().optional(),
  includeInactive: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((val) => val === true || val === 'true'),
});
