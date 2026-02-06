-- Add excalidraw_data and drawio_data columns to documents if they don't exist.
-- Run with: yarn db:migrate or psql $DATABASE_URL -f drizzle/0001_add_excalidraw_drawio_columns.sql

ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "excalidraw_data" jsonb;
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "drawio_data" text;
