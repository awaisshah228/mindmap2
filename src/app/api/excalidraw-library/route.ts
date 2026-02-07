/**
 * Server-side fetch of Excalidraw library from URL.
 * Avoids CORS when loading from raw.githubusercontent.com or api.libraries.excalidraw.com.
 */
import { NextRequest, NextResponse } from "next/server";

const ALLOWED_HOSTS = [
  "raw.githubusercontent.com",
  "api.libraries.excalidraw.com",
  "libraries.excalidraw.com",
  "cdn.jsdelivr.net",
  "fastly.jsdelivr.net",
  "unpkg.com",
  "github.com",
];

function isAllowedUrl(urlStr: string): boolean {
  try {
    const u = new URL(urlStr);
    return ALLOWED_HOSTS.some((h) => u.hostname === h || u.hostname.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  if (!isAllowedUrl(url)) {
    return NextResponse.json(
      { error: "URL not allowed. Use raw.githubusercontent.com, api.libraries.excalidraw.com, jsdelivr, or unpkg." },
      { status: 400 }
    );
  }

  // libraries.excalidraw.com/libraries/owner/name.excalidrawlib → raw GitHub (repo has libraries/ folder)
  let fetchUrl = url;
  try {
    const u = new URL(url);
    // Ensure https (in case URL came with http)
    if (u.protocol === "http:") {
      u.protocol = "https:";
      fetchUrl = u.toString();
    }
    if (u.hostname === "libraries.excalidraw.com" && u.pathname.startsWith("/libraries/")) {
      const path = u.pathname.replace(/^\//, ""); // keep "libraries/owner/name.excalidrawlib"
      fetchUrl = `https://raw.githubusercontent.com/excalidraw/excalidraw-libraries/main/${path}`;
    }
  } catch {
    // use original url
  }

  try {
    const res = await fetch(fetchUrl, {
      headers: { Accept: "application/json" },
      next: { revalidate: 3600 },
    });
    if (!res.ok) {
      return NextResponse.json({ error: `Fetch failed: ${res.status}` }, { status: res.status });
    }
    const data = (await res.json()) as unknown;
    return NextResponse.json(data);
  } catch (err) {
    console.error("[excalidraw-library] Fetch error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch library" },
      { status: 500 }
    );
  }
}
