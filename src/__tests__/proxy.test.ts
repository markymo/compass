import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "../proxy";

const GATED_MARKETING_ROUTES = [
  "/about",
  "/contact",
  "/how-it-works",
  "/partner",
  "/privacy",
  "/terms",
  "/why-onpro",
  "/logo-preview",
];

describe("Proxy - Authentication, Route Guards & Public Site Feature Flag", () => {
  beforeEach(() => {
    process.env.AUTH_SECRET = "test-auth-secret-key-123456789";
  });

  afterEach(() => {
    delete process.env.ENABLE_PUBLIC_SITE;
    delete process.env.NEXT_PUBLIC_ENABLE_PUBLIC_SITE;
    delete process.env.DEV_BASIC_AUTH_ENABLED;
    delete process.env.DEV_BASIC_AUTH_USER;
    delete process.env.DEV_BASIC_AUTH_PASSWORD;
  });

  describe("When ENABLE_PUBLIC_SITE is false / unset (Public Pages Gated)", () => {
    it("rewrites / to /coming-soon", async () => {
      const req = new NextRequest("http://dev.onpro.tech/", {
        headers: { host: "dev.onpro.tech" },
      });

      const res = await (proxy as any)(req, {});
      expect(res?.status).toBe(200);
      expect(res?.headers?.get("x-middleware-rewrite")).toContain("/coming-soon");
    });

    it.each(GATED_MARKETING_ROUTES)(
      "redirects marketing route %s to /coming-soon",
      async (route) => {
        const req = new NextRequest(`http://dev.onpro.tech${route}`, {
          headers: { host: "dev.onpro.tech" },
        });

        const res = await (proxy as any)(req, {});
        expect(res?.status).toBe(307);
        expect(res?.headers?.get("location")).toContain("/coming-soon");
      }
    );

    it("allows direct access to /login", async () => {
      const req = new NextRequest("http://dev.onpro.tech/login", {
        headers: { host: "dev.onpro.tech" },
      });

      const res = await (proxy as any)(req, {});
      expect(res?.status).toBe(200);
    });

    it("allows direct access to /coming-soon", async () => {
      const req = new NextRequest("http://dev.onpro.tech/coming-soon", {
        headers: { host: "dev.onpro.tech" },
      });

      const res = await (proxy as any)(req, {});
      expect(res?.status).toBe(200);
      expect(res?.headers?.get("X-Robots-Tag")).toBe("noindex, nofollow, noarchive");
    });

    it("redirects unauthenticated users visiting /app/dashboard to /login", async () => {
      const req = new NextRequest("http://dev.onpro.tech/app/dashboard", {
        headers: { host: "dev.onpro.tech" },
      });

      const res = await (proxy as any)(req, {});
      expect(res?.status).toBe(307);
      expect(res?.headers?.get("location")).toContain("/login");
    });
  });

  describe("When ENABLE_PUBLIC_SITE=true (Public Pages Open)", () => {
    beforeEach(() => {
      process.env.ENABLE_PUBLIC_SITE = "true";
    });

    it("allows direct access to / without rewrite", async () => {
      const req = new NextRequest("http://dev.onpro.tech/", {
        headers: { host: "dev.onpro.tech" },
      });

      const res = await (proxy as any)(req, {});
      expect(res?.status).toBe(200);
      expect(res?.headers?.get("x-middleware-rewrite")).toBeNull();
    });

    it.each(GATED_MARKETING_ROUTES)(
      "allows access to marketing route %s",
      async (route) => {
        const req = new NextRequest(`http://dev.onpro.tech${route}`, {
          headers: { host: "dev.onpro.tech" },
        });

        const res = await (proxy as any)(req, {});
        expect(res?.status).toBe(200);
        expect(res?.headers?.get("X-Robots-Tag")).toBe("noindex, nofollow, noarchive");
      }
    );

    it("allows direct access to /login", async () => {
      const req = new NextRequest("http://dev.onpro.tech/login", {
        headers: { host: "dev.onpro.tech" },
      });

      const res = await (proxy as any)(req, {});
      expect(res?.status).toBe(200);
    });

    it("STILL redirects unauthenticated users visiting /app/dashboard to /login (authorization preserved)", async () => {
      const req = new NextRequest("http://dev.onpro.tech/app/dashboard", {
        headers: { host: "dev.onpro.tech" },
      });

      const res = await (proxy as any)(req, {});
      expect(res?.status).toBe(307);
      expect(res?.headers?.get("location")).toContain("/login");
    });
  });

  describe("Basic Auth & Production Environment Security", () => {
    it("does not add X-Robots-Tag header on production domain when NODE_ENV is production", async () => {
      const origEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";
      process.env.ENABLE_PUBLIC_SITE = "true";
      delete process.env.NEXT_PUBLIC_APP_ENV;
      delete process.env.APP_ENV;

      const req = new NextRequest("https://onpro.tech/about", {
        headers: { host: "onpro.tech" },
      });

      const res = await (proxy as any)(req, {});
      expect(res?.headers?.get("X-Robots-Tag")).toBeNull();

      process.env.NODE_ENV = origEnv;
    });

    it("triggers 401 Basic Auth challenge when DEV_BASIC_AUTH_ENABLED=true without auth header", async () => {
      process.env.DEV_BASIC_AUTH_ENABLED = "true";

      const req = new NextRequest("http://dev.onpro.tech/coming-soon", {
        headers: { host: "dev.onpro.tech" },
      });

      const res = await (proxy as any)(req, {});
      expect(res?.status).toBe(401);
      expect(res?.headers?.get("WWW-Authenticate")).toContain("Basic realm=");
      expect(res?.headers?.get("X-Robots-Tag")).toBe("noindex, nofollow, noarchive");
    });

    it("allows access when valid basic auth credentials are provided", async () => {
      process.env.DEV_BASIC_AUTH_ENABLED = "true";
      process.env.DEV_BASIC_AUTH_USER = "admin";
      process.env.DEV_BASIC_AUTH_PASSWORD = "secretpassword";
      process.env.ENABLE_PUBLIC_SITE = "true";

      const credentials = btoa("admin:secretpassword");
      const req = new NextRequest("http://dev.onpro.tech/about", {
        headers: {
          host: "dev.onpro.tech",
          authorization: `Basic ${credentials}`,
        },
      });

      const res = await (proxy as any)(req, {});
      expect(res?.status).toBe(200);
    });
  });
});
