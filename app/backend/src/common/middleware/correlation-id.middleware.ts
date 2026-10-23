import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import {
  getCurrentCorrelationId,
  generateCorrelationId,
  runWithCorrelationId,
  CORRELATION_ID_HEADER,
} from '../context/correlation.context';

/**
 * Strict allowlist for client-supplied correlation IDs.
 * Only opaque, log-safe characters are accepted, bounded to 128 chars to
 * prevent header/log injection and unbounded memory growth.
 */
const CORRELATION_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const inbound =
      req.header('x-request-id') ||
      req.header('x-correlation-id') ||
      req.header(CORRELATION_ID_HEADER);

    const correlationId =
      this.sanitize(inbound) ||
      this.sanitize(getCurrentCorrelationId()) ||
      generateCorrelationId();

    // Echo the resolved ID on the response via the canonical header plus
    // legacy aliases so existing clients keep working.
    res.setHeader('x-request-id', correlationId);
    res.setHeader('x-correlation-id', correlationId);
    res.setHeader(CORRELATION_ID_HEADER, correlationId);
    req['correlationId'] = correlationId;

    // Propagate the ID across all downstream async work (controllers, services
    // and any outbound calls to Horizon, Soroban RPC or Supabase) via ALS.
    runWithCorrelationId(correlationId, () => next());
  }

  /**
   * Returns the value when it is a non-empty string matching the strict
   * correlation-ID allowlist, otherwise `undefined`.
   */
  private sanitize(value: unknown): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }
    const trimmed = value.trim();
    return CORRELATION_ID_PATTERN.test(trimmed) ? trimmed : undefined;
  }
}