import { Logger } from "@nestjs/common";
import { CorsOptions } from "@nestjs/common/interfaces/external/cors-options.interface";

const logger = new Logger("CorsConfig");
const DEFAULT_ALLOWED_ORIGINS = [
  "https://quickex.to",
  "https://staging.quickex.to",
  "http://localhost:3000",
];

export function isCorsOriginAllowed(
  origin: string | undefined,
  env: { allowedOrigins: string[]; vercelProject?: string },
): boolean {
  if (!origin) return true;

  const staticOrigins = new Set([
    ...DEFAULT_ALLOWED_ORIGINS,
    ...env.allowedOrigins.filter(Boolean),
  ]);
  if (staticOrigins.has(origin)) return true;

  if (!env.vercelProject) return false;

  const vercelPreviewRe = new RegExp(
    `^https://${escapeRegex(env.vercelProject)}-[a-z0-9-]+-[a-z0-9]+\\.vercel\\.app$`,
  );
  return vercelPreviewRe.test(origin);
}

/**
 * Builds the CORS options for the given environment.
 *
 * Origin resolution order:
 *  1. No origin header (server-to-server / curl) → always allowed.
 *  2. Built-in and CORS_ALLOWED_ORIGINS origins → exact match.
 *  3. CORS_VERCEL_PROJECT set → allow any Vercel preview URL for that project
 *     (https://<project>-*.vercel.app).
 *  4. Otherwise → blocked.
 */
export function buildCorsOptions(env: {
  nodeEnv: string;
  allowedOrigins: string[];
  vercelProject?: string;
}): CorsOptions {
  return {
    origin: (origin, callback) => {
      const allowed = isCorsOriginAllowed(origin, env);
      if (!allowed) logger.warn(`CORS blocked: ${origin}`);
      callback(null, allowed);
    },
    credentials: true,
    maxAge: 86400,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "x-correlation-id",
      "X-API-Key",
    ],
  };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
