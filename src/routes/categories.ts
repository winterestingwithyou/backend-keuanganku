import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq, and } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../db/schema';
import { category } from '../db/schema';
import { requireFirebaseAuth } from '../lib/firebase/middleware';
import { createCategorySchema, updateCategorySchema } from '../validators/category';
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
 * GET /api/categories - List all categories (default + user-created)
 */
app.get('/', async (c) => {
  try {
    const firebaseUser = c.get('firebaseUser');
    const db = drizzle(c.env.DB, { schema });

    const categories = await db.query.category.findMany({
      where: eq(category.userId, firebaseUser.uid),
      orderBy: [category.type, category.name],
    });

    return c.json(successResponse(categories));
  } catch (error) {
    console.error('Error fetching categories:', error);
    return c.json(errorResponse('INTERNAL_ERROR', 'Failed to fetch categories'), 500);
  }
});

/**
 * POST /api/categories - Create custom category
 */
app.post('/', zValidator('json', createCategorySchema), async (c) => {
  try {
    const firebaseUser = c.get('firebaseUser');
    const db = drizzle(c.env.DB, { schema });
    const data = c.req.valid('json');

    // Check for duplicate category name
    const existingCategory = await db.query.category.findFirst({
      where: and(
        eq(category.userId, firebaseUser.uid),
        eq(category.name, data.name),
        eq(category.type, data.type)
      ),
    });

    if (existingCategory) {
      return c.json(
        errorResponse('DUPLICATE_ENTRY', 'Category with this name already exists'),
        400
      );
    }

    // Create category
    const newCategory = await db
      .insert(category)
      .values({
        userId: firebaseUser.uid,
        name: data.name,
        type: data.type,
        icon: data.icon,
        color: data.color,
        isDefault: false,
      })
      .returning();

    return c.json(successResponse(newCategory[0]), 201);
  } catch (error) {
    console.error('Error creating category:', error);
    return c.json(errorResponse('INTERNAL_ERROR', 'Failed to create category'), 500);
  }
});

/**
 * PATCH /api/categories/:id - Update category (user-created only)
 */
app.patch('/:id', zValidator('json', updateCategorySchema), async (c) => {
  try {
    const firebaseUser = c.get('firebaseUser');
    const db = drizzle(c.env.DB, { schema });
    const categoryId = Number(c.req.param('id'));
    const data = c.req.valid('json');

    if (isNaN(categoryId)) {
      return c.json(errorResponse('VALIDATION_ERROR', 'Invalid category ID'), 400);
    }

    // Get existing category
    const existingCategory = await db.query.category.findFirst({
      where: and(eq(category.id, categoryId), eq(category.userId, firebaseUser.uid)),
    });

    if (!existingCategory) {
      return c.json(errorResponse('NOT_FOUND', 'Category not found'), 404);
    }

    // Check if it's a default category
    if (existingCategory.isDefault) {
      return c.json(
        errorResponse('VALIDATION_ERROR', 'Cannot edit default categories'),
        400
      );
    }

    // Check for duplicate name if name is being updated
    if (data.name) {
      const duplicateCategory = await db.query.category.findFirst({
        where: and(
          eq(category.userId, firebaseUser.uid),
          eq(category.name, data.name),
          eq(category.type, existingCategory.type)
        ),
      });

      if (duplicateCategory && duplicateCategory.id !== categoryId) {
        return c.json(
          errorResponse('DUPLICATE_ENTRY', 'Category with this name already exists'),
          400
        );
      }
    }

    // Update category
    const updatedCategory = await db
      .update(category)
      .set(data)
      .where(eq(category.id, categoryId))
      .returning();

    return c.json(successResponse(updatedCategory[0]));
  } catch (error) {
    console.error('Error updating category:', error);
    return c.json(errorResponse('INTERNAL_ERROR', 'Failed to update category'), 500);
  }
});

/**
 * DELETE /api/categories/:id - Delete category (user-created only)
 */
app.delete('/:id', async (c) => {
  try {
    const firebaseUser = c.get('firebaseUser');
    const db = drizzle(c.env.DB, { schema });
    const categoryId = Number(c.req.param('id'));

    if (isNaN(categoryId)) {
      return c.json(errorResponse('VALIDATION_ERROR', 'Invalid category ID'), 400);
    }

    // Get existing category
    const existingCategory = await db.query.category.findFirst({
      where: and(eq(category.id, categoryId), eq(category.userId, firebaseUser.uid)),
    });

    if (!existingCategory) {
      return c.json(errorResponse('NOT_FOUND', 'Category not found'), 404);
    }

    // Check if it's a default category
    if (existingCategory.isDefault) {
      return c.json(
        errorResponse('VALIDATION_ERROR', 'Cannot delete default categories'),
        400
      );
    }

    // Delete category (transactions with this category will have categoryId set to null)
    await db.delete(category).where(eq(category.id, categoryId));

    return c.json(successResponse({ message: 'Category deleted successfully' }));
  } catch (error) {
    console.error('Error deleting category:', error);
    return c.json(errorResponse('INTERNAL_ERROR', 'Failed to delete category'), 500);
  }
});

export default app;
