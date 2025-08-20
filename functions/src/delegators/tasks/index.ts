import { Router as createRouter } from 'express';
import handleExamBuild from './buildExam';
import handleKnowledgePooling from './knowledgePooling';
import handleExamReport from './examReport';

const router = createRouter();

router.post('/take', handleExamBuild);
router.post('/knowledge-pooling', handleKnowledgePooling);
router.post('/exam-report', handleExamReport);

export default router;
