import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq, and, desc } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../db/schema';
import { wallet } from '../db/schema';
import { requireFirebaseAuth } from '../lib/firebase/middleware';
import { createWalletSchema, updateWalletSchema, reorderWalletSchema } from '../validators/wallet';
import { errorResponse, successResponse, validateWalletOwnership } from '../lib/utils';
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
      icon: data.icon,
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
 * GET /api/wallet/:id - Get wallet detail
 */
app.get('/:id', async (c) => {
  try {
    const firebaseUser = c.get('firebaseUser');
    const db = drizzle(c.env.DB, { schema });
    const walletId = c.req.param('id');

    const walletData = await db.query.wallet.findFirst({
      where: and(
        eq(wallet.id, walletId),
        eq(wallet.userId, firebaseUser.uid)
      ),
    });

    if (!walletData) {
      return c.json(errorResponse('NOT_FOUND', 'Wallet not found'), 404);
    }

    return c.json(successResponse(walletData));
  } catch (error) {
    console.error('Error fetching wallet:', error);
    return c.json(errorResponse('INTERNAL_ERROR', 'Failed to fetch wallet'), 500);
  }
});

/**
 * PATCH /api/wallet/:id - Update wallet
 */
app.patch('/:id', zValidator('json', updateWalletSchema), async (c) => {
  try {
    const firebaseUser = c.get('firebaseUser');
    const db = drizzle(c.env.DB, { schema });
    const walletId = c.req.param('id');
    const data = c.req.valid('json');

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
    const walletId = c.req.param('id');

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
 * PATCH /api/wallet/reorder - Update display order of wallets
 */
app.patch('/reorder', zValidator('json', reorderWalletSchema), async (c) => {
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
