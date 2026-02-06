-- Add drawio_data, excalidraw_data, target_canvas to diagram_presets for first-time AI generation flow.
-- Run with: yarn db:migrate or psql $DATABASE_URL -f drizzle/0003_add_preset_drawio_excalidraw.sql

ALTER TABLE "diagram_presets" ADD COLUMN IF NOT EXISTS "drawio_data" text;
ALTER TABLE "diagram_presets" ADD COLUMN IF NOT EXISTS "excalidraw_data" jsonb;
ALTER TABLE "diagram_presets" ADD COLUMN IF NOT EXISTS "target_canvas" text;
