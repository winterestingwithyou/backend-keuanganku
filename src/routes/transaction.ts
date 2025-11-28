import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq, and, desc, gte, lte, count } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../db/schema';
import { transaction, wallet } from '../db/schema';
import { requireFirebaseAuth } from '../lib/firebase/middleware';
import {
  createTransactionSchema,
  updateTransactionSchema,
  listTransactionQuerySchema,
} from '../validators/transaction';
import {
  errorResponse,
  successResponse,
  validateWalletOwnership,
  updateWalletBalance,
  getPaginationParams,
  paginationMeta,
} from '../lib/utils';
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
 * GET /api/transaction - List transactions with filters
 */
app.get('/', zValidator('query', listTransactionQuerySchema), async (c) => {
  try {
    const firebaseUser = c.get('firebaseUser');
    const db = drizzle(c.env.DB, { schema });
    const query = c.req.valid('query');

    const { offset, limit } = getPaginationParams(query.page, query.limit);

    // Build where conditions
    const conditions = [eq(transaction.userId, firebaseUser.uid)];

    if (query.wallet_id) {
      conditions.push(eq(transaction.walletId, query.wallet_id));
    }


    if (query.category_id) {
      conditions.push(eq(transaction.categoryId, query.category_id));
    }

    if (query.start_date) {
      conditions.push(gte(transaction.transactionDate, query.start_date));
    }

    if (query.end_date) {
      conditions.push(lte(transaction.transactionDate, query.end_date));
    }

    // Get transactions with pagination
    const transactions = await db.query.transaction.findMany({
      where: and(...conditions),
      orderBy: [desc(transaction.transactionDate), desc(transaction.createdAt)],
      limit: limit,
      offset: offset,
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
          },
        },
      },
    });

    // Get total count
    const totalResult = await db
      .select({ count: count() })
      .from(transaction)
      .where(and(...conditions));

    const total = totalResult[0]?.count || 0;

    return c.json(
      successResponse(transactions, paginationMeta(query.page, query.limit, total))
    );
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return c.json(errorResponse('INTERNAL_ERROR', 'Failed to fetch transactions'), 500);
  }
});

/**
 * GET /api/transaction/recent - Get recent transactions for dashboard
 */
app.get('/recent', async (c) => {
  try {
    const firebaseUser = c.get('firebaseUser');
    const db = drizzle(c.env.DB, { schema });

    const transactions = await db.query.transaction.findMany({
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
          },
        },
      },
    });

    return c.json(successResponse(transactions));
  } catch (error) {
    console.error('Error fetching recent transactions:', error);
    return c.json(errorResponse('INTERNAL_ERROR', 'Failed to fetch recent transactions'), 500);
  }
});

/**
 * POST /api/transaction - Create new transaction
 */
app.post('/', zValidator('json', createTransactionSchema), async (c) => {
  try {
    const firebaseUser = c.get('firebaseUser');
    const db = drizzle(c.env.DB, { schema });
    const data = c.req.valid('json');

    // Validate wallet ownership
    const isOwner = await validateWalletOwnership(db, data.walletId, firebaseUser.uid);
    if (!isOwner) {
      return c.json(errorResponse('NOT_FOUND', 'Wallet not found'), 404);
    }

    // Create transaction
    const newTransaction = await db
      .insert(transaction)
      .values({
        userId: firebaseUser.uid,
        walletId: data.walletId,
        categoryId: data.categoryId,
        amount: data.amount,
        description: data.description,
        notes: data.notes,
        transactionDate: data.transactionDate,
      })
      .returning();

    // Update wallet balance
    await updateWalletBalance(db, data.walletId);

    return c.json(successResponse(newTransaction[0]), 201);
  } catch (error) {
    console.error('Error creating transaction:', error);
    return c.json(errorResponse('INTERNAL_ERROR', 'Failed to create transaction'), 500);
  }
});

/**
 * GET /api/transaction/:id - Get transaction detail
 */
