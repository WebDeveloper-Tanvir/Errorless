// middleware.ts  (root of project, alongside package.json)
//
// Clerk middleware — protects authenticated routes.
// Public routes (login, signup, home, sso-callback) are accessible without auth.
// Everything else requires a signed-in session.

import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"

const isPublicRoute = createRouteMatcher([
  "/",
  "/login(.*)",
  "/signup(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/auth(.*)",
  "/sso-callback(.*)",
  "/pricing(.*)",
  "/docs(.*)",
  "/demo(.*)",
  "/tools(.*)",              // public SEO tool pages
  "/community(.*)",          // hand-written public examples
  "/s/(.*)",                 // shared results: access is the unguessable token
  "/api/growth/feedback",    // guest helpful / not helpful
  "/sitemap.xml",            // crawlers must reach these without a session
  "/robots.txt",
  "/opengraph-image(.*)",
  "/twitter-image(.*)",
  "/learn(.*)",
  "/ide-runtime(.*)",        // static Python/TypeScript runtimes, fetched by the sandboxed frame (no session)
  "/api/webhooks/(.*)",   // Clerk webhook must be public
])

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect()
  }
})

export const config = {
  matcher: [
    // Run on all routes except static files and Next.js internals
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
}