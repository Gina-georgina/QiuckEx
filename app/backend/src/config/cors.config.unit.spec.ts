import { buildCorsOptions, isCorsOriginAllowed } from "./cors.config";
import { CorsOptions } from "@nestjs/common/interfaces/external/cors-options.interface";

type OriginCallback = (err: Error | null, allow?: boolean) => void;
type OriginFn = (origin: string | undefined, cb: OriginCallback) => void;

function resolveOrigin(
  options: CorsOptions,
  origin: string | undefined,
): Promise<boolean> {
  return new Promise((resolve, reject) => {
    (options.origin as OriginFn)(origin, (err, allowed) => {
      if (err) reject(err);
      else resolve(!!allowed);
    });
  });
}

describe("buildCorsOptions", () => {
  describe("non-production", () => {
    it("does not allow arbitrary origins in development", async () => {
      const opts = buildCorsOptions({ nodeEnv: "development", allowedOrigins: [] });
      await expect(resolveOrigin(opts, "https://evil.com")).resolves.toBe(false);
    });

    it("does not allow arbitrary origins in test", async () => {
      const opts = buildCorsOptions({ nodeEnv: "test", allowedOrigins: [] });
      await expect(resolveOrigin(opts, "https://evil.com")).resolves.toBe(false);
    });
  });

  describe("production — static origins", () => {
    const opts = buildCorsOptions({
      nodeEnv: "production",
      allowedOrigins: ["https://partner.quickex.to"],
    });

    it("allows the built-in production origin", async () => {
      await expect(resolveOrigin(opts, "https://quickex.to")).resolves.toBe(true);
    });

    it("allows the built-in staging and local origins", async () => {
      await expect(resolveOrigin(opts, "https://staging.quickex.to")).resolves.toBe(true);
      await expect(resolveOrigin(opts, "http://localhost:3000")).resolves.toBe(true);
    });

    it("allows an origin added through configuration", async () => {
      await expect(resolveOrigin(opts, "https://partner.quickex.to")).resolves.toBe(true);
    });

    it("blocks an unlisted origin", async () => {
      await expect(resolveOrigin(opts, "https://evil.com")).resolves.toBe(false);
    });

    it("allows requests with no origin (server-to-server)", async () => {
      await expect(resolveOrigin(opts, undefined)).resolves.toBe(true);
    });
  });

  describe("production — Vercel preview URLs", () => {
    const opts = buildCorsOptions({
      nodeEnv: "production",
      allowedOrigins: ["https://quickex.to"],
      vercelProject: "quickex-frontend",
    });

    it("allows a valid Vercel preview URL", async () => {
      await expect(
        resolveOrigin(opts, "https://quickex-frontend-abc123-team.vercel.app"),
      ).resolves.toBe(true);
    });

    it("blocks a preview URL for a different project", async () => {
      await expect(
        resolveOrigin(opts, "https://other-project-abc123-team.vercel.app"),
      ).resolves.toBe(false);
    });

    it("blocks a URL that tries to spoof the project name", async () => {
      await expect(
        resolveOrigin(opts, "https://evil-quickex-frontend-abc.vercel.app"),
      ).resolves.toBe(false);
    });

    it("still allows the static production origin", async () => {
      await expect(resolveOrigin(opts, "https://quickex.to")).resolves.toBe(true);
    });
  });

  describe("preflight configuration", () => {
    it("caches preflight responses for one day", () => {
      const opts = buildCorsOptions({ nodeEnv: "production", allowedOrigins: [] });
      expect(opts.maxAge).toBe(86400);
    });

    it("rejects disallowed preflight origins", () => {
      expect(
        isCorsOriginAllowed("https://evil.com", { allowedOrigins: [] }),
      ).toBe(false);
    });
  });

  describe("credentials and headers", () => {
    it("sets credentials: true in production", () => {
      const opts = buildCorsOptions({ nodeEnv: "production", allowedOrigins: [] });
      expect(opts.credentials).toBe(true);
    });

    it("includes Authorization in allowedHeaders", () => {
      const opts = buildCorsOptions({ nodeEnv: "production", allowedOrigins: [] });
      expect(opts.allowedHeaders).toContain("Authorization");
    });

    it("includes X-API-Key in allowedHeaders", () => {
      const opts = buildCorsOptions({ nodeEnv: "production", allowedOrigins: [] });
      expect(opts.allowedHeaders).toContain("X-API-Key");
    });
  });
});
