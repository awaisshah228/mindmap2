import { clerkMiddleware } from "@clerk/nextjs/server";

// All routes are reachable; APIs that need auth check auth() and return 401
export default clerkMiddleware();

export const config = {
  matcher: ["/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ico|woff2?|map)).*)", "/(api|trpc)(.*)"],
};
