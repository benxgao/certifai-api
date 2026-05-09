import logger from '../services/firebase/logger';
import { GcpEnv, getGcpEnv, isProduction } from '../utils/utils';

export interface CorsPolicyConfig {
  gcpEnv: GcpEnv;
  allowedOrigins: Set<string>;
  allowNoOrigin: boolean;
  logBlockedOrigins: boolean;
  failClosed: boolean;
}

const DEFAULT_LOG_BLOCKED_ORIGINS = true;

export const normalizeOrigin = (origin: string): string | null => {
  try {
    const parsed = new URL(origin);

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }

    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return null;
  }
};

export const getCorsPolicyConfig = (): CorsPolicyConfig => {
  const gcpEnv = getGcpEnv();

  const rawOrigins = (process.env.CORS_ALLOWED_ORIGINS || '').trim();
  const allowedOrigins = new Set<string>();

  if (rawOrigins.length > 0) {
    rawOrigins
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean)
      .forEach((origin) => {
        const normalized = normalizeOrigin(origin);

        if (!normalized) {
          logger.warn('CORS_POLICY_INVALID_ORIGIN_CONFIG', {
            configured_origin: origin,
          });
          return;
        }

        allowedOrigins.add(normalized);
      });
  }

  const allowNoOrigin = true;
  const logBlockedOrigins = DEFAULT_LOG_BLOCKED_ORIGINS;

  const failClosed = isProduction && allowedOrigins.size === 0;

  logger.info('CORS_POLICY_CONFIG_LOADED', {
    gcpEnv,
    NODE_ENV: process.env.NODE_ENV,
    allowed_origins_count: allowedOrigins.size,
    allow_no_origin: allowNoOrigin,
    log_blocked_origins: logBlockedOrigins,
    fail_closed: failClosed,
  });

  if (failClosed) {
    logger.error('CORS_POLICY_FAIL_CLOSED_ACTIVE', {
      gcpEnv,
      NODE_ENV: process.env.NODE_ENV,
      reason: 'empty_allowlist_in_non_development',
    });
  }

  return {
    gcpEnv,
    allowedOrigins,
    allowNoOrigin,
    logBlockedOrigins,
    failClosed,
  };
};
