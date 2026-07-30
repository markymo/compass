import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "../proxy";

describe("Proxy - Search engine indexing protection & route guard", () => {
  beforeEach(() => {
    process.env.AUTH_SECRET = "test-auth-secret-key-123456789";
  });

  it("adds X-Robots-Tag header on dev.onpro.tech subdomain for public route", async () => {
    const req = new NextRequest("http://dev.onpro.tech/about", {
      headers: { host: "dev.onpro.tech" },
    });

    const res = await (proxy as any)(req, {});
    expect(res?.headers?.get("X-Robots-Tag")).toBe("noindex, nofollow, noarchive");
    expect(res?.status).toBe(200);
  });

  it("adds X-Robots-Tag header on localhost", async () => {
    const req = new NextRequest("http://localhost:3000/about", {
      headers: { host: "localhost:3000" },
    });

    const res = await (proxy as any)(req, {});
    expect(res?.headers?.get("X-Robots-Tag")).toBe("noindex, nofollow, noarchive");
    expect(res?.status).toBe(200);
  });

  it("does not add X-Robots-Tag header on production domain when NODE_ENV is production", async () => {
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
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

    const req = new NextRequest("http://dev.onpro.tech/about", {
      headers: { host: "dev.onpro.tech" },
    });

    const res = await (proxy as any)(req, {});
    expect(res?.status).toBe(401);
    expect(res?.headers?.get("WWW-Authenticate")).toContain("Basic realm=");
    expect(res?.headers?.get("X-Robots-Tag")).toBe("noindex, nofollow, noarchive");

    delete process.env.DEV_BASIC_AUTH_ENABLED;
  });

  it("allows access when valid basic auth credentials are provided", async () => {
    process.env.DEV_BASIC_AUTH_ENABLED = "true";
    process.env.DEV_BASIC_AUTH_USER = "admin";
    process.env.DEV_BASIC_AUTH_PASSWORD = "secretpassword";

    const credentials = btoa("admin:secretpassword");
    const req = new NextRequest("http://dev.onpro.tech/about", {
      headers: {
        host: "dev.onpro.tech",
        authorization: `Basic ${credentials}`,
      },
    });

    const res = await (proxy as any)(req, {});
    expect(res?.status).toBe(200);

    delete process.env.DEV_BASIC_AUTH_ENABLED;
    delete process.env.DEV_BASIC_AUTH_USER;
    delete process.env.DEV_BASIC_AUTH_PASSWORD;
  });

  it("redirects unauthenticated users to /login on protected routes", async () => {
    const req = new NextRequest("http://dev.onpro.tech/app/dashboard", {
      headers: { host: "dev.onpro.tech" },
    });

    const res = await (proxy as any)(req, {});
    expect(res?.status).toBe(307);
    expect(res?.headers?.get("location")).toContain("/login");
    expect(res?.headers?.get("X-Robots-Tag")).toBe("noindex, nofollow, noarchive");
  });
});
