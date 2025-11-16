import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { betterAuth } from 'better-auth';
import { betterAuthOptions } from './options';
import * as schema from "../../db/schema";
import { drizzle } from 'drizzle-orm/d1';

/**
 * Better Auth Instance Factory
 *
 * Fungsi ini membuat instance Better Auth dengan env dari Cloudflare Workers.
 * Setiap request akan membuat instance baru dengan DB binding yang sesuai.
 */
export const auth = (env: CloudflareBindings) => {
  // Inisialisasi Drizzle dengan D1 database dari env
  const db = drizzle(env.DB, { schema });

  return betterAuth({
    ...betterAuthOptions,
    database: drizzleAdapter(db, {
      provider: 'sqlite',
      schema
    }),
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: env.TRUSTED_ORIGINS.split(",")
  });
};
