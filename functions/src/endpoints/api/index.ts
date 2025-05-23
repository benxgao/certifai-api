import { Router as createRouter } from 'express';
import ai from './ai';
import { verifyFirebaseToken } from '../../middlewares/firebase_auth';
import protectedResources from './protected_resources';
import getCertifications from './certifications/getList';
import getUserExams from './users/exams/getUserExams';
import createUser from './users/create';
import registerCert from './users/certifications/register';
import getUserExamQuizQuestions from './users/exams/getExamQuestions';
import createExamForUser from './users/exams/createExamForUser';
import getUserCertifications from './users/certifications/getUserCertifications';

import updateExam from './exams/update';
import submitExam from './exams/submit';

const router = createRouter();

router.use('/ai', verifyFirebaseToken, ai);

router.post('/protected-resources', verifyFirebaseToken, protectedResources);

// Show a list of certifications
router.get('/certifications', verifyFirebaseToken, getCertifications);

// Create a new user exam
router.post('/users/:user_id/exams', verifyFirebaseToken, createExamForUser);

// Show a list of exams for a user
router.get('/users/:user_id/exams', verifyFirebaseToken, getUserExams);

// Show a list of questions for a specific exam
router.get(
  '/users/:user_id/exams/:exam_id/questions',
  verifyFirebaseToken,
  getUserExamQuizQuestions,
);

router.post('/users', verifyFirebaseToken, createUser);

// Show a list of certifications for a user
router.get(
  '/users/:user_id/certifications',
  verifyFirebaseToken,
  getUserCertifications,
);

// Register a certification for a user
router.post(
  '/users/:user_id/certifications',
  verifyFirebaseToken,
  registerCert,
);

router.put('/exams/:exam_id', verifyFirebaseToken, updateExam);
router.post('/exams/:exam_id/answers', verifyFirebaseToken, submitExam);

export default router;
