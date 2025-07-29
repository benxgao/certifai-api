import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
// import rateLimitModule from 'express-rate-limit';

import healthcheck from './healthCheck';
import api from './api';
import logger from '../services/firebase/logger';

const app = express();

app.set('trust proxy', true);

// Security middleware
app.use(helmet());

// Compression middleware
app.use(compression());

// Rate limiting middleware
// const limiter = rateLimitModule({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 100, // limit each IP to 100 requests per windowMs
// });
// app.use(limiter);

// CORS configuration - restrict to allowed origins only
const allowedOrigins = [
  'http://localhost:3000',
  'https://localhost:3000',
  'https://www.certestic.com',
  'https://certestic.com',
  'http://www.certestic.com', // In case HTTP is used (though HTTPS is recommended)
  'http://certestic.com',
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests) only in development
      if (!origin && process.env.NODE_ENV === 'development') {
        logger.info(
          'CORS: Allowing request with no origin in development mode',
        );
        return callback(null, true);
      }

      if (!origin || allowedOrigins.includes(origin)) {
        if (origin) {
          logger.info(`CORS: Allowing request from origin: ${origin}`);
        }
        callback(null, true);
      } else {
        logger.warn(
          `CORS: Blocking request from unauthorized origin: ${origin}`,
        );
        callback(new Error(`Origin ${origin} not allowed by CORS policy`));
      }
    },
    credentials: true, // Allow cookies and authorization headers
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  }),
);

app.use(express.json());

app.use('/healthcheck', healthcheck);

app.use('/api', api);

export default app;
