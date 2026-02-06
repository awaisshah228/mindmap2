-- Add saved_layout column to documents for persisting layout config (direction, algorithm, spacing).
-- Run with: yarn db:migrate or psql $DATABASE_URL -f drizzle/0002_add_saved_layout_column.sql

ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "saved_layout" jsonb;
