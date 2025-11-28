import { DrizzleD1Database } from 'drizzle-orm/d1';
import { eq, and, sum, sql } from 'drizzle-orm';
import * as schema from '../db/schema';
import { wallet, transaction, transfer } from '../db/schema';

/**
 * Recalculate wallet balance dari transaction & transfer
 *
 * Formula: initial_balance + SUM(income) - SUM(expense) + transfer_in - transfer_out - transfer_fees
 */
export async function recalculateWalletBalance(
  db: DrizzleD1Database<typeof schema>,
  walletId: number
): Promise<number> {
  // Get wallet initial balance
  const walletData = await db.query.wallet.findFirst({
    where: eq(wallet.id, walletId),
  });

  if (!walletData) {
    throw new Error('Wallet not found');
  }

  let balance = walletData.initialBalance;

  // Sum all income transactions (join with category to get type)
  const incomeResult = await db
    .select({ total: sum(transaction.amount) })
    .from(transaction)
    .innerJoin(schema.category, eq(transaction.categoryId, schema.category.id))
    .where(
      and(
        eq(transaction.walletId, walletId),
        eq(schema.category.type, 'income')
      )
    );

  const totalIncome = Number(incomeResult[0]?.total || 0);

  // Sum all expense transactions (join with category to get type)
  const expenseResult = await db
    .select({ total: sum(transaction.amount) })
    .from(transaction)
    .innerJoin(schema.category, eq(transaction.categoryId, schema.category.id))
    .where(
      and(
        eq(transaction.walletId, walletId),
        eq(schema.category.type, 'expense')
      )
    );

  const totalExpense = Number(expenseResult[0]?.total || 0);

  // Sum all transfers in (to this wallet)
  const transferInResult = await db
    .select({ total: sum(transfer.amount) })
    .from(transfer)
    .where(eq(transfer.toWalletId, walletId));

  const totalTransferIn = Number(transferInResult[0]?.total || 0);

  // Sum all transfers out (from this wallet) including fees
  const transferOutResult = await db
    .select({
      totalAmount: sum(transfer.amount),
      totalFee: sum(transfer.fee),
    })
    .from(transfer)
    .where(eq(transfer.fromWalletId, walletId));

  const totalTransferOut = Number(transferOutResult[0]?.totalAmount || 0);
  const totalTransferFee = Number(transferOutResult[0]?.totalFee || 0);

  // Calculate final balance
  balance = balance + totalIncome - totalExpense + totalTransferIn - totalTransferOut - totalTransferFee;

  return balance;
}

/**
 * Validate wallet ownership
 */
export async function validateWalletOwnership(
  db: DrizzleD1Database<typeof schema>,
  walletId: number,
  userId: string
): Promise<boolean> {
  const walletData = await db.query.wallet.findFirst({
    where: and(
      eq(wallet.id, walletId),
      eq(wallet.userId, userId)
    ),
  });

  return !!walletData;
}

/**
 * Get date range for statistics
 */
export function getDateRange(period: 'daily' | 'weekly' | 'monthly' | 'yearly'): { start: Date; end: Date } {
  const end = new Date();
  const start = new Date();

  switch (period) {
    case 'daily':
      start.setHours(0, 0, 0, 0);
      break;
    case 'weekly':
      start.setDate(start.getDate() - 7);
      start.setHours(0, 0, 0, 0);
      break;
    case 'monthly':
      start.setMonth(start.getMonth() - 1);
      start.setHours(0, 0, 0, 0);
      break;
    case 'yearly':
      start.setFullYear(start.getFullYear() - 1);
      start.setHours(0, 0, 0, 0);
      break;
  }

  return { start, end };
}

/**
 * Format currency for response
 */
export function formatCurrency(amount: number, currency: string = 'IDR'): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: currency,
  }).format(amount);
}

/**
 * Validate transfer between wallets
 */
export async function validateTransfer(
  db: DrizzleD1Database<typeof schema>,
  fromWalletId: number,
  toWalletId: number,
  amount: number,
  userId: string,
  fee: number = 0
): Promise<{ valid: boolean; error?: string }> {
  // Check if wallets are the same
  if (fromWalletId === toWalletId) {
    return { valid: false, error: 'Cannot transfer to the same wallet' };
  }

  // Check amount is positive
  if (amount <= 0) {
    return { valid: false, error: 'Amount must be greater than 0' };
  }

  // Check fee is not negative
  if (fee < 0) {
    return { valid: false, error: 'Fee cannot be negative' };
  }

  // Validate from wallet ownership
  const fromWallet = await db.query.wallet.findFirst({
    where: and(
      eq(wallet.id, fromWalletId),
      eq(wallet.userId, userId),
      eq(wallet.isActive, true)
    ),
  });

  if (!fromWallet) {
    return { valid: false, error: 'Source wallet not found or not active' };
  }

  // Validate to wallet ownership
  const toWallet = await db.query.wallet.findFirst({
    where: and(
      eq(wallet.id, toWalletId),
      eq(wallet.userId, userId),
      eq(wallet.isActive, true)
    ),
  });

  if (!toWallet) {
    return { valid: false, error: 'Destination wallet not found or not active' };
  }

  // Check sufficient balance
  if (fromWallet.currentBalance < amount + fee) {
    return {
      valid: false,
      error: `Insufficient balance. Current: ${formatCurrency(fromWallet.currentBalance)}, Required: ${formatCurrency(amount + fee)}`,
    };
  }

  return { valid: true };
}

/**
 * Update wallet balance (untuk dipanggil setelah transaction/transfer)
 */
export async function updateWalletBalance(
  db: DrizzleD1Database<typeof schema>,
  walletId: number
): Promise<void> {
  const newBalance = await recalculateWalletBalance(db, walletId);

  await db
    .update(wallet)
    .set({ currentBalance: newBalance })
    .where(eq(wallet.id, walletId));
}

/**
 * Standard error response formatter
 */
export function errorResponse(
  code: 'VALIDATION_ERROR' | 'NOT_FOUND' | 'UNAUTHORIZED' | 'INSUFFICIENT_BALANCE' | 'DUPLICATE_ENTRY' | 'INTERNAL_ERROR',
  message: string,
  details?: any
) {
  return {
    success: false,
    error: {
      code,
      message,
      ...(details && { details }),
    },
  };
}

/**
 * Standard success response formatter
 */
export function successResponse(data: any, meta?: any) {
  return {
    success: true,
    data,
    ...(meta && { meta }),
  };
}

/**
 * Pagination helper
 */
export function getPaginationParams(page: number = 1, limit: number = 20) {
  const offset = (page - 1) * limit;
  return { offset, limit };
}

/**
 * Calculate pagination metadata
 */
export function paginationMeta(page: number, limit: number, total: number) {
  return {
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    timestamp: new Date().toISOString(),
  };
}
