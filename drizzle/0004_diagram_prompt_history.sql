-- Diagram prompt history: links prompts to the diagrams they generated (per project).
-- Run with: yarn db:migrate or psql $DATABASE_URL -f drizzle/0004_diagram_prompt_history.sql

CREATE TABLE IF NOT EXISTS "diagram_prompt_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "document_id" uuid NOT NULL REFERENCES "documents"("id") ON DELETE CASCADE,
  "prompt" text NOT NULL,
  "nodes" jsonb DEFAULT '[]'::jsonb,
  "edges" jsonb DEFAULT '[]'::jsonb,
  "target_canvas" text,
  "node_count" integer,
  "edge_count" integer,
  "created_at" timestamp DEFAULT now()
);
