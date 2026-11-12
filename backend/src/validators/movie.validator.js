import { z } from 'zod';

export const createMovieSchema = z.object({
  title: z
    .string({ required_error: 'Movie title is required' })
    .trim()
    .min(1, 'Title cannot be empty')
    .max(150, 'Title must not exceed 150 characters'),
  description: z
    .string({ required_error: 'Movie description is required' })
    .trim()
    .min(5, 'Description must be at least 5 characters'),
  duration: z
    .number({ required_error: 'Duration in minutes is required' })
    .int('Duration must be a whole number')
    .min(15, 'Duration must be at least 15 minutes')
    .max(360, 'Duration cannot exceed 360 minutes'),
  language: z
    .string({ required_error: 'Language is required' })
    .trim()
    .min(2, 'Language must be at least 2 characters')
    .max(50, 'Language must not exceed 50 characters'),
  releaseDate: z
    .string()
    .optional()
    .nullable()
    .refine((val) => !val || !isNaN(Date.parse(val)), {
      message: 'Invalid release date format',
    }),
  posterUrl: z
    .string()
    .optional()
    .nullable()
    .refine((val) => !val || val.startsWith('http://') || val.startsWith('https://') || val.startsWith('/'), {
      message: 'Poster URL must be a valid HTTP(S) URL or relative path',
    }),
  rating: z
    .string()
    .trim()
    .max(10, 'Rating code must not exceed 10 characters')
    .optional()
    .nullable(),
  genreIds: z
    .array(z.string().min(1, 'Invalid genre ID'), {
      required_error: 'At least one genre must be selected',
    })
    .min(1, 'At least one genre must be associated with the movie'),
});

export const updateMovieSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Title cannot be empty')
    .max(150, 'Title must not exceed 150 characters')
    .optional(),
  description: z
    .string()
    .trim()
    .min(5, 'Description must be at least 5 characters')
    .optional(),
  duration: z
    .number()
    .int('Duration must be a whole number')
    .min(15, 'Duration must be at least 15 minutes')
    .max(360, 'Duration cannot exceed 360 minutes')
    .optional(),
  language: z
    .string()
    .trim()
    .min(2, 'Language must be at least 2 characters')
    .max(50, 'Language must not exceed 50 characters')
    .optional(),
  releaseDate: z
    .string()
    .optional()
    .nullable()
    .refine((val) => !val || !isNaN(Date.parse(val)), {
      message: 'Invalid release date format',
    }),
  posterUrl: z
    .string()
    .optional()
    .nullable()
    .refine((val) => !val || val.startsWith('http://') || val.startsWith('https://') || val.startsWith('/'), {
      message: 'Poster URL must be a valid HTTP(S) URL or relative path',
    }),
  rating: z
    .string()
    .trim()
    .max(10, 'Rating code must not exceed 10 characters')
    .optional()
    .nullable(),
  genreIds: z
    .array(z.string().min(1, 'Invalid genre ID'))
    .min(1, 'At least one genre must be associated with the movie')
    .optional(),
});

export const movieStatusSchema = z.object({
  isActive: z.boolean({ required_error: 'isActive status boolean is required' }),
});

