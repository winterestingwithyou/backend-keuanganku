import { z } from 'zod';

/**
 * Schema untuk create transaction
 */
export const createTransactionSchema = z.object({
  walletId: z.number().int().positive('Wallet ID is required'),
  categoryId: z.number().int().positive().optional(),
  type: z.enum(['income', 'expense'], {
    message: 'Type must be either income or expense',
  }),
  amount: z.number().positive('Amount must be greater than 0'),
  description: z.string().optional(),
  notes: z.string().optional(),
  transactionDate: z.coerce.date(),
});

/**
 * Schema untuk update transaction
 */
export const updateTransactionSchema = z.object({
  walletId: z.number().int().positive().optional(),
  categoryId: z.number().int().positive().optional(),
  type: z.enum(['income', 'expense']).optional(),
  amount: z.number().positive().optional(),
  description: z.string().optional(),
  notes: z.string().optional(),
  transactionDate: z.coerce.date().optional(),
});

/**
 * Schema untuk query parameters list transaction
 */
export const listTransactionQuerySchema = z.object({
  wallet_id: z.coerce.number().int().positive().optional(),
  type: z.enum(['income', 'expense']).optional(),
  category_id: z.coerce.number().int().positive().optional(),
  start_date: z.coerce.date().optional(),
  end_date: z.coerce.date().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
export type ListTransactionQuery = z.infer<typeof listTransactionQuerySchema>;
