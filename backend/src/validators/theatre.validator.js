import { z } from 'zod';

export const createTheatreSchema = z.object({
  name: z
    .string({ required_error: 'Theatre name is required' })
    .trim()
    .min(2, 'Theatre name must be at least 2 characters')
    .max(100, 'Theatre name must not exceed 100 characters'),
  location: z
    .string({ required_error: 'Location is required' })
    .trim()
    .min(3, 'Location must be at least 3 characters')
    .max(200, 'Location must not exceed 200 characters'),
  city: z
    .string({ required_error: 'City is required' })
    .trim()
    .min(2, 'City must be at least 2 characters')
    .max(100, 'City must not exceed 100 characters'),
  address: z
    .string()
    .trim()
    .max(300, 'Address must not exceed 300 characters')
    .optional()
    .nullable(),
});

export const updateTheatreSchema = createTheatreSchema.partial();

export const theatreStatusSchema = z.object({
  isActive: z.boolean({ required_error: 'isActive status boolean is required' }),
});

export const theatreQuerySchema = z.object({
  search: z.string().trim().optional(),
  city: z.string().trim().optional(),
  includeInactive: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((val) => val === true || val === 'true'),
});

