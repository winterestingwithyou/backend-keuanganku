import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq, and, desc, gte, lte, count, or } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../db/schema';
import { transfer, wallet } from '../db/schema';
import { requireAuth } from '../lib/better-auth/middleware';
import { createTransferSchema, listTransferQuerySchema } from '../validators/transfer';
import {
  errorResponse,
  successResponse,
  validateTransfer,
  getPaginationParams,
  paginationMeta,
} from '../lib/utils';
import { User, Session } from '../db/types';

type AppContext = {
  Bindings: CloudflareBindings;
  Variables: {
    user: User;
    session: Session;
  };
};

const app = new Hono<AppContext>();

// All routes require authentication
app.use('*', requireAuth);

/**
 * GET /api/transfer - List transfer history with filters
 */
app.get('/', zValidator('query', listTransferQuerySchema), async (c) => {
  try {
    const user = c.get('user');
    const db = drizzle(c.env.DB, { schema });
    const query = c.req.valid('query');

    const { offset, limit } = getPaginationParams(query.page, query.limit);

    // Build where conditions
    const conditions = [eq(transfer.userId, user.id)];

    if (query.wallet_id) {
      // Show transfers where wallet is either sender or receiver
      conditions.push(
        or(
          eq(transfer.fromWalletId, query.wallet_id),
          eq(transfer.toWalletId, query.wallet_id)
        )!
      );
    }

    if (query.start_date) {
      conditions.push(gte(transfer.transferDate, query.start_date));
    }

    if (query.end_date) {
      conditions.push(lte(transfer.transferDate, query.end_date));
    }

    // Get transfers with pagination
    const transfers = await db.query.transfer.findMany({
      where: and(...conditions),
      orderBy: [desc(transfer.transferDate), desc(transfer.createdAt)],
      limit: limit,
      offset: offset,
      with: {
        fromWallet: {
          columns: {
            id: true,
            name: true,
            icon: true,
            color: true,
          },
        },
        toWallet: {
          columns: {
            id: true,
            name: true,
            icon: true,
            color: true,
          },
        },
      },
    });

    // Get total count
    const totalResult = await db
      .select({ count: count() })
      .from(transfer)
      .where(and(...conditions));

    const total = totalResult[0]?.count || 0;

    return c.json(successResponse(transfers, paginationMeta(query.page, query.limit, total)));
  } catch (error) {
    console.error('Error fetching transfers:', error);
    return c.json(errorResponse('INTERNAL_ERROR', 'Failed to fetch transfers'), 500);
  }
});

/**
 * POST /api/transfer - Create new transfer (atomic operation)
 */
app.post('/', zValidator('json', createTransferSchema), async (c) => {
  try {
    const user = c.get('user');
    const db = drizzle(c.env.DB, { schema });
    const data = c.req.valid('json');

    // Validate transfer
    const validation = await validateTransfer(
      db,
      data.fromWalletId,
      data.toWalletId,
      data.amount,
      user.id,
      data.fee
    );

    if (!validation.valid) {
      return c.json(
        errorResponse('VALIDATION_ERROR', validation.error || 'Transfer validation failed'),
        400
      );
    }

    // Execute transfer in a transaction
    const result = await db.batch([
      // 1. Create transfer record
      db.insert(transfer).values({
        userId: user.id,
        fromWalletId: data.fromWalletId,
        toWalletId: data.toWalletId,
        amount: data.amount,
        fee: data.fee,
        description: data.description,
        transferDate: data.transferDate,
      }).returning(),

      // 2. Update from wallet balance (subtract amount + fee)
      db
        .update(wallet)
        .set({
          currentBalance: (await db.query.wallet.findFirst({
            where: eq(wallet.id, data.fromWalletId),
          }))!.currentBalance - data.amount - data.fee,
        })
        .where(eq(wallet.id, data.fromWalletId))
        .returning(),

      // 3. Update to wallet balance (add amount)
      db
        .update(wallet)
        .set({
          currentBalance: (await db.query.wallet.findFirst({
            where: eq(wallet.id, data.toWalletId),
          }))!.currentBalance + data.amount,
        })
        .where(eq(wallet.id, data.toWalletId))
        .returning(),
    ]);

    const newTransfer = result[0][0];

    return c.json(successResponse(newTransfer), 201);
  } catch (error) {
    console.error('Error creating transfer:', error);
    return c.json(errorResponse('INTERNAL_ERROR', 'Failed to create transfer'), 500);
  }
});

/**
 * GET /api/transfer/:id - Get transfer detail
 */
app.get('/:id', async (c) => {
  try {
    const user = c.get('user');
    const db = drizzle(c.env.DB, { schema });
    const transferId = c.req.param('id');

    const transferData = await db.query.transfer.findFirst({
      where: and(eq(transfer.id, transferId), eq(transfer.userId, user.id)),
      with: {
        fromWallet: {
          columns: {
            id: true,
            name: true,
            icon: true,
            color: true,
          },
        },
        toWallet: {
          columns: {
            id: true,
            name: true,
            icon: true,
            color: true,
          },
        },
      },
    });

    if (!transferData) {
      return c.json(errorResponse('NOT_FOUND', 'Transfer not found'), 404);
    }

    return c.json(successResponse(transferData));
  } catch (error) {
    console.error('Error fetching transfer:', error);
    return c.json(errorResponse('INTERNAL_ERROR', 'Failed to fetch transfer'), 500);
  }
});

/**
 * DELETE /api/transfer/:id - Delete transfer (rollback balance)
 */
app.delete('/:id', async (c) => {
  try {
    const user = c.get('user');
    const db = drizzle(c.env.DB, { schema });
    const transferId = c.req.param('id');

    // Get existing transfer
    const existingTransfer = await db.query.transfer.findFirst({
      where: and(eq(transfer.id, transferId), eq(transfer.userId, user.id)),
    });

    if (!existingTransfer) {
      return c.json(errorResponse('NOT_FOUND', 'Transfer not found'), 404);
    }

    // Rollback transfer in a transaction
    await db.batch([
      // 1. Delete transfer record
      db.delete(transfer).where(eq(transfer.id, transferId)),

      // 2. Rollback from wallet balance (add back amount + fee)
      db
        .update(wallet)
        .set({
          currentBalance: (await db.query.wallet.findFirst({
            where: eq(wallet.id, existingTransfer.fromWalletId),
          }))!.currentBalance + existingTransfer.amount + existingTransfer.fee,
        })
        .where(eq(wallet.id, existingTransfer.fromWalletId)),

      // 3. Rollback to wallet balance (subtract amount)
      db
        .update(wallet)
        .set({
          currentBalance: (await db.query.wallet.findFirst({
            where: eq(wallet.id, existingTransfer.toWalletId),
          }))!.currentBalance - existingTransfer.amount,
        })
        .where(eq(wallet.id, existingTransfer.toWalletId)),
    ]);

    return c.json(successResponse({ message: 'Transfer deleted and balance rolled back' }));
  } catch (error) {
    console.error('Error deleting transfer:', error);
    return c.json(errorResponse('INTERNAL_ERROR', 'Failed to delete transfer'), 500);
  }
});

export default app;
