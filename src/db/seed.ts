import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema';
import { category } from './schema';

/**
 * Default categories untuk setiap user baru
 */
export const DEFAULT_CATEGORIES = {
  income: [
    { name: 'Gaji', icon: '💰' },
    { name: 'Bonus', icon: '🎁' },
    { name: 'Investasi', icon: '📈' },
    { name: 'Bisnis', icon: '💼' },
    { name: 'Freelance', icon: '💻' },
    { name: 'Hadiah', icon: '🎉' },
    { name: 'Lainnya', icon: '➕' },
  ],
  expense: [
    { name: 'Makanan & Minuman', icon: '🍔' },
    { name: 'Transport', icon: '🚗' },
    { name: 'Belanja', icon: '🛒' },
    { name: 'Hiburan', icon: '🎬' },
    { name: 'Kesehatan', icon: '🏥' },
    { name: 'Pendidikan', icon: '📚' },
    { name: 'Tagihan', icon: '📄' },
    { name: 'Rumah Tangga', icon: '🏠' },
    { name: 'Pakaian', icon: '👕' },
    { name: 'Kecantikan', icon: '💄' },
    { name: 'Olahraga', icon: '⚽' },
    { name: 'Hadiah & Donasi', icon: '🎁' },
    { name: 'Lainnya', icon: '➕' },
  ],
};

/**
 * Seed default categories untuk user baru
 * Dipanggil setelah user register
 */
export async function seedDefaultCategories(db: ReturnType<typeof drizzle>, userId: string) {
  const categoriesToInsert = [];

  // Income categories
  for (const cat of DEFAULT_CATEGORIES.income) {
    categoriesToInsert.push({
      userId,
      name: cat.name,
      type: 'income' as const,
      icon: cat.icon,
      isDefault: true,
    });
  }

  // Expense categories
  for (const cat of DEFAULT_CATEGORIES.expense) {
    categoriesToInsert.push({
      userId,
      name: cat.name,
      type: 'expense' as const,
      icon: cat.icon,
      isDefault: true,
    });
  }

  // Insert all default categories
  await db.insert(category).values(categoriesToInsert);

  return categoriesToInsert.length;
}

/**
 * Seed default wallet untuk user baru
 * Dipanggil setelah user register
 */
export async function seedDefaultWallet(db: ReturnType<typeof drizzle>, userId: string) {
  const { wallet } = schema;

  const defaultWallet = await db
    .insert(wallet)
    .values({
      userId,
      name: 'Dompet Utama',
      color: '#3b82f6',
      initialBalance: 0,
      currentBalance: 0,
      displayOrder: 0,
    })
    .returning();

  return defaultWallet[0];
}

/**
 * Setup lengkap untuk user baru (categories + wallet)
 */
export async function setupNewUser(db: ReturnType<typeof drizzle>, userId: string) {
  try {
    // Seed default categories
    const categoriesCount = await seedDefaultCategories(db, userId);
    console.log(`Created ${categoriesCount} default categories for user ${userId}`);

    // Seed default wallet
    const defaultWallet = await seedDefaultWallet(db, userId);
    console.log(`Created default wallet for user ${userId}:`, defaultWallet.name);

    return {
      success: true,
      categoriesCount,
      defaultWallet,
    };
  } catch (error) {
    console.error('Error setting up new user:', error);
    throw error;
  }
}
