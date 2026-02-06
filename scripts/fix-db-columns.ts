/**
 * Add excalidraw_data and drawio_data columns to documents table if missing.
 * Run: yarn db:fix-columns
 * Or with DATABASE_URL: DATABASE_URL=... yarn db:fix-columns
 */
import "dotenv/config";
import { neon } from "@neondatabase/serverless";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is required. Set it in .env or pass as env var.");
    process.exit(1);
  }
  const sql = neon(url);
  try {
    await sql`ALTER TABLE documents ADD COLUMN IF NOT EXISTS excalidraw_data jsonb`;
    console.log("Added excalidraw_data column (or already exists).");
    await sql`ALTER TABLE documents ADD COLUMN IF NOT EXISTS drawio_data text`;
    console.log("Added drawio_data column (or already exists).");
    await sql`ALTER TABLE documents ADD COLUMN IF NOT EXISTS saved_layout jsonb`;
    console.log("Added saved_layout column (or already exists).");
    console.log("Done. Database is ready.");
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

main();
