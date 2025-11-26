import { Hono } from 'hono';
import { eq, and, sum, sql, gte, lte } from 'drizzle-orm';
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
 * GET /api/statistics/monthly - Get monthly income vs expense statistics
 * Query params: year (default current year), months (default 6)
 */
app.get('/monthly', async (c) => {
  try {
    const firebaseUser = c.get('firebaseUser');
    const db = drizzle(c.env.DB, { schema });

    const year = parseInt(c.req.query('year') || new Date().getFullYear().toString());
    const monthsCount = parseInt(c.req.query('months') || '6');

    const monthlyStats = [];

    for (let i = monthsCount - 1; i >= 0; i--) {
      const date = new Date(year, new Date().getMonth() - i, 1);
      const startDate = new Date(date.getFullYear(), date.getMonth(), 1);
      const endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);

      // Get income for this month
      const incomeResult = await db
        .select({ total: sum(transaction.amount) })
        .from(transaction)
        .where(
          and(
            eq(transaction.userId, firebaseUser.uid),
            eq(transaction.type, 'income'),
            gte(transaction.transactionDate, startDate),
            lte(transaction.transactionDate, endDate)
          )
        );

      // Get expense for this month
      const expenseResult = await db
        .select({ total: sum(transaction.amount) })
        .from(transaction)
        .where(
          and(
            eq(transaction.userId, firebaseUser.uid),
            eq(transaction.type, 'expense'),
            gte(transaction.transactionDate, startDate),
            lte(transaction.transactionDate, endDate)
          )
        );

      const income = Number(incomeResult[0]?.total || 0);
      const expense = Number(expenseResult[0]?.total || 0);

      monthlyStats.push({
        month: date.toLocaleString('en-US', { month: 'short', year: 'numeric' }),
        year: date.getFullYear(),
        monthNumber: date.getMonth() + 1,
        income,
        expense,
        net: income - expense,
      });
    }

    return c.json(successResponse(monthlyStats));
  } catch (error) {
    console.error('Error fetching monthly statistics:', error);
    return c.json(errorResponse('INTERNAL_ERROR', 'Failed to fetch monthly statistics'), 500);
  }
});

/**
 * GET /api/statistics/category - Get breakdown by category
 * Query params: type (income|expense), start_date, end_date
 */
app.get('/category', async (c) => {
  try {
    const firebaseUser = c.get('firebaseUser');
    const db = drizzle(c.env.DB, { schema });

    const type = c.req.query('type') as 'income' | 'expense' | undefined;
    const startDate = c.req.query('start_date') ? new Date(c.req.query('start_date')!) : undefined;
    const endDate = c.req.query('end_date') ? new Date(c.req.query('end_date')!) : undefined;

    // Build where conditions
    const conditions = [eq(transaction.userId, firebaseUser.uid)];

    if (type) {
      conditions.push(eq(transaction.type, type));
    }

    if (startDate) {
      conditions.push(gte(transaction.transactionDate, startDate));
    }

    if (endDate) {
      conditions.push(lte(transaction.transactionDate, endDate));
    }

    // Get all transactions matching criteria
    const transactions = await db.query.transaction.findMany({
      where: and(...conditions),
      with: {
        category: {
          columns: {
            id: true,
            name: true,
            icon: true,
            type: true,
          },
        },
      },
    });

    // Group by category
    const categoryMap = new Map<string, any>();

    transactions.forEach((t) => {
      const categoryKey = t.categoryId?.toString() || 'uncategorized';
      const cat = t.category as any;
      const categoryName = cat ? cat.name : 'Uncategorized';

      if (!categoryMap.has(categoryKey)) {
        categoryMap.set(categoryKey, {
          categoryId: t.categoryId,
          categoryName,
          categoryIcon: cat ? cat.icon : undefined,
          type: t.type,
          totalAmount: 0,
          count: 0,
        });
      }

      const entry = categoryMap.get(categoryKey);
      entry.totalAmount += t.amount;
      entry.count += 1;
    });

    const categoryStats = Array.from(categoryMap.values()).sort(
      (a, b) => b.totalAmount - a.totalAmount
    );

    return c.json(successResponse(categoryStats));
  } catch (error) {
    console.error('Error fetching category statistics:', error);
    return c.json(errorResponse('INTERNAL_ERROR', 'Failed to fetch category statistics'), 500);
  }
});

/**
 * GET /api/statistics/wallet - Get balance and summary per wallet
 */
app.get('/wallet', async (c) => {
  try {
    const firebaseUser = c.get('firebaseUser');
    const db = drizzle(c.env.DB, { schema });

    const wallets = await db.query.wallet.findMany({
      where: and(eq(wallet.userId, firebaseUser.uid), eq(wallet.isActive, true)),
      orderBy: [wallet.displayOrder, wallet.createdAt],
    });

    const walletStats = await Promise.all(
      wallets.map(async (w) => {
        // Get income for this wallet
        const incomeResult = await db
          .select({ total: sum(transaction.amount) })
          .from(transaction)
          .where(and(eq(transaction.walletId, w.id), eq(transaction.type, 'income')));

        // Get expense for this wallet
        const expenseResult = await db
          .select({ total: sum(transaction.amount) })
          .from(transaction)
          .where(and(eq(transaction.walletId, w.id), eq(transaction.type, 'expense')));

        const income = Number(incomeResult[0]?.total || 0);
        const expense = Number(expenseResult[0]?.total || 0);

        return {
          id: w.id,
          name: w.name,
          color: w.color,
          initialBalance: w.initialBalance,
          currentBalance: w.currentBalance,
          totalIncome: income,
          totalExpense: expense,
          netChange: income - expense,
        };
      })
    );

    return c.json(successResponse(walletStats));
  } catch (error) {
    console.error('Error fetching wallet statistics:', error);
    return c.json(errorResponse('INTERNAL_ERROR', 'Failed to fetch wallet statistics'), 500);
  }
});

/**
 * GET /api/statistics/trends - Get income/expense trends for graphs
 * Query params: period (daily|weekly|monthly), days (default 30)
 */
app.get('/trends', async (c) => {
  try {
    const firebaseUser = c.get('firebaseUser');
    const db = drizzle(c.env.DB, { schema });

    const period = (c.req.query('period') || 'daily') as 'daily' | 'weekly' | 'monthly';
    const daysCount = parseInt(c.req.query('days') || '30');

    const trends = [];
    const now = new Date();

    for (let i = daysCount - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      const startDate = new Date(date);
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);

      // Get income for this day
      const incomeResult = await db
        .select({ total: sum(transaction.amount) })
        .from(transaction)
        .where(
          and(
            eq(transaction.userId, firebaseUser.uid),
            eq(transaction.type, 'income'),
            gte(transaction.transactionDate, startDate),
            lte(transaction.transactionDate, endDate)
          )
        );

      // Get expense for this day
      const expenseResult = await db
        .select({ total: sum(transaction.amount) })
        .from(transaction)
        .where(
          and(
            eq(transaction.userId, firebaseUser.uid),
            eq(transaction.type, 'expense'),
            gte(transaction.transactionDate, startDate),
            lte(transaction.transactionDate, endDate)
          )
        );

      const income = Number(incomeResult[0]?.total || 0);
      const expense = Number(expenseResult[0]?.total || 0);

      trends.push({
        date: date.toISOString().split('T')[0],
        income,
        expense,
        net: income - expense,
      });
    }

    return c.json(successResponse(trends));
  } catch (error) {
    console.error('Error fetching trends:', error);
    return c.json(errorResponse('INTERNAL_ERROR', 'Failed to fetch trends'), 500);
  }
});

export default app;
