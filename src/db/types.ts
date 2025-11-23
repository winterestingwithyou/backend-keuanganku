import { category, transaction, transfer, wallet, user } from "./schema";

/**
 * User types - Firebase Auth
 */
export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;

/**
 * Wallet types
 */
export type Wallet = typeof wallet.$inferSelect;
export type NewWallet = typeof wallet.$inferInsert;

/**
 * Category types
 */
export type Category = typeof category.$inferSelect;
export type NewCategory = typeof category.$inferInsert;

/**
 * Transaction types
 */
export type Transaction = typeof transaction.$inferSelect;
export type NewTransaction = typeof transaction.$inferInsert;

/**
 * Transfer types
 */
export type Transfer = typeof transfer.$inferSelect;
export type NewTransfer = typeof transfer.$inferInsert;

/**
 * Firebase User dari middleware
 */
export type FirebaseUser = {
  uid: string;
  email: string | undefined;
  emailVerified: boolean | undefined;
  name: string | undefined;
  picture: string | undefined;
};
