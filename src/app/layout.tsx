import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { JsonLd } from "@/components/seo/JsonLd";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteName = "AI Diagram";
const defaultTitle = "Smart diagrams from text";
const defaultDescription =
  "Generate architecture diagrams, mind maps, flowcharts, and Excalidraw sketches with AI. Describe your idea in text and get a diagram in seconds. Free trial, then simple plans.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://ai-diagram.app"),
  title: {
    default: `${siteName} – ${defaultTitle}`,
    template: `%s | ${siteName}`,
  },
  description: defaultDescription,
  keywords: [
    "AI diagram",
    "diagram generator",
    "flowchart",
    "mind map",
    "architecture diagram",
    "Excalidraw",
    "draw.io",
    "Mermaid",
    "AI drawing",
  ],
  authors: [{ name: siteName }],
  creator: siteName,
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName,
    title: defaultTitle,
    description: defaultDescription,
  },
  twitter: {
    card: "summary_large_image",
    title: defaultTitle,
    description: defaultDescription,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        >
          <JsonLd />
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}

