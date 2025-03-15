import { Router as createRouter } from 'express';
import ai from './ai';

const router = createRouter();

router.use('/ai', ai);

export default router;
