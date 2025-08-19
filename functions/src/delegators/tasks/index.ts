import { Router as createRouter } from 'express';
import handleExamBuild from './buildExam';
import handleKnowledgePooling from './knowledgePooling';

const router = createRouter();

router.post('/take', handleExamBuild);
router.post('/knowledge-pooling', handleKnowledgePooling);

export default router;
