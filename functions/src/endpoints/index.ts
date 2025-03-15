import express from 'express';
import cors from 'cors';

import healthcheck from './healthcheck';
import auth from './auth';
import api from './api';

const app = express();

app.use(cors({ origin: true }));
app.use(express.json());

app.use('/healthcheck', healthcheck);

app.use('/auth', auth);

app.use('/api', api);


export default app;
