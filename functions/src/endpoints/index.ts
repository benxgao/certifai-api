import express from 'express';
import healthcheck from './healthcheck';

const app = express();

app.use('/healthcheck', healthcheck);

export default app;
