import { z } from 'zod';

export const createGenreSchema = z.object({
  name: z
    .string({ required_error: 'Genre name is required' })
    .trim()
    .min(2, 'Genre name must be at least 2 characters')
    .max(50, 'Genre name must not exceed 50 characters'),
});

export const updateGenreSchema = z.object({
  name: z
    .string({ required_error: 'Genre name is required' })
    .trim()
    .min(2, 'Genre name must be at least 2 characters')
    .max(50, 'Genre name must not exceed 50 characters'),
});

