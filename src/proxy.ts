import { NextResponse } from "next/server";
import NextAuth from "next-auth";
import authConfig from "./auth.config";
import { isNonProductionEnv } from "@/lib/env";

const { auth } = NextAuth(authConfig);

const PUBLIC_PATH_PREFIXES = [
  "/login",
  "/invite",
  "/how-it-works",
  "/partner",
  "/about",
  "/privacy",
  "/terms",
  "/contact",
  "/why-onpro",
  "/api",
];

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

  // Step 2: NextAuth Authentication check for protected routes
  const pathname = req.nextUrl.pathname;
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
