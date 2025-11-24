 import { Hono } from 'hono';
import { eq, sum, desc, and } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../db/schema';
import { wallet, transaction } from '../db/schema';
import { requireFirebaseAuth } from '../lib/firebase/middleware';
import { errorResponse, successResponse } from '../lib/utils';
import { FirebaseUser } from '../db/types';

type AppContext = {
  Bindings: CloudflareBindings;
  Variables: {
    firebaseUser: FirebaseUser;
  };
};

const app = new Hono<AppContext>();

// All routes require authentication
app.use('*', requireFirebaseAuth);

/**
 * GET /api/dashboard - Get dashboard summary
 * Returns: total_balance, total_income, total_expense, wallet_summary, recent_transactions
 */
app.get('/', async (c) => {
  try {
    const firebaseUser = c.get('firebaseUser');
    const db = drizzle(c.env.DB, { schema });

    // 1. Get all active wallets
    const wallets = await db.query.wallet.findMany({
      where: eq(wallet.userId, firebaseUser.uid),
      orderBy: [wallet.displayOrder, wallet.createdAt],
    });

    const activeWallets = wallets.filter((w) => w.isActive);

    // 2. Calculate total balance from all active wallets
    const totalBalance = activeWallets.reduce((sum, w) => sum + w.currentBalance, 0);

    // 3. Get total income
    const incomeResult = await db
      .select({ total: sum(transaction.amount) })
      .from(transaction)
      .where(
        and(
          eq(transaction.userId, firebaseUser.uid),
          eq(transaction.type, 'income')
        )
      );

    const totalIncome = Number(incomeResult[0]?.total || 0);

    // 4. Get total expense
    const expenseResult = await db
      .select({ total: sum(transaction.amount) })
      .from(transaction)
      .where(
        and(
          eq(transaction.userId, firebaseUser.uid),
          eq(transaction.type, 'expense')
        )
      );

    const totalExpense = Number(expenseResult[0]?.total || 0);

    // 5. Get recent transactions (last 10)
    const recentTransactions = await db.query.transaction.findMany({
      where: eq(transaction.userId, firebaseUser.uid),
      orderBy: [desc(transaction.transactionDate), desc(transaction.createdAt)],
      limit: 10,
      with: {
        wallet: {
          columns: {
            id: true,
            name: true,
            color: true,
          },
        },
        category: {
          columns: {
            id: true,
            name: true,
            icon: true,
            color: true,
          },
        },
      },
    });

    // 6. Build wallet summary
    const walletSummary = activeWallets.map((w) => ({
      id: w.id,
      name: w.name,
      color: w.color,
      currentBalance: w.currentBalance,
      displayOrder: w.displayOrder,
    }));

    return c.json(
      successResponse({
        summary: {
          totalBalance,
          totalIncome,
          totalExpense,
          netIncome: totalIncome - totalExpense,
        },
        wallets: walletSummary,
        recentTransactions,
      })
    );
  } catch (error) {
    console.error('Error fetching dashboard:', error);
    return c.json(errorResponse('INTERNAL_ERROR', 'Failed to fetch dashboard data'), 500);
  }
});

export default app;
