import { sqliteTable, text, integer, real, index } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

// Current timestamp as Date
const now = () => new Date();

// ============================================
// WALLET TABLE (Tempat pencatatan keuangan)
// ============================================
export const wallet = sqliteTable('wallet', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id').notNull(), // Firebase UID - no FK constraint
  name: text('name').notNull(), // 'Dana', 'OVO', 'GoPay', 'Tunai', 'Bank BCA', dll
  color: text('color'), // hex color untuk UI
  initialBalance: real('initial_balance').notNull().default(0), // saldo awal
  currentBalance: real('current_balance').notNull().default(0), // saldo saat ini (cached)
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true), // soft delete
  displayOrder: integer('display_order').notNull().default(0), // untuk sorting di UI
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => now()),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => now())
    .$onUpdate(() => now()),
}, (table) => [
  index('idx_wallet_user_id').on(table.userId),
  index('idx_wallet_active').on(table.userId, table.isActive),
]);

// ============================================
// CATEGORY TABLE (Kategori transaksi)
// ============================================
export const category = sqliteTable('category', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id').notNull(), // Firebase UID - no FK constraint
  name: text('name').notNull(), // 'Makanan', 'Transport', 'Hiburan', 'Gaji', dll
  type: text('type', { enum: ['income', 'expense'] }).notNull(),
  icon: text('icon'),
  isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false), // system vs user-created
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => now()),
}, (table) => [
  index('idx_category_user_id').on(table.userId),
  index('idx_category_type').on(table.userId, table.type),
]);

// ============================================
// TRANSACTION TABLE (Transaksi keuangan)
// ============================================
export const transaction = sqliteTable('transaction', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id').notNull(), // Firebase UID - no FK constraint
  walletId: integer('wallet_id')
    .notNull()
    .references(() => wallet.id, { onDelete: 'cascade' }),
  categoryId: integer('category_id')
    .references(() => category.id, { onDelete: 'set null' }),
  amount: real('amount').notNull(), // harus > 0, validasi di application layer
  description: text('description'),
  notes: text('notes'),
  transactionDate: integer('transaction_date', { mode: 'timestamp_ms' }).notNull(), // tanggal aktual transaksi
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => now()),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => now())
    .$onUpdate(() => now()),
}, (table) => [
  index('idx_transaction_user_id').on(table.userId),
  index('idx_transaction_wallet_id').on(table.walletId),
  index('idx_transaction_date').on(table.userId, table.transactionDate),
  index('idx_transaction_category').on(table.categoryId),
]);

// ============================================
// TRANSFER TABLE (Transfer antar wallet)
// ============================================
export const transfer = sqliteTable('transfer', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id').notNull(), // Firebase UID - no FK constraint
  fromWalletId: integer('from_wallet_id')
    .notNull()
    .references(() => wallet.id, { onDelete: 'cascade' }),
  toWalletId: integer('to_wallet_id')
    .notNull()
    .references(() => wallet.id, { onDelete: 'cascade' }),
  amount: real('amount').notNull(), // harus > 0
  fee: real('fee').notNull().default(0), // biaya transfer (opsional)
  description: text('description'),
  transferDate: integer('transfer_date', { mode: 'timestamp_ms' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => now()),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => now())
    .$onUpdate(() => now()),
}, (table) => [
  index('idx_transfer_user_id').on(table.userId),
  index('idx_transfer_from_wallet').on(table.fromWalletId),
  index('idx_transfer_to_wallet').on(table.toWalletId),
  index('idx_transfer_date').on(table.userId, table.transferDate),
]);

// ============================================
// RELATIONS
// ============================================
export const walletRelations = relations(wallet, ({ many }) => ({
  transactions: many(transaction),
  transfersFrom: many(transfer, { relationName: 'fromWallet' }),
  transfersTo: many(transfer, { relationName: 'toWallet' }),
}));

export const categoryRelations = relations(category, ({ many }) => ({
  transactions: many(transaction),
}));

export const transactionRelations = relations(transaction, ({ one }) => ({
  wallet: one(wallet, {
    fields: [transaction.walletId],
    references: [wallet.id],
  }),
  category: one(category, {
    fields: [transaction.categoryId],
    references: [category.id],
  }),
}));

export const transferRelations = relations(transfer, ({ one }) => ({
  fromWallet: one(wallet, {
    fields: [transfer.fromWalletId],
    references: [wallet.id],
    relationName: 'fromWallet',
  }),
  toWallet: one(wallet, {
    fields: [transfer.toWalletId],
    references: [wallet.id],
    relationName: 'toWallet',
  }),
}));