app.get('/:id', async (c) => {
  try {
    const firebaseUser = c.get('firebaseUser');
    const db = drizzle(c.env.DB, { schema });
    const transactionId = Number(c.req.param('id'));

    if (isNaN(transactionId)) {
      return c.json(errorResponse('VALIDATION_ERROR', 'Invalid transaction ID'), 400);
    }

    const transactionData = await db.query.transaction.findFirst({
      where: and(eq(transaction.id, transactionId), eq(transaction.userId, firebaseUser.uid)),
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
          },
        },
      },
    });

    if (!transactionData) {
      return c.json(errorResponse('NOT_FOUND', 'Transaction not found'), 404);
    }

    return c.json(successResponse(transactionData));
  } catch (error) {
    console.error('Error fetching transaction:', error);
    return c.json(errorResponse('INTERNAL_ERROR', 'Failed to fetch transaction'), 500);
  }
});

/**
 * PUT /api/transaction/:id - Update transaction
 */
app.put('/:id', zValidator('json', updateTransactionSchema), async (c) => {
  try {
    const firebaseUser = c.get('firebaseUser');
    const db = drizzle(c.env.DB, { schema });
    const transactionId = Number(c.req.param('id'));
    const data = c.req.valid('json');

    if (isNaN(transactionId)) {
      return c.json(errorResponse('VALIDATION_ERROR', 'Invalid transaction ID'), 400);
    }

    // Get existing transaction
    const existingTransaction = await db.query.transaction.findFirst({
      where: and(eq(transaction.id, transactionId), eq(transaction.userId, firebaseUser.uid)),
    });

    if (!existingTransaction) {
      return c.json(errorResponse('NOT_FOUND', 'Transaction not found'), 404);
    }

    // If wallet is changing, validate new wallet ownership
    if (data.walletId && data.walletId !== existingTransaction.walletId) {
      const isOwner = await validateWalletOwnership(db, data.walletId, firebaseUser.uid);
      if (!isOwner) {
        return c.json(errorResponse('NOT_FOUND', 'New wallet not found'), 404);
      }
    }

    // Update transaction
    const updatedTransaction = await db
      .update(transaction)
      .set(data)
      .where(eq(transaction.id, transactionId))
      .returning();

    // Update wallet balance for old wallet
    await updateWalletBalance(db, existingTransaction.walletId);

    // Update wallet balance for new wallet if changed
    if (data.walletId && data.walletId !== existingTransaction.walletId) {
      await updateWalletBalance(db, data.walletId);
    }

    return c.json(successResponse(updatedTransaction[0]));
  } catch (error) {
    console.error('Error updating transaction:', error);
    return c.json(errorResponse('INTERNAL_ERROR', 'Failed to update transaction'), 500);
  }
});

/**
 * DELETE /api/transaction/:id - Delete transaction
 */
app.delete('/:id', async (c) => {
  try {
    const firebaseUser = c.get('firebaseUser');
    const db = drizzle(c.env.DB, { schema });
    const transactionId = Number(c.req.param('id'));

    if (isNaN(transactionId)) {
      return c.json(errorResponse('VALIDATION_ERROR', 'Invalid transaction ID'), 400);
    }

    // Get existing transaction
    const existingTransaction = await db.query.transaction.findFirst({
      where: and(eq(transaction.id, transactionId), eq(transaction.userId, firebaseUser.uid)),
    });

    if (!existingTransaction) {
      return c.json(errorResponse('NOT_FOUND', 'Transaction not found'), 404);
    }

    // Delete transaction
    await db.delete(transaction).where(eq(transaction.id, transactionId));

    // Update wallet balance
    await updateWalletBalance(db, existingTransaction.walletId);

    return c.json(successResponse({ message: 'Transaction deleted successfully' }));
  } catch (error) {
    console.error('Error deleting transaction:', error);
    return c.json(errorResponse('INTERNAL_ERROR', 'Failed to delete transaction'), 500);
  }
});

export default app;
