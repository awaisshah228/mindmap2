const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://ai-diagram.app";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "AI Diagram",
  description:
    "Generate architecture diagrams, mind maps, flowcharts, and Excalidraw sketches with AI. Describe your idea in text and get a diagram in seconds.",
  url: baseUrl,
  applicationCategory: "DesignApplication",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
};

export function JsonLd() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
