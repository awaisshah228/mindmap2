/**
 * Seed diagram_presets from hardcoded list + diagram-presets-data (nodes/edges).
 * Uses the same db as the app (src/db — Neon serverless).
 * @see https://orm.drizzle.team/docs/get-started/neon-new
 *
 * Run: yarn seed   or   yarn db:seed   or   npx tsx scripts/seed-presets.ts
 */
import "dotenv/config";
import { diagramPresets } from "../src/db/schema";
import { eq } from "drizzle-orm";
import { getPresetDiagram } from "../src/lib/diagram-presets-data";
import { getPresetPreviewUrl } from "../src/lib/preset-icons";

type PresetDef = {
  name: string;
  label: string;
  description?: string;
  diagramType: string;
  level: string;
  prompt: string;
  isTemplate: boolean;
  sortOrder: number;
};

const PRESETS: PresetDef[] = [
  // —— Advanced: full-scale e-commerce system design ——
  {
    name: "ecommerce-full-scale",
    label: "E-commerce full system (microservices, Kafka, S3)",
    diagramType: "architecture",
    level: "high-level-system-design",
    prompt: "Production-ready e-commerce system architecture. Include: (1) Frontend: React/Next.js SSR+CSR, CDN. (2) API Gateway: Kong or AWS API Gateway, rate limiting. (3) Microservices: User, Auth (OAuth2/JWT/Clerk/Keycloak), Product Catalog, Search (Elasticsearch), Cart, Order, Payment (Stripe), Inventory, Notification (email/SMS/webhooks), Analytics/Event Processing. (4) Communication: REST + gRPC; Apache Kafka for async events (order_created, payment_completed, inventory_updated). (5) Data: PostgreSQL (transactional), Redis (cache/sessions), Elasticsearch (search), S3 (images, invoices, logs). (6) Infra: Docker, Kubernetes, AWS-friendly. (7) CI/CD: GitHub Actions. Show service-to-service flow, Kafka topics, and S3 usage. Use groups and clear labels.",
    isTemplate: false,
    sortOrder: 1,
  },
  {
    name: "ecommerce-mern-aws",
    label: "eCommerce MERN + AWS (full stack)",
    diagramType: "architecture",
    level: "high-level-system-design",
    prompt: "Full-stack eCommerce architecture with MERN on AWS. Clear left-to-right flow. Use 2–4 groups. Include: User, React SPA (CloudFront + S3), ALB, Node.js/Express API (ECS Fargate), MongoDB Atlas, Redis, AWS SQS, AWS SNS, Apache Kafka, Socket.io, S3 + CloudFront, Cognito/Auth0, Stripe, Elasticsearch. Use data.icon and data.iconUrl where relevant.",
    isTemplate: false,
    sortOrder: 2,
  },
  // —— Advanced: auth flows ——
  {
    name: "auth-oauth2-jwt-full",
    label: "OAuth2 / JWT auth flow (advanced)",
    diagramType: "flowchart",
    level: "flows",
    prompt: "Advanced authentication flowchart. Show: (1) User clicks Login → Redirect to IdP (Clerk/Keycloak/Auth0). (2) Login/Register → IdP returns authorization code. (3) Backend exchanges code for access + refresh tokens. (4) Store tokens (httpOnly cookie or secure storage). (5) API requests: validate JWT (signature, expiry, issuer). (6) Token refresh flow when access token expires. (7) Logout: revoke token, clear session. Include decision diamonds for token valid? and refresh needed?",
    isTemplate: false,
    sortOrder: 3,
  },
  {
    name: "auth0-flow",
    label: "Auth0 auth flow",
    diagramType: "flowchart",
    level: "flows",
    prompt: "Flowchart for Auth0 authentication: User clicks Login → Redirect to Auth0 → Login/register → Callback with tokens → Validate token → Load session → Dashboard or Complete profile. Include token validation and session storage steps.",
    isTemplate: false,
    sortOrder: 4,
  },
  // —— Advanced: payment flow ——
  {
    name: "stripe-payment-advanced",
    label: "Stripe payment flow (idempotency, webhooks)",
    diagramType: "flowchart",
    level: "flows",
    prompt: "Advanced Stripe payment flowchart. Steps: (1) User checkout → Create PaymentIntent (idempotency key). (2) Client confirms with Stripe.js. (3) Success/failure webhook to backend. (4) Backend: verify webhook signature, idempotent handling (avoid double fulfillment). (5) On success: update order, reserve inventory, send confirmation email. (6) On failure: retry or show error. Include decision nodes for webhook verified?, duplicate event?, and payment status.",
    isTemplate: false,
    sortOrder: 5,
  },
  {
    name: "stripe-payment",
    label: "Stripe payment flow (simple)",
    diagramType: "flowchart",
    level: "high-level-flow",
    prompt: "Flowchart for Stripe payment flow: User selects product → Cart → Checkout → Stripe payment → Success or Failure → Order confirmation → Email receipt.",
    isTemplate: false,
    sortOrder: 6,
  },
  // —— Kafka & event-driven ——
  {
    name: "kafka-event-flow",
    label: "Kafka event flow (e-commerce)",
    diagramType: "architecture",
    level: "high-level-system-design",
    prompt: "Event-driven flow using Apache Kafka. Show: (1) Topics: order_created, payment_completed, inventory_updated, notification_requested. (2) Producers: Order Service, Payment Service, Inventory Service. (3) Consumers: Notification Service (email/SMS), Analytics Service, Inventory updater. (4) Label exactly-once vs at-least-once where relevant. (5) Show dead-letter queue or retry path for failed events. Use clear arrows for event flow.",
    isTemplate: false,
    sortOrder: 7,
  },
  {
    name: "product-microservices",
    label: "Product page with microservices",
    diagramType: "architecture",
    level: "architecture",
    prompt: "Microservices for a product detail page: CDN, Frontend, API Gateway, Product service, Inventory, Reviews, Recommendations services, shared Kafka for events. Show REST and event flow.",
    isTemplate: false,
    sortOrder: 8,
  },
  // —— DevOps & CI/CD ——
  {
    name: "ci-cd-advanced",
    label: "CI/CD pipeline (GitHub Actions, K8s)",
    diagramType: "flowchart",
    level: "flows",
    prompt: "Advanced CI/CD flowchart: (1) Developer push → GitHub webhook. (2) GitHub Actions: lint, unit test, build Docker image, push to ECR/registry. (3) Deploy to Staging (K8s/ECS), run E2E tests. (4) Approval gate (manual or automated). (5) Deploy to Production (blue/green or canary). (6) Health check, smoke tests. (7) Slack/email notify. (8) Rollback path: revert image, redeploy previous. Include decision nodes for tests pass? and deploy success?",
    isTemplate: false,
    sortOrder: 9,
  },
  {
    name: "ci-cd-pipeline",
    label: "CI/CD pipeline (standard)",
    diagramType: "flowchart",
    level: "flows",
    prompt: "Flowchart for CI/CD: Developer push → GitHub webhook → GitHub Actions (lint, test, build, Docker) → ECR → ECS Staging → E2E tests → Approval gate → ECS Production → Health check → Slack notify. Include rollback path.",
    isTemplate: false,
    sortOrder: 10,
  },
  // —— Other architecture & flows ——
  { name: "chatbot-arch", label: "Chatbot architecture", diagramType: "architecture", level: "high-level-system-design", prompt: "System architecture for a chatbot: User, Frontend chat UI, API Gateway, Auth service, Chat service, LLM provider (OpenAI), vector database for RAG, Redis for session/cache.", isTemplate: false, sortOrder: 11 },
  { name: "gig-marketplace", label: "Gig marketplace architecture", diagramType: "architecture", level: "high-level-system-design", prompt: "Architecture for a gig marketplace (Fiverr-style): Users (buyers/sellers), Frontend, API Gateway, Search, Order, Payment, Notification services, databases.", isTemplate: false, sortOrder: 12 },
  { name: "saas-multi-tenant", label: "SaaS multi-tenant architecture", diagramType: "architecture", level: "high-level-system-design", prompt: "Multi-tenant SaaS architecture: Tenants/Users → Next.js frontend → API Gateway → Microservices (Auth, Billing, Tenant Management, Core) → PostgreSQL (RLS), Redis, S3, Stripe, SendGrid.", isTemplate: false, sortOrder: 13 },
  { name: "ecommerce-sql", label: "eCommerce SQL schema", diagramType: "entity-relationship", level: "entity-relationship", prompt: "Entity-relationship diagram for eCommerce: Users, Orders, Order Items, Products, Categories, Cart, Payments, Shipping Addresses.", isTemplate: false, sortOrder: 14 },
  { name: "twitter-data", label: "Twitter data model", diagramType: "entity-relationship", level: "entity-relationship", prompt: "Entity-relationship diagram for a Twitter-like app: Users, Tweets, Follows, Likes, Retweets, Replies, Hashtags, Mentions.", isTemplate: false, sortOrder: 15 },
  { name: "support-call-flow", label: "Support desk call flow", diagramType: "flowchart", level: "flows", prompt: "Flowchart for support desk: Call received → IVR menu → Route to queue → Agent picks up → Diagnose → Resolve or Escalate → Log ticket → Follow-up → Close.", isTemplate: false, sortOrder: 16 },
  { name: "puppy-training", label: "Puppy training user journey", diagramType: "flowchart", level: "high-level-flow", prompt: "User journey flowchart for a puppy training platform: Sign up → Choose program (self or trainer-led) → Onboarding → Daily lessons → Progress tracking → Completion and certificate.", isTemplate: false, sortOrder: 17 },
  { name: "oauth2-sequence", label: "OAuth2 sequence", diagramType: "sequence", level: "sequence", prompt: "Sequence diagram for OAuth2: User, App, Auth Server. Request auth, redirect to login, return code, exchange code for token.", isTemplate: false, sortOrder: 18 },
  { name: "api-request-sequence", label: "API request sequence", diagramType: "sequence", level: "sequence", prompt: "Sequence diagram: Client → API Gateway → Auth → Service → DB. Request, validate, forward, query, response.", isTemplate: false, sortOrder: 19 },
  { name: "order-approval-bpmn", label: "Order approval (BPMN)", diagramType: "bpmn", level: "bpmn", prompt: "BPMN: Start → Submit order → Gateway (amount > 500?) → Auto approve or Manager approval → Join → Fulfill → End.", isTemplate: false, sortOrder: 20 },
  { name: "support-ticket-bpmn", label: "Support ticket (BPMN)", diagramType: "bpmn", level: "bpmn", prompt: "BPMN: Create ticket → Assign → Resolved? → Close or Escalate.", isTemplate: false, sortOrder: 21 },
  { name: "simple-3-tier", label: "Simple 3-tier architecture", diagramType: "architecture", level: "high-level-diagram", prompt: "Three tiers: User → Web Server → API Server → Database.", isTemplate: false, sortOrder: 22 },
  { name: "serverless-api", label: "Serverless API architecture", diagramType: "architecture", level: "high-level-system-design", prompt: "Serverless: Client → CloudFront → API Gateway → Lambda → DynamoDB.", isTemplate: false, sortOrder: 23 },
];

