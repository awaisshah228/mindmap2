/**
 * Seed diagram_presets with prompts only. Diagram data is generated on first use via AI and saved to preset.
 * Uses the same db as the app (src/db — Neon serverless).
 *
 * Run: yarn seed   or   yarn db:seed   or   npx tsx scripts/seed-presets.ts
 */
import "dotenv/config";
import { diagramPresets } from "../src/db/schema";
import { eq } from "drizzle-orm";
import { getPresetPreviewUrl } from "../src/lib/preset-icons";
import { TEMPLATE_DIAGRAM_DATA } from "../src/lib/template-diagram-data";

type PresetDef = {
  name: string;
  label: string;
  description?: string;
  diagramType: string;
  level: string;
  prompt: string;
  isTemplate: boolean;
  sortOrder: number;
  targetCanvas?: "reactflow" | "excalidraw" | "drawio";
};

const PRESETS: PresetDef[] = [
  // —— Our website: AI Diagram App architecture (teaching/learning) ——
  {
    name: "our-website-ai-diagram-app",
    label: "Our website: AI Diagram App (Next.js, Clerk, S3, LangChain)",
    description: "Architecture of this app – Next.js 16, React Flow, Excalidraw, Draw.io, LangChain, Clerk, S3, Neon",
    diagramType: "architecture",
    level: "high-level-system-design",
    prompt: `Create an architecture diagram for this AI Diagram App (the website you're using). Show how we built it with modern APIs and popular SDKs. Include versions where relevant.

(1) **Frontend – Next.js 16 (App Router)**: Next.js 16.1, React 19, Tailwind 4, Radix UI, Lucide icons. Three canvas modes powered by popular diagram SDKs: (a) React Flow (@xyflow/react v12) – nodes, edges, mind maps, flowchart; (b) Excalidraw (@excalidraw/excalidraw v0.18) – hand-drawn style diagrams; (c) Draw.io (react-drawio v1) – professional diagrams. Pages: main editor, AI diagram generator.

(2) **Auth**: Clerk (@clerk/nextjs v6) for authentication, workspaces, protected routes.

(3) **APIs**: 
- /api/diagrams/generate – Vercel AI SDK (ai v4) + OpenAI
- /api/diagrams/langchain – LangChain (langchain v1.2, @langchain/openai) for streaming diagram generation
- /api/diagrams/generate-drawio, generate-excalidraw, generate-mermaid – LangChain ChatOpenAI for Draw.io/Excalidraw outputs
- /api/upload – S3 presigned URLs (@aws-sdk/client-s3 v3)
- /api/presets, /api/documents – CRUD

(4) **Database**: Neon PostgreSQL (@neondatabase/serverless) + Drizzle ORM (v0.38). Tables: documents, diagram_presets, user_files.

(5) **Storage**: AWS S3 for icons/images. @aws-sdk/s3-request-presigner.

(6) **AI – dual stack**: (a) Vercel AI SDK + OpenAI for React Flow diagrams; (b) LangChain (@langchain/core, @langchain/openai, @langchain/anthropic) for Excalidraw, Draw.io, Mermaid conversion. Both leverage LLMs for diagram generation.

(7) **State**: Zustand (v5) for canvas, undo/redo. LocalStorage when anonymous; API sync when authenticated.

Show: User → Next.js → Clerk → API routes → Neon / S3 / OpenAI+LangChain. Group by Frontend (React Flow, Excalidraw, Draw.io), Auth, API, Data, AI.`,
    isTemplate: false,
    sortOrder: 0,
  },
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

/** Draw.io presets: first use generates via AI, then saved to preset. */
const DRAWIO_PRESETS: PresetDef[] = [
  { name: "drawio-microservices-aws-kafka", label: "Draw.io: Microservices + AWS + Kafka", diagramType: "architecture", level: "high-level-system-design", prompt: "Create a complete microservices architecture diagram on AWS with Kafka. Include: User/Browser, CDN/CloudFront, Next.js frontend, API Gateway, Auth service, User service, Product Catalog, Order service, Payment (Stripe), Kafka message broker, PostgreSQL, Redis, S3. Show data flow with arrows: static assets through CDN, API requests through gateway to services, events published to Kafka, services consuming from Kafka. Use AWS colors: orange (#ff9900) for compute, green (#569a31) for storage, blue (#527bbb) for database. Left-to-right flow. Group by tier (frontend, API, services, data).", isTemplate: false, sortOrder: 100, targetCanvas: "drawio" },
  { name: "drawio-flowchart", label: "Draw.io: Flowchart", diagramType: "flowchart", level: "flows", prompt: "Create a flowchart for a typical user login process: start, input credentials, validate, success or error, redirect.", isTemplate: false, sortOrder: 101, targetCanvas: "drawio" },
  { name: "drawio-architecture", label: "Draw.io: System architecture", diagramType: "architecture", level: "high-level-diagram", prompt: "Create a system architecture diagram: client, API gateway, backend services, database. Use clear boxes and arrows.", isTemplate: false, sortOrder: 102, targetCanvas: "drawio" },
  { name: "drawio-process-flow", label: "Draw.io: Process flow", diagramType: "flowchart", level: "flows", prompt: "Create a business process flow: receive order, validate, payment, fulfillment, shipping, delivery.", isTemplate: false, sortOrder: 103, targetCanvas: "drawio" },
  { name: "drawio-uml", label: "Draw.io: UML class diagram", diagramType: "entity-relationship", level: "entity-relationship", prompt: "Create a UML class diagram for an e-commerce domain: User, Order, Product, Cart, Payment classes with relationships.", isTemplate: false, sortOrder: 104, targetCanvas: "drawio" },
  { name: "drawio-network", label: "Draw.io: Network diagram", diagramType: "architecture", level: "high-level-diagram", prompt: "Create a network diagram: router, switches, servers, firewall. Show connections and subnets.", isTemplate: false, sortOrder: 105, targetCanvas: "drawio" },
];

/** Excalidraw presets: first use generates via AI, then saved to preset. */
const EXCALIDRAW_PRESETS: PresetDef[] = [
  { name: "excalidraw-flowchart", label: "Excalidraw: Flowchart", diagramType: "flowchart", level: "flows", prompt: "Create a simple flowchart: start, steps, decision diamond, end. Use boxes and arrows.", isTemplate: false, sortOrder: 200, targetCanvas: "excalidraw" },
  { name: "excalidraw-architecture", label: "Excalidraw: Architecture", diagramType: "architecture", level: "high-level-diagram", prompt: "Create an architecture diagram: Frontend, API, Database, Cache. Use rectangles and connecting arrows.", isTemplate: false, sortOrder: 201, targetCanvas: "excalidraw" },
  { name: "excalidraw-mindmap", label: "Excalidraw: Mind map", diagramType: "mindmap", level: "mindmap", prompt: "Create a mind map with a central topic and 4-6 branches. Use boxes and curved connectors.", isTemplate: false, sortOrder: 202, targetCanvas: "excalidraw" },
  { name: "excalidraw-wireframe", label: "Excalidraw: Wireframe", diagramType: "architecture", level: "high-level-diagram", prompt: "Create a simple app wireframe: header, sidebar, main content area, footer.", isTemplate: false, sortOrder: 203, targetCanvas: "excalidraw" },
  { name: "excalidraw-sequence", label: "Excalidraw: Sequence", diagramType: "sequence", level: "sequence", prompt: "Create a sequence diagram: User, Frontend, API, Database. Show request/response arrows.", isTemplate: false, sortOrder: 204, targetCanvas: "excalidraw" },
];

/** Templates for sidebar: Our website template only (hardcoded diagram data for instant load). */
const TEMPLATES: PresetDef[] = [
  { name: "template-our-website-ai-diagram-app", label: "Our website: AI Diagram App", description: "Next.js 16, React Flow, Excalidraw, Draw.io, LangChain, Clerk, S3, Neon", diagramType: "architecture", level: "high-level-system-design", prompt: "Architecture of this AI Diagram App.", isTemplate: true, sortOrder: 0 },
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

  const allPresets = [...PRESETS, ...DRAWIO_PRESETS, ...EXCALIDRAW_PRESETS];
  for (const p of allPresets) {
    const metadata = {
      name: p.name,
      label: p.label,
      description: p.description ?? null,
      diagramType: p.diagramType,
      level: p.level,
      prompt: p.prompt,
      targetCanvas: p.targetCanvas ?? "reactflow",
      isTemplate: false,
      sortOrder: p.sortOrder,
      previewImageUrl: getPresetPreviewUrl(p.name, p.label),
      updatedAt: new Date(),
    };
    const id = byName.get(p.name);
    if (id) {
      // Update metadata only — preserve nodes, edges, drawioData, excalidrawData (first-use AI generation)
      await db.update(diagramPresets).set(metadata).where(eq(diagramPresets.id, id));
    } else {
      // Insert new preset: metadata only, no diagram data (seeded for first-time use)
      await db.insert(diagramPresets).values({
        ...metadata,
        nodes: [],
        edges: [],
      });
    }
  }
  for (const t of TEMPLATES) {
    const diagramData = TEMPLATE_DIAGRAM_DATA[t.name];
    const metadata = {
      name: t.name,
      label: t.label,
      description: t.description ?? null,
      diagramType: t.diagramType,
      level: t.level,
      prompt: t.prompt || null,
      targetCanvas: "reactflow" as const,
      isTemplate: true,
      sortOrder: t.sortOrder,
      previewImageUrl: getPresetPreviewUrl(t.name, t.label),
      updatedAt: new Date(),
    };
    const nodes = diagramData?.nodes ?? [];
    const edges = diagramData?.edges ?? [];
    const id = byName.get(t.name);
    if (id) {
      await db
        .update(diagramPresets)
        .set({ ...metadata, nodes, edges })
        .where(eq(diagramPresets.id, id));
    } else {
      await db.insert(diagramPresets).values({
        ...metadata,
        nodes,
        edges,
      });
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
