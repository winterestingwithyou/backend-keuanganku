import { sql } from "drizzle-orm";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

/**
 * User Table untuk Firebase Auth
 *
 * CATATAN:
 * - Autentikasi dilakukan di frontend (Kodular) dengan Firebase Auth
 * - Backend hanya menyimpan user info untuk relasi dengan data transaksi
 * - id adalah Firebase UID dari Firebase Auth
 * - Tidak ada password, session, atau account tables karena Firebase Auth handle semuanya
 */

export const user = sqliteTable("user", {
  // Firebase UID sebagai primary key
  id: text("id").primaryKey(), // Firebase UID dari Firebase Auth
  email: text("email").notNull().unique(),
  name: text("name"),
  photoURL: text("photo_url"), // URL foto profil dari Firebase
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .$onUpdate(() => new Date())
    .notNull(),
});
