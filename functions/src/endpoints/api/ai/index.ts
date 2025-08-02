import { Router as createRouter } from 'express';
import { quizGeneratorHandler } from './quizGenerator';
import { examPlannerHandler } from './examPlanner';
import { examReportGeneratorHandler } from './examReportGenerator';
import { certSummaryGeneratorHandler } from './certSummaryGenerator';

const router = createRouter();

router.post('/exam-planner', examPlannerHandler);
router.post('/quiz-generator', quizGeneratorHandler);
router.post('/exam-report', examReportGeneratorHandler as any); // Type assertion for CustomRequest compatibility
router.post('/cert-summary', certSummaryGeneratorHandler as any); // Type assertion for CustomRequest compatibility

export default router;
