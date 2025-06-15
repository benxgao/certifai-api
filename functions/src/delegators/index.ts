import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
// import rateLimitModule from 'express-rate-limit';

import tasks from './tasks';

const app = express();

app.set('trust proxy', 1);

app.use(helmet());

app.use(compression());

app.use(cors());

app.use(express.json());

app.use('/tasks', tasks);

export default app;
