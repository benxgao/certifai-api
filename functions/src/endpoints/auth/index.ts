import { Router as createRouter } from 'express';
import register from './register';

const router = createRouter();

router.post('/register', register);

export default router;
