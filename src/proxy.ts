import { NextResponse } from "next/server";
import NextAuth from "next-auth";
import authConfig from "./auth.config";
import { isNonProductionEnv, isPublicSiteEnabled } from "@/lib/env";

const { auth } = NextAuth(authConfig);

const PUBLIC_PATH_PREFIXES = [
  "/login",
  "/invite",
  "/coming-soon",
  "/how-it-works",
  "/partner",
  "/about",
  "/privacy",
  "/terms",
  "/contact",
  "/why-onpro",
  "/logo-preview",
  "/api",
];

const MARKETING_SITE_ROUTES = [
  "/",
  "/about",
  "/contact",
  "/how-it-works",
  "/partner",
  "/privacy",
  "/terms",
  "/why-onpro",
  "/logo-preview",
];

function isMarketingRoute(pathname: string): boolean {
  if (pathname === "/") return true;
  return MARKETING_SITE_ROUTES.some(
    (prefix) => prefix !== "/" && (pathname === prefix || pathname.startsWith(`${prefix}/`))
  );
}

function isPublicRoute(pathname: string): boolean {
  if (pathname === "/") return true;
  return PUBLIC_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export const proxy = auth((req) => {
  const host = req.headers.get("host") || "";
  const isNonProd = isNonProductionEnv(host);

  // Step 1: Optional HTTP Basic Authentication Route Guard
  const basicAuthEnabled =
    process.env.DEV_BASIC_AUTH_ENABLED === "true" ||
    process.env.BASIC_AUTH_ENABLED === "true";

  if (basicAuthEnabled && isNonProd) {
    const authHeader = req.headers.get("authorization");

    if (authHeader) {
      const authValue = authHeader.split(" ")[1];
      try {
        const [user, pwd] = atob(authValue).split(":");
        const expectedUser = process.env.DEV_BASIC_AUTH_USER || "dev";
        const expectedPassword =
          process.env.DEV_BASIC_AUTH_PASSWORD || "coparity-dev";

        if (user !== expectedUser || pwd !== expectedPassword) {
          return new NextResponse("Authentication required", {
            status: 401,
            headers: {
              "WWW-Authenticate": 'Basic realm="Dev Environment Access Restricted"',
              ...(isNonProd ? { "X-Robots-Tag": "noindex, nofollow, noarchive" } : {}),
            },
          });
        }
      } catch (e) {
        return new NextResponse("Authentication required", {
          status: 401,
          headers: {
            "WWW-Authenticate": 'Basic realm="Dev Environment Access Restricted"',
            ...(isNonProd ? { "X-Robots-Tag": "noindex, nofollow, noarchive" } : {}),
          },
        });
      }
    } else {
      return new NextResponse("Authentication required", {
        status: 401,
        headers: {
          "WWW-Authenticate": 'Basic realm="Dev Environment Access Restricted"',
          ...(isNonProd ? { "X-Robots-Tag": "noindex, nofollow, noarchive" } : {}),
        },
      });
    }
  }

  const pathname = req.nextUrl.pathname;
  const publicSiteEnabled = isPublicSiteEnabled();

  // Step 1.5: If public marketing site is disabled, redirect/rewrite public marketing routes to /coming-soon
  if (!publicSiteEnabled && isMarketingRoute(pathname) && pathname !== "/coming-soon") {
    const comingSoonUrl = new URL("/coming-soon", req.nextUrl.origin);
    if (pathname === "/") {
      const rewriteRes = NextResponse.rewrite(comingSoonUrl);
      if (isNonProd) {
        rewriteRes.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
      }
      return rewriteRes;
    } else {
      const redirectRes = NextResponse.redirect(comingSoonUrl);
      if (isNonProd) {
        redirectRes.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
      }
      return redirectRes;
    }
  }

  // Step 2: NextAuth Authentication check for protected routes
  if (!req.auth && !isPublicRoute(pathname)) {
    const newUrl = new URL("/login", req.nextUrl.origin);
    const redirectRes = NextResponse.redirect(newUrl);
    if (isNonProd) {
      redirectRes.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    }
    return redirectRes;
  }

  // Step 3: Default response with X-Robots-Tag if non-production
  const response = NextResponse.next();
  if (isNonProd) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  }
  return response;
});


export default proxy;

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2)$).*)",
  ],
};
