import { z } from 'zod';

/**
 * Schema untuk create wallet
 */
export const createWalletSchema = z.object({
  name: z.string().min(1, 'Name is required').max(50, 'Name must be less than 50 characters'),
  icon: z.string().optional(),
  color: z.string().optional(),
  initialBalance: z.number().min(0, 'Initial balance cannot be negative').default(0),
  displayOrder: z.number().int().min(0).optional().default(0),
});

/**
 * Schema untuk update wallet
 */
export const updateWalletSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
  displayOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

/**
 * Schema untuk reorder wallet
 */
export const reorderWalletSchema = z.object({
  wallets: z.array(
    z.object({
      id: z.string(),
      displayOrder: z.number().int().min(0),
    })
  ),
});

export type CreateWalletInput = z.infer<typeof createWalletSchema>;
export type UpdateWalletInput = z.infer<typeof updateWalletSchema>;
export type ReorderWalletInput = z.infer<typeof reorderWalletSchema>;
