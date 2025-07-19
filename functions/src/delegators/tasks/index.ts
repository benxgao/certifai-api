import { Router as createRouter } from 'express';
import handleExamBuild from './buildExam';

const router = createRouter();

router.post('/take', handleExamBuild);

export default router;
