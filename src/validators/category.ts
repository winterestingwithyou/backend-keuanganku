import { z } from 'zod';

/**
 * Schema untuk create category
 */
export const createCategorySchema = z.object({
  name: z.string().min(1, 'Name is required').max(50, 'Name must be less than 50 characters'),
  type: z.enum(['income', 'expense'], {
    message: 'Type must be either income or expense',
  }),
  icon: z.string().optional(),
});

/**
 * Schema untuk update category
 */
export const updateCategorySchema = z.object({
  name: z.string().min(1).max(50).optional(),
  icon: z.string().optional(),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