/** Templates for sidebar: use existing diagram data where slug matches, else empty; prompt can be empty (user refines). */
const TEMPLATES: PresetDef[] = [
  { name: "template-ecommerce-full-scale", label: "E-commerce full system", diagramType: "architecture", level: "high-level-system-design", prompt: "Full-scale e-commerce: microservices, Kafka, S3, auth, DevOps.", isTemplate: true, sortOrder: 1 },
  { name: "template-auth-oauth2-jwt-full", label: "OAuth2/JWT auth flow", diagramType: "flowchart", level: "flows", prompt: "OAuth2/JWT auth: login, tokens, refresh, validation.", isTemplate: true, sortOrder: 2 },
  { name: "template-stripe-payment-advanced", label: "Stripe payment (advanced)", diagramType: "flowchart", level: "flows", prompt: "Stripe with idempotency and webhooks.", isTemplate: true, sortOrder: 3 },
  { name: "template-kafka-event-flow", label: "Kafka event flow", diagramType: "architecture", level: "high-level-system-design", prompt: "Kafka topics and event flow between services.", isTemplate: true, sortOrder: 4 },
  { name: "template-ci-cd-advanced", label: "CI/CD (GitHub Actions, K8s)", diagramType: "flowchart", level: "flows", prompt: "CI/CD with staging, approval, rollback.", isTemplate: true, sortOrder: 5 },
  { name: "template-auth0-flow", label: "Auth0 login flow", diagramType: "flowchart", level: "high-level-flow", prompt: "", isTemplate: true, sortOrder: 6 },
  { name: "template-stripe-payment", label: "Stripe payment flow", diagramType: "flowchart", level: "flows", prompt: "", isTemplate: true, sortOrder: 7 },
  { name: "template-simple-3-tier", label: "3-tier architecture", diagramType: "architecture", level: "high-level-system-design", prompt: "", isTemplate: true, sortOrder: 8 },
  { name: "template-ecommerce-sql", label: "eCommerce ER diagram", diagramType: "entity-relationship", level: "entity-relationship", prompt: "", isTemplate: true, sortOrder: 9 },
];

