-- Add data_format and mermaid_data to diagram_presets for Excalidraw Mermaid vs JSON distinction.
-- Run with: yarn db:migrate or psql $DATABASE_URL -f drizzle/0008_add_preset_data_format_mermaid.sql

ALTER TABLE "diagram_presets" ADD COLUMN IF NOT EXISTS "data_format" text;
ALTER TABLE "diagram_presets" ADD COLUMN IF NOT EXISTS "mermaid_data" text;
