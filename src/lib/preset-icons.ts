/**
 * Technology icon URLs (Simple Icons CDN) and preset preview URLs.
 * Use in preset diagram nodes (data.iconUrl) and preset cards (previewImageUrl).
 * Format: https://cdn.simpleicons.org/<slug>/<hex>
 */

const BASE = "https://cdn.simpleicons.org";

export function getTechIconUrl(slug: string, color?: string): string {
  const hex = color ?? "6366f1";
  return `${BASE}/${slug}/${hex.replace("#", "")}`;
}

/** Technology slug -> full icon URL for use in nodes */
export const TECH_ICON_URLS: Record<string, string> = {
  amazonaws: getTechIconUrl("amazonaws", "FF9900"),
  auth0: getTechIconUrl("auth0", "EB5424"),
  stripe: getTechIconUrl("stripe", "635BFF"),
  docker: getTechIconUrl("docker", "2496ED"),
  kubernetes: getTechIconUrl("kubernetes", "326CE5"),
  kafka: getTechIconUrl("apachekafka", "231F20"),
  postgresql: getTechIconUrl("postgresql", "4169E1"),
  redis: getTechIconUrl("redis", "DC382D"),
  react: getTechIconUrl("react", "61DAFB"),
  nodedotjs: getTechIconUrl("nodedotjs", "339933"),
  github: getTechIconUrl("github", "181717"),
  graphql: getTechIconUrl("graphql", "E10098"),
  nginx: getTechIconUrl("nginx", "009639"),
  python: getTechIconUrl("python", "3776AB"),
  mongodb: getTechIconUrl("mongodb", "47A248"),
  express: getTechIconUrl("express", "000000"),
  nextdotjs: getTechIconUrl("nextdotjs", "000000"),
  typescript: getTechIconUrl("typescript", "3178C6"),
  go: getTechIconUrl("go", "00ADD8"),
  elasticsearch: getTechIconUrl("elasticsearch", "005571"),
  slack: getTechIconUrl("slack", "4A154B"),
};

/** Preset/template name -> preview image URL (icon or placeholder) */
export function getPresetPreviewUrl(name: string, label?: string): string {
  const slug = PRESET_PREVIEW_SLUGS[name];
  if (slug) return getTechIconUrl(slug, "6366f1");
  const text = (label ?? name).replace(/[^a-zA-Z0-9]+/g, "+").slice(0, 20);
  return `https://placehold.co/160x120/6366f1/white?text=${encodeURIComponent(text)}`;
}

const PRESET_PREVIEW_SLUGS: Record<string, string> = {
  "our-website-ai-diagram-app": "nextdotjs",
  "template-our-website-ai-diagram-app": "nextdotjs",
  "ecommerce-full-scale": "amazonaws",
  "ecommerce-mern-aws": "amazonaws",
  "auth-oauth2-jwt-full": "auth0",
  "auth0-flow": "auth0",
  "stripe-payment-advanced": "stripe",
  "stripe-payment": "stripe",
  "kafka-event-flow": "apachekafka",
  "product-microservices": "docker",
  "ci-cd-advanced": "github",
  "ci-cd-pipeline": "github",
  "chatbot-arch": "react",
  "gig-marketplace": "amazonaws",
  "saas-multi-tenant": "amazonaws",
  "ecommerce-sql": "postgresql",
  "twitter-data": "react",
  "support-call-flow": "slack",
  "puppy-training": "react",
  "oauth2-sequence": "auth0",
  "api-request-sequence": "nginx",
  "order-approval-bpmn": "stripe",
  "support-ticket-bpmn": "slack",
  "simple-3-tier": "nginx",
  "serverless-api": "amazonaws",
  "template-ecommerce-full-scale": "amazonaws",
  "template-auth-oauth2-jwt-full": "auth0",
  "template-stripe-payment-advanced": "stripe",
  "template-kafka-event-flow": "apachekafka",
  "template-ci-cd-advanced": "github",
  "template-auth0-flow": "auth0",
  "template-stripe-payment": "stripe",
  "template-simple-3-tier": "nginx",
  "template-ecommerce-sql": "postgresql",
};
