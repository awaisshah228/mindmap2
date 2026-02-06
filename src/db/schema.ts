import {
  pgTable,
  text,
  timestamp,
  uuid,
  jsonb,
  boolean,
  integer,
  primaryKey,
} from "drizzle-orm/pg-core";

// ─── Plans & subscriptions (Clerk userId = text) ───────────────────────────

/** Subscription plans: free trial, starter, pro, + on-demand credits */
export const plans = pgTable("plans", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  stripePriceIdMonthly: text("stripe_price_id_monthly"),
  stripePriceIdYearly: text("stripe_price_id_yearly"),
  creditsPerMonth: integer("credits_per_month").notNull().default(0),
  freeTrialCredits: integer("free_trial_credits").notNull().default(0),
  priceCentsMonthly: integer("price_cents_monthly"),
  priceCentsYearly: integer("price_cents_yearly"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

/** Active subscription or trial; userId = Clerk user id */
export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().unique(),
  planId: text("plan_id")
    .notNull()
    .references(() => plans.id, { onDelete: "restrict" }),
  stripeSubscriptionId: text("stripe_subscription_id"),
  stripeCustomerId: text("stripe_customer_id"),
  status: text("status").notNull(),
  currentPeriodStart: timestamp("current_period_start", { mode: "date" }),
  currentPeriodEnd: timestamp("current_period_end", { mode: "date" }),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

/** Credits balance and monthly allowance (Clerk user id) */
export const userCredits = pgTable("user_credits", {
  userId: text("user_id").primaryKey(),
  balance: integer("balance").notNull().default(0),
  freeTrialUsed: integer("free_trial_used").notNull().default(0),
  monthlyCreditsUsed: integer("monthly_credits_used").notNull().default(0),
  monthlyResetAt: timestamp("monthly_reset_at", { mode: "date" }),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const creditTransactions = pgTable("credit_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  amount: integer("amount").notNull(),
  type: text("type").notNull(),
  description: text("description"),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── Workspaces & documents (projects) ────────────────────────────────────

export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, {
    onDelete: "cascade",
  }),
  name: text("name").notNull().default("Untitled"),
  nodes: jsonb("nodes").$type<object[]>().default([]),
  edges: jsonb("edges").$type<object[]>().default([]),
  viewport: jsonb("viewport").$type<{ x: number; y: number; zoom: number }>(),
  nodeNotes: jsonb("node_notes").$type<Record<string, string>>().default({}),
  nodeTasks: jsonb("node_tasks").$type<Record<string, unknown>>().default({}),
  nodeAttachments: jsonb("node_attachments").$type<Record<string, unknown>>().default({}),
  excalidrawData: jsonb("excalidraw_data").$type<{ elements: unknown[]; appState?: Record<string, unknown> }>(),
  drawioData: text("drawio_data"),
  isFavorite: boolean("is_favorite").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

/** S3 / storage references for user uploads (icons, attachments) */
export const userFiles = pgTable("user_files", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  key: text("key").notNull(),
  url: text("url").notNull(),
  filename: text("filename"),
  mimeType: text("mime_type"),
  sizeBytes: integer("size_bytes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── Diagram presets & templates (admin-managed) ───────────────────────────

/** Level/category for filtering: high-level-flow, high-level-system-design, flows, etc. */
export const PRESET_LEVELS = [
  "high-level-flow",
  "high-level-system-design",
  "high-level-diagram",
  "flows",
  "sequence",
  "architecture",
  "entity-relationship",
  "bpmn",
  "mindmap",
] as const;

export const diagramPresets = pgTable("diagram_presets", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  label: text("label").notNull(),
  description: text("description"),
  diagramType: text("diagram_type").notNull(),
  level: text("level").notNull(),
  nodes: jsonb("nodes").$type<object[]>().default([]),
  edges: jsonb("edges").$type<object[]>().default([]),
  prompt: text("prompt"),
  isTemplate: boolean("is_template").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  previewImageUrl: text("preview_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

/** Clerk user ids that can access admin dashboard */
export const adminUsers = pgTable("admin_users", {
  userId: text("user_id").primaryKey(),
  createdAt: timestamp("created_at").defaultNow(),
});

export type Plan = typeof plans.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
export type UserCredits = typeof userCredits.$inferSelect;
export type Workspace = typeof workspaces.$inferSelect;
export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
export type UserFile = typeof userFiles.$inferSelect;
export type DiagramPreset = typeof diagramPresets.$inferSelect;
export type NewDiagramPreset = typeof diagramPresets.$inferInsert;
