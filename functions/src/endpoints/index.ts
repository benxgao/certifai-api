import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';

import healthcheck from './healthcheck';
import auth from './auth';
import api from './api';
import { verifyFirebaseToken } from '../middlewares/firebase-auth';

const app = express();

// Security middleware
app.use(helmet());

// Compression middleware
app.use(compression());

// Rate limiting middleware
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});
app.use(limiter);

app.use(cors());

app.use(express.json());

app.use('/healthcheck', healthcheck);

app.use('/auth', auth);

app.use('/api', verifyFirebaseToken, api);

export default app;
