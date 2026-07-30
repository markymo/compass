import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isNonProductionEnv, isDevSubdomain } from "../env";

describe("env detection helpers", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("isNonProductionEnv", () => {
    it("detects non-production when host is dev.onpro.tech", () => {
      expect(isNonProductionEnv("dev.onpro.tech")).toBe(true);
      expect(isNonProductionEnv("dev.onpro.tech:3000")).toBe(true);
    });

    it("detects non-production when host is localhost or 127.0.0.1", () => {
      expect(isNonProductionEnv("localhost:3000")).toBe(true);
      expect(isNonProductionEnv("127.0.0.1")).toBe(true);
    });

    it("detects non-production when host is vercel preview", () => {
      expect(isNonProductionEnv("my-app-branch.vercel.app")).toBe(true);
    });

    it("returns false for production host onpro.tech or app.onpro.tech when env is production", () => {
      process.env.NODE_ENV = "production";
      delete process.env.NEXT_PUBLIC_APP_ENV;
      delete process.env.APP_ENV;
      expect(isNonProductionEnv("onpro.tech")).toBe(false);
      expect(isNonProductionEnv("app.onpro.tech")).toBe(false);
      expect(isNonProductionEnv("www.onpro.tech")).toBe(false);
    });

    it("detects non-production based on APP_ENV or NEXT_PUBLIC_APP_ENV", () => {
      process.env.NODE_ENV = "production";
      process.env.NEXT_PUBLIC_APP_ENV = "staging";
      expect(isNonProductionEnv("onpro.tech")).toBe(true);

      process.env.NEXT_PUBLIC_APP_ENV = "dev";
      expect(isNonProductionEnv("onpro.tech")).toBe(true);
    });
  });

  describe("isDevSubdomain", () => {
    it("returns true for dev.onpro.tech, staging, and local", () => {
      expect(isDevSubdomain("dev.onpro.tech")).toBe(true);
      expect(isDevSubdomain("staging.onpro.tech")).toBe(true);
      expect(isDevSubdomain("localhost:3000")).toBe(true);
    });

    it("returns false for production hosts", () => {
      expect(isDevSubdomain("onpro.tech")).toBe(false);
      expect(isDevSubdomain("app.onpro.tech")).toBe(false);
    });
  });
});
