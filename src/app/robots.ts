import type { MetadataRoute } from "next";

const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://ai-diagram.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/api/", "/admin", "/sign-in", "/sign-up"] },
      { userAgent: "Googlebot", allow: "/", disallow: ["/api/", "/admin", "/sign-in", "/sign-up"] },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
