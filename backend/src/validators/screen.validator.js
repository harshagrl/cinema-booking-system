import { z } from 'zod';

export const createScreenSchema = z.object({
  name: z
    .string({ required_error: 'Screen name is required' })
    .trim()
    .min(1, 'Screen name must be at least 1 character')
    .max(50, 'Screen name must not exceed 50 characters'),
  screenType: z
    .string()
    .trim()
    .min(1, 'Screen type cannot be empty')
    .max(30, 'Screen type cannot exceed 30 characters')
    .default('STANDARD'),
  supportedFormats: z
    .array(
      z
        .string()
        .trim()
        .min(1, 'Format name cannot be empty')
        .max(20, 'Format name cannot exceed 20 characters')
    )
    .min(1, 'At least one supported format is required')
    .default(['2D', '3D']),
  capacity: z
    .number()
    .int('Capacity must be an integer')
    .min(0, 'Capacity cannot be negative')
    .optional()
    .default(0),
});

export const updateScreenSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Screen name must be at least 1 character')
    .max(50, 'Screen name must not exceed 50 characters')
    .optional(),
  screenType: z
    .string()
    .trim()
    .min(1, 'Screen type cannot be empty')
    .max(30, 'Screen type cannot exceed 30 characters')
    .optional(),
  supportedFormats: z
    .array(
      z
        .string()
        .trim()
        .min(1, 'Format name cannot be empty')
        .max(20, 'Format name cannot exceed 20 characters')
    )
    .min(1, 'At least one supported format is required')
    .optional(),
  capacity: z
    .number()
    .int('Capacity must be an integer')
    .min(0, 'Capacity cannot be negative')
    .optional(),
});

export const screenStatusSchema = z.object({
  isActive: z.boolean({ required_error: 'isActive status boolean is required' }),
});

