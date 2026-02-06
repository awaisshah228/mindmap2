/**
 * Drizzle Kit config for Neon — used by db:generate, db:migrate, db:push, db:studio.
 * @see https://orm.drizzle.team/docs/get-started/neon-new
 */
import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
