import { z } from 'zod';

/**
 * Schema untuk create transfer
 */
export const createTransferSchema = z.object({
  fromWalletId: z.string().min(1, 'From wallet ID is required'),
  toWalletId: z.string().min(1, 'To wallet ID is required'),
  amount: z.number().positive('Amount must be greater than 0'),
  fee: z.number().min(0, 'Fee cannot be negative').default(0),
  description: z.string().optional(),
  transferDate: z.coerce.date(),
});

/**
 * Schema untuk query parameters list transfer
 */
export const listTransferQuerySchema = z.object({
  wallet_id: z.string().optional(),
  start_date: z.coerce.date().optional(),
  end_date: z.coerce.date().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type CreateTransferInput = z.infer<typeof createTransferSchema>;
export type ListTransferQuery = z.infer<typeof listTransferQuerySchema>;
