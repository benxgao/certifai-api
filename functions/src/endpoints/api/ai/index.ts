import { Router as createRouter } from 'express';
import { genkitHandler } from './genkit';
import { quizGeneratorHandler } from './quizGenerator';

const router = createRouter();

router.post('/genkit', genkitHandler);
router.post('/quiz-generator', quizGeneratorHandler);

export default router;
