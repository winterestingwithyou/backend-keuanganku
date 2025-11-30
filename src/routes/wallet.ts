import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq, and, desc, sum } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../db/schema';
import { wallet } from '../db/schema';
import { requireFirebaseAuth } from '../lib/firebase/middleware';
import { createWalletSchema, updateWalletSchema, reorderWalletSchema } from '../validators/wallet';
import { errorResponse, successResponse, validateWalletOwnership, formatDate } from '../lib/utils';
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
 * GET /api/wallet - List all wallets for current user
 */
app.get('/', async (c) => {
  try {
    const firebaseUser = c.get('firebaseUser');
    const db = drizzle(c.env.DB, { schema });

    const wallets = await db.query.wallet.findMany({
      where: and(
        eq(wallet.userId, firebaseUser.uid),
        eq(wallet.isActive, true)
      ),
      orderBy: [wallet.displayOrder, wallet.createdAt],
    });

    return c.json(successResponse(wallets));
  } catch (error) {
    console.error('Error fetching wallets:', error);
    return c.json(errorResponse('INTERNAL_ERROR', 'Failed to fetch wallets'), 500);
  }
});

/**
 * POST /api/wallet - Create new wallet
 */
app.post('/', zValidator('json', createWalletSchema), async (c) => {
  try {
    const firebaseUser = c.get('firebaseUser');
    const db = drizzle(c.env.DB, { schema });
    const data = c.req.valid('json');

    // Check for duplicate wallet name
    const existingWallet = await db.query.wallet.findFirst({
      where: and(
        eq(wallet.userId, firebaseUser.uid),
        eq(wallet.name, data.name),
        eq(wallet.isActive, true)
      ),
    });

    if (existingWallet) {
      return c.json(
        errorResponse('DUPLICATE_ENTRY', 'Wallet with this name already exists'),
        400
      );
    }

    // Create wallet
    const newWallet = await db.insert(wallet).values({
      userId: firebaseUser.uid,
      name: data.name,
      color: data.color,
      initialBalance: data.initialBalance,
      currentBalance: data.initialBalance,
      displayOrder: data.displayOrder,
    }).returning();

    return c.json(successResponse(newWallet[0]), 201);
  } catch (error) {
    console.error('Error creating wallet:', error);
    return c.json(errorResponse('INTERNAL_ERROR', 'Failed to create wallet'), 500);
  }
});

/**
 * GET /api/wallet/:id - Get wallet detail with transactions summary
 */
