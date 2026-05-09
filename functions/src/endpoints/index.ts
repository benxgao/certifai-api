import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import logger from '../services/firebase/logger';
import { getCorsPolicyConfig, normalizeOrigin } from '../config/cors';

import healthcheck from './healthCheck';
import api from './api';
import stripe from './stripe';

const app = express();

app.set('trust proxy', true);

// Security middleware
app.use(helmet());

// Compression middleware
app.use(compression());

const corsPolicy = getCorsPolicyConfig();

app.use(
  cors({
    origin: (origin, callback) => {
      let allowed = false;
      let reason:
        | 'allowed_origin'
        | 'invalid_origin'
        | 'origin_not_allowlisted'
        | 'allowed_no_origin'
        | 'no_origin_blocked'
        | 'fail_closed_no_allowlist' = 'origin_not_allowlisted';
      let normalizedOrigin: string | null = null;

      if (!origin) {
        allowed = corsPolicy.allowNoOrigin;
        reason = allowed ? 'allowed_no_origin' : 'no_origin_blocked';
      } else {
        normalizedOrigin = normalizeOrigin(origin);

        if (!normalizedOrigin) {
          reason = 'invalid_origin';
        } else if (corsPolicy.failClosed) {
          reason = 'fail_closed_no_allowlist';
        } else if (corsPolicy.allowedOrigins.has(normalizedOrigin)) {
          allowed = true;
          reason = 'allowed_origin';
        } else {
          reason = 'origin_not_allowlisted';
        }
      }

      if (!allowed && corsPolicy.logBlockedOrigins) {
        logger.warn('CORS_REQUEST_BLOCKED', {
          origin: origin || null,
          normalized_origin: normalizedOrigin,
          decision: 'blocked',
          reason,
          environment: corsPolicy.gcpEnv,
        });
      }

      if (allowed) {
        // logger.info('CORS_REQUEST_ALLOWED', {
        //   origin: origin || null,
        //   normalized_origin: normalizedOrigin,
        //   decision: 'allowed',
        //   reason,
        //   environment: corsPolicy.gcpEnv,
        // });
        callback(null, true);
        return;
      }

      callback(new Error('Origin not allowed by CORS policy'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  }),
);

app.use(express.json());

app.use('/healthcheck', healthcheck);

app.use('/api', api);

app.use('/stripe', stripe);

export default app;
