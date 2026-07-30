import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isNonProductionEnv } from "@/lib/env";

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const host = request.headers.get("host") || "";

  // Step 1: Enforce X-Robots-Tag header across all responses in non-production environments
  if (isNonProductionEnv(host)) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  }

  // Step 2: Optional HTTP Basic Authentication Route Guard
  const basicAuthEnabled =
    process.env.DEV_BASIC_AUTH_ENABLED === "true" ||
    process.env.BASIC_AUTH_ENABLED === "true";

  if (basicAuthEnabled && isNonProductionEnv(host)) {
    const authHeader = request.headers.get("authorization");

    if (authHeader) {
      const authValue = authHeader.split(" ")[1];
      try {
        const [user, pwd] = atob(authValue).split(":");
        const expectedUser = process.env.DEV_BASIC_AUTH_USER || "dev";
        const expectedPassword = process.env.DEV_BASIC_AUTH_PASSWORD || "coparity-dev";

        if (user === expectedUser && pwd === expectedPassword) {
          return response;
        }
      } catch (e) {
        // Invalid base64 or auth format - fall through to 401
      }
    }

    return new NextResponse("Authentication required", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="Dev Environment Access Restricted"',
        ...(isNonProductionEnv(host) ? { "X-Robots-Tag": "noindex, nofollow, noarchive" } : {}),
      },
    });
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, favicon.svg, icon.svg, etc. (favicon files)
     * - public media/static assets (.svg, .png, .jpg, .jpeg, .gif, .webp, .ico, .css, .js, .woff, .woff2)
     */
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2)$).*)",
  ],
};