app.get('/:id', async (c) => {
  try {
    const firebaseUser = c.get('firebaseUser');
    const db = drizzle(c.env.DB, { schema });
    const walletId = Number(c.req.param('id'));

    if (isNaN(walletId)) {
      return c.json(errorResponse('VALIDATION_ERROR', 'Invalid wallet ID'), 400);
    }

    const walletData = await db.query.wallet.findFirst({
      where: and(
        eq(wallet.id, walletId),
        eq(wallet.userId, firebaseUser.uid)
      ),
    });

    if (!walletData) {
      return c.json(errorResponse('NOT_FOUND', 'Wallet not found'), 404);
    }

    // Get total income for this wallet (join with category to get type)
    const incomeResult = await db
      .select({ total: sum(schema.transaction.amount) })
      .from(schema.transaction)
      .innerJoin(schema.category, eq(schema.transaction.categoryId, schema.category.id))
      .where(
        and(
          eq(schema.transaction.userId, firebaseUser.uid),
          eq(schema.transaction.walletId, walletId),
          eq(schema.category.type, 'income')
        )
      );

    const totalIncome = Number(incomeResult[0]?.total || 0);

    // Get total expense for this wallet (join with category to get type)
    const expenseResult = await db
      .select({ total: sum(schema.transaction.amount) })
      .from(schema.transaction)
      .innerJoin(schema.category, eq(schema.transaction.categoryId, schema.category.id))
      .where(
        and(
          eq(schema.transaction.userId, firebaseUser.uid),
          eq(schema.transaction.walletId, walletId),
          eq(schema.category.type, 'expense')
        )
      );

    const totalExpense = Number(expenseResult[0]?.total || 0);

    // Get recent transactions for this wallet (last 10)
    const recentTransactions = await db.query.transaction.findMany({
      where: and(
        eq(schema.transaction.userId, firebaseUser.uid),
        eq(schema.transaction.walletId, walletId)
      ),
      orderBy: [desc(schema.transaction.transactionDate), desc(schema.transaction.createdAt)],
      limit: 10,
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

    // Format transaction dates
    const formattedTransactions = recentTransactions.map((t) => ({
      ...t,
      transactionDate: formatDate(t.transactionDate),
    }));

    return c.json(
      successResponse({
        wallet: {
          id: walletData.id,
          name: walletData.name,
          color: walletData.color,
          currentBalance: walletData.currentBalance,
          initialBalance: walletData.initialBalance,
          displayOrder: walletData.displayOrder,
        },
        summary: {
          totalIncome,
          totalExpense,
          netIncome: totalIncome - totalExpense,
        },
        recentTransactions: formattedTransactions,
      })
    );
  } catch (error) {
    console.error('Error fetching wallet:', error);
    return c.json(errorResponse('INTERNAL_ERROR', 'Failed to fetch wallet'), 500);
  }
});

/**
 * PUT /api/wallet/:id - Update wallet
 */
app.put('/:id', zValidator('json', updateWalletSchema), async (c) => {
  try {
    const firebaseUser = c.get('firebaseUser');
    const db = drizzle(c.env.DB, { schema });
    const walletId = Number(c.req.param('id'));
    const data = c.req.valid('json');

    if (isNaN(walletId)) {
      return c.json(errorResponse('VALIDATION_ERROR', 'Invalid wallet ID'), 400);
    }

    // Validate ownership
    const isOwner = await validateWalletOwnership(db, walletId, firebaseUser.uid);
    if (!isOwner) {
      return c.json(errorResponse('NOT_FOUND', 'Wallet not found'), 404);
    }

    // Check for duplicate name if name is being updated
    if (data.name) {
      const existingWallet = await db.query.wallet.findFirst({
        where: and(
          eq(wallet.userId, firebaseUser.uid),
          eq(wallet.name, data.name),
          eq(wallet.isActive, true)
        ),
      });

      if (existingWallet && existingWallet.id !== walletId) {
        return c.json(
          errorResponse('DUPLICATE_ENTRY', 'Wallet with this name already exists'),
          400
        );
      }
    }

    // Update wallet
    const updatedWallet = await db
      .update(wallet)
      .set(data)
      .where(eq(wallet.id, walletId))
      .returning();

    return c.json(successResponse(updatedWallet[0]));
  } catch (error) {
    console.error('Error updating wallet:', error);
    return c.json(errorResponse('INTERNAL_ERROR', 'Failed to update wallet'), 500);
  }
});

/**
 * DELETE /api/wallet/:id - Soft delete wallet
 */
app.delete('/:id', async (c) => {
  try {
    const firebaseUser = c.get('firebaseUser');
    const db = drizzle(c.env.DB, { schema });
    const walletId = Number(c.req.param('id'));

    if (isNaN(walletId)) {
      return c.json(errorResponse('VALIDATION_ERROR', 'Invalid wallet ID'), 400);
    }

    // Validate ownership
    const isOwner = await validateWalletOwnership(db, walletId, firebaseUser.uid);
    if (!isOwner) {
      return c.json(errorResponse('NOT_FOUND', 'Wallet not found'), 404);
    }

    // Soft delete
    await db
      .update(wallet)
      .set({ isActive: false })
      .where(eq(wallet.id, walletId));

    return c.json(successResponse({ message: 'Wallet deleted successfully' }));
  } catch (error) {
    console.error('Error deleting wallet:', error);
    return c.json(errorResponse('INTERNAL_ERROR', 'Failed to delete wallet'), 500);
  }
});

/**
 * PUT /api/wallet/reorder - Update display order of wallets
 */
app.put('/reorder', zValidator('json', reorderWalletSchema), async (c) => {
  try {
    const firebaseUser = c.get('firebaseUser');
    const db = drizzle(c.env.DB, { schema });
    const { wallets } = c.req.valid('json');

    // Update each wallet's display order
    for (const item of wallets) {
      // Validate ownership
      const isOwner = await validateWalletOwnership(db, item.id, firebaseUser.uid);
      if (isOwner) {
        await db
          .update(wallet)
          .set({ displayOrder: item.displayOrder })
          .where(eq(wallet.id, item.id));
      }
    }

    return c.json(successResponse({ message: 'Wallet order updated successfully' }));
  } catch (error) {
    console.error('Error reordering wallets:', error);
    return c.json(errorResponse('INTERNAL_ERROR', 'Failed to reorder wallets'), 500);
  }
});

export default app;
