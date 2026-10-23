import * as winston from 'winston';
import {
  getCurrentCorrelationId,
  getCurrentTraceId,
} from '../context/correlation.context';

/**
 * Structured logging format for Winston.
 *
 * All log entries include:
 *   - timestamp (ISO 8601)
 *   - level (error, warn, info, debug)
 *   - message
 *   - service name
 *   - correlationId (when a request scope is active)
 *   - traceId (when a request scope is active)
 *   - any additional metadata
 *
 * File transports use JSON format for machine parsing.
 * Console transport uses colourised simple format for dev readability.
 */
const withCorrelationId = winston.format((info) => {
  const correlationId = getCurrentCorrelationId();
  if (correlationId) info.correlationId = correlationId;
  const traceId = getCurrentTraceId();
  if (traceId) info.traceId = traceId;
  return info;
});

const structuredFormat = winston.format.combine(
  winston.format.errors({ stack: true }),
  redactSensitiveFields(),
  withCorrelationId(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.json(),
);

function redactSensitiveFields() {
  return winston.format((info) => {
    const redact = (value: unknown, key = ''): unknown => {
      if (/(email|wallet|public.?key|secret|token|password|api.?key|authorization)/i.test(key)) {
        return '[REDACTED]';
      }
      if (typeof value === 'string') {
        return value
          .replace(/G[A-Z2-7]{55}/g, '[REDACTED_PUBLIC_KEY]')
          .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[REDACTED_EMAIL]');
      }
      if (Array.isArray(value)) return value.map((item) => redact(item));
      if (value && typeof value === 'object') {
        return Object.fromEntries(
          Object.entries(value).map(([childKey, child]) => [childKey, redact(child, childKey)]),
        );
      }
      return value;
    };

    Object.assign(info, redact(info));
    return info;
  })();
}

const validLogLevels = new Set(['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly']);
const configuredLogLevel = process.env.LOG_LEVEL?.toLowerCase();
const logLevel = configuredLogLevel && validLogLevels.has(configuredLogLevel)
  ? configuredLogLevel
  : process.env.NODE_ENV === 'development' ? 'debug' : 'info';
const isProduction = process.env.NODE_ENV === 'production';

const consoleFormat = winston.format.combine(
  redactSensitiveFields(),
  withCorrelationId(),
  winston.format.timestamp({ format: 'HH:mm:ss.SSS' }),
  winston.format.colorize(),
  winston.format.printf(
    ({ timestamp, level, message, context, correlationId, traceId, ...meta }) => {
      const ctx = context ? `[${context}]` : '';
      const ids = [correlationId, traceId].filter(Boolean).join('/');
      const idTag = ids ? `[${ids}]` : '';
      const extra = Object.keys(meta).length
        ? ` ${JSON.stringify(meta)}`
        : '';
      return `${timestamp} ${level} ${ctx}${idTag} ${message}${extra}`;
    },
  ),
);

export const winstonConfig = {
  level: logLevel,
  transports: [
    // Keep local logs readable; production logs remain machine-parseable JSON.
    new winston.transports.Console({
      format: isProduction ? structuredFormat : consoleFormat,
    }),
    // Error log: only errors, structured JSON
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: structuredFormat,
      maxsize: 10 * 1024 * 1024, // 10 MB
      maxFiles: 5,
    }),
    // Combined log: all levels, structured JSON
    new winston.transports.File({
      filename: 'logs/combined.log',
      format: structuredFormat,
      maxsize: 10 * 1024 * 1024, // 10 MB
      maxFiles: 5,
    }),
  ],
};