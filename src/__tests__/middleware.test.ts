import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "../middleware";

describe("Middleware - Search engine indexing protection & route guard", () => {
  it("adds X-Robots-Tag header on dev.onpro.tech subdomain", () => {
    const req = new NextRequest("http://dev.onpro.tech/dashboard", {
      headers: { host: "dev.onpro.tech" },
    });

    const res = middleware(req);
    expect(res.headers.get("X-Robots-Tag")).toBe("noindex, nofollow, noarchive");
    expect(res.status).toBe(200);
  });

  it("adds X-Robots-Tag header on localhost", () => {
    const req = new NextRequest("http://localhost:3000/app", {
      headers: { host: "localhost:3000" },
    });

    const res = middleware(req);
    expect(res.headers.get("X-Robots-Tag")).toBe("noindex, nofollow, noarchive");
    expect(res.status).toBe(200);
  });

  it("does not add X-Robots-Tag header on production domain when NODE_ENV is production", () => {
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    delete process.env.NEXT_PUBLIC_APP_ENV;
    delete process.env.APP_ENV;

    const req = new NextRequest("https://onpro.tech/about", {
      headers: { host: "onpro.tech" },
    });

    const res = middleware(req);
    expect(res.headers.get("X-Robots-Tag")).toBeNull();

    process.env.NODE_ENV = origEnv;
  });

  it("triggers 401 Basic Auth challenge when DEV_BASIC_AUTH_ENABLED=true without auth header", () => {
    process.env.DEV_BASIC_AUTH_ENABLED = "true";

    const req = new NextRequest("http://dev.onpro.tech/protected", {
      headers: { host: "dev.onpro.tech" },
    });

    const res = middleware(req);
    expect(res.status).toBe(401);
    expect(res.headers.get("WWW-Authenticate")).toContain("Basic realm=");
    expect(res.headers.get("X-Robots-Tag")).toBe("noindex, nofollow, noarchive");

    delete process.env.DEV_BASIC_AUTH_ENABLED;
  });

  it("allows access when valid basic auth credentials are provided", () => {
    process.env.DEV_BASIC_AUTH_ENABLED = "true";
    process.env.DEV_BASIC_AUTH_USER = "admin";
    process.env.DEV_BASIC_AUTH_PASSWORD = "secretpassword";

    const credentials = btoa("admin:secretpassword");
    const req = new NextRequest("http://dev.onpro.tech/protected", {
      headers: {
        host: "dev.onpro.tech",
        authorization: `Basic ${credentials}`,
      },
    });

    const res = middleware(req);
    expect(res.status).toBe(200);

    delete process.env.DEV_BASIC_AUTH_ENABLED;
    delete process.env.DEV_BASIC_AUTH_USER;
    delete process.env.DEV_BASIC_AUTH_PASSWORD;
  });
});
