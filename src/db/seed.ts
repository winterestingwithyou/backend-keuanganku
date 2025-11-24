import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema';
import { category } from './schema';

/**
 * Default categories untuk setiap user baru
 */
export const DEFAULT_CATEGORIES = {
  income: [
    { name: 'Gaji', icon: '💰', color: '#10b981' },
    { name: 'Bonus', icon: '🎁', color: '#10b981' },
    { name: 'Investasi', icon: '📈', color: '#10b981' },
    { name: 'Bisnis', icon: '💼', color: '#10b981' },
    { name: 'Freelance', icon: '💻', color: '#10b981' },
    { name: 'Hadiah', icon: '🎉', color: '#10b981' },
    { name: 'Lainnya', icon: '➕', color: '#10b981' },
  ],
  expense: [
    { name: 'Makanan & Minuman', icon: '🍔', color: '#ef4444' },
    { name: 'Transport', icon: '🚗', color: '#ef4444' },
    { name: 'Belanja', icon: '🛒', color: '#ef4444' },
    { name: 'Hiburan', icon: '🎬', color: '#ef4444' },
    { name: 'Kesehatan', icon: '🏥', color: '#ef4444' },
    { name: 'Pendidikan', icon: '📚', color: '#ef4444' },
    { name: 'Tagihan', icon: '📄', color: '#ef4444' },
    { name: 'Rumah Tangga', icon: '🏠', color: '#ef4444' },
    { name: 'Pakaian', icon: '👕', color: '#ef4444' },
    { name: 'Kecantikan', icon: '💄', color: '#ef4444' },
    { name: 'Olahraga', icon: '⚽', color: '#ef4444' },
    { name: 'Hadiah & Donasi', icon: '🎁', color: '#ef4444' },
    { name: 'Lainnya', icon: '➕', color: '#ef4444' },
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
      color: cat.color,
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
      color: cat.color,
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
