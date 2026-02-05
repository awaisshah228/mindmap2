import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { getDatabaseUrl } from "@/lib/env";

const sql = neon(getDatabaseUrl());
export const db = drizzle({ client: sql });
