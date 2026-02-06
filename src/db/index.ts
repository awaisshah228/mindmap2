/**
 * Neon serverless + Drizzle (neon-http).
 * Uses @neondatabase/serverless (HTTP) and drizzle-orm/neon-http — no persistent TCP, works in serverless/edge.
 *
 * SECURITY: Only import this module in server code (API routes, Server Actions, server components).
 * Never import db or getDatabaseUrl in client components — DATABASE_URL must not be exposed to the browser.
 */
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { getDatabaseUrl } from "@/lib/env";

const sql = neon(getDatabaseUrl());
export const db = drizzle({ client: sql });