async function main() {
  const dbUrl = process.env.DATABASE_URL || "";
  if (!dbUrl || dbUrl.includes("@host/") || dbUrl.includes("user:pass@")) {
    console.error("DATABASE_URL is missing or still a placeholder. Set it in .env to your Neon connection string.");
    process.exit(1);
  }
  const { db } = await import("../src/db");
  const existing = await db.select({ id: diagramPresets.id, name: diagramPresets.name }).from(diagramPresets);
  const byName = new Map(existing.map((r) => [r.name, r.id]));

  for (const p of PRESETS) {
    const diagram = getPresetDiagram(p.name);
    const nodes = diagram?.nodes ?? [];
    const edges = diagram?.edges ?? [];
    const row = {
      name: p.name,
      label: p.label,
      description: p.description ?? null,
      diagramType: p.diagramType,
      level: p.level,
      nodes,
      edges,
      prompt: p.prompt,
      isTemplate: false,
      sortOrder: p.sortOrder,
      previewImageUrl: getPresetPreviewUrl(p.name, p.label),
    };
    const id = byName.get(p.name);
    if (id) {
      await db.update(diagramPresets).set({ ...row, updatedAt: new Date() }).where(eq(diagramPresets.id, id));
    } else {
      await db.insert(diagramPresets).values(row);
    }
  }
  for (const t of TEMPLATES) {
    const slug = t.name.replace("template-", "");
    const diagram = getPresetDiagram(slug);
    const nodes = diagram?.nodes ?? [];
    const edges = diagram?.edges ?? [];
    const row = {
      name: t.name,
      label: t.label,
      description: t.description ?? null,
      diagramType: t.diagramType,
      level: t.level,
      nodes,
      edges,
      prompt: t.prompt || null,
      isTemplate: true,
      sortOrder: t.sortOrder,
      previewImageUrl: getPresetPreviewUrl(t.name, t.label),
    };
    const id = byName.get(t.name);
    if (id) {
      await db.update(diagramPresets).set({ ...row, updatedAt: new Date() }).where(eq(diagramPresets.id, id));
    } else {
      await db.insert(diagramPresets).values(row);
    }
  }
  console.log("Presets and templates seeded.");
}

main().catch((e: unknown) => {
  const err = e as { message?: string; cause?: { message?: string; code?: string } };
  console.error(err.message ?? e);
  if (err.cause) console.error("Cause:", err.cause.message ?? err.cause.code ?? err.cause);
  console.error("\nIf DATABASE_URL is correct, check: (1) Neon project not paused (open Neon dashboard); (2) try removing &channel_binding=require from the URL.");
  process.exit(1);
});
