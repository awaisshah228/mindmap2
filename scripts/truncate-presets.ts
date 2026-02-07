/**
 * Truncate (delete all) diagram_presets data.
 * Run: yarn db:truncate-presets   or   npx tsx scripts/truncate-presets.ts
 *
 * Requires DATABASE_URL in .env or env.
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
    await sql`TRUNCATE TABLE diagram_presets CASCADE`;
    console.log("Truncated diagram_presets. All preset data removed.");
  } catch (err) {
    console.error("Error truncating presets:", err);
    process.exit(1);
  }
}

main();
