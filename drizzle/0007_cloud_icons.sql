CREATE TABLE IF NOT EXISTS "cloud_icons" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "key" text NOT NULL,
  "url" text NOT NULL,
  "filename" text,
  "name" text NOT NULL,
  "keywords" text,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now()
);
