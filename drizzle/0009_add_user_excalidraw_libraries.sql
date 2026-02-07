-- Add user_excalidraw_libraries for cloud sync of Excalidraw libraries when signed in.
-- Run with: psql $DATABASE_URL -f drizzle/0009_add_user_excalidraw_libraries.sql

CREATE TABLE IF NOT EXISTS "user_excalidraw_libraries" (
  "user_id" text PRIMARY KEY,
  "library_items" jsonb DEFAULT '[]'::jsonb,
  "updated_at" timestamp DEFAULT now()
);
