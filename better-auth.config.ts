/**
 * Better Auth CLI configuration file
 *
 * CATATAN: File ini HANYA untuk CLI better-auth (migrations, generate, dll).
 * Untuk runtime Cloudflare Workers, gunakan src/lib/better-auth/index.ts
 *
 * Docs: https://www.better-auth.com/docs/concepts/cli
 */
import { betterAuth } from 'better-auth';
import { betterAuthOptions } from './src/lib/better-auth/options';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import * as schema from './src/db/schema';

const { BETTER_AUTH_URL, BETTER_AUTH_SECRET } = process.env;

const db = {} as any;

// Untuk CLI, kita tidak perlu database adapter karena:
export const auth: ReturnType<typeof betterAuth> = betterAuth({
  database: drizzleAdapter(db, { provider: 'sqlite', schema }),
  ...betterAuthOptions,
  baseURL: BETTER_AUTH_URL,
  secret: BETTER_AUTH_SECRET
});
