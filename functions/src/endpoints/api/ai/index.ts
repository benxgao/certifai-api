import { Router as createRouter } from 'express';
import { quizGeneratorHandler } from './quizGenerator';
import { examPlannerHandler } from './examPlanner';

const router = createRouter();

router.post('/exam-planner', examPlannerHandler);
router.post('/quiz-generator', quizGeneratorHandler);

export default router;
