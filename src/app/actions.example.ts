/**
 * Example Server Actions — safe pattern for using Neon DB.
 * Only import and call these from Server Components or other server code.
 * DATABASE_URL is never sent to the client.
 *
 * To use: rename to actions.ts and call getData() from a server component.
 */
"use server";

import { db } from "@/db";
import { diagramPresets } from "@/db/schema";

export async function getData() {
  const rows = await db.select().from(diagramPresets).limit(10);
  return rows;
}
