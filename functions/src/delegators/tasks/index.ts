import { Router as createRouter } from 'express';
import handleTasksInit from './init';
import handleTasksTake from './take';

const router = createRouter();

router.post('/init', handleTasksInit);
router.post('/take', handleTasksTake);

export default router;
