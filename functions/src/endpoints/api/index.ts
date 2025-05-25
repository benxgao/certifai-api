import { Router as createRouter } from 'express';
import ai from './ai';
import { verifyFirebaseToken } from '../../middlewares/firebase_auth';
import protectedResources from './protected_resources';
import authRegister from './auth/register';
import authLogin from './auth/login';
import getCertifications from './certifications/getList';
import getUserExams from './users/exams/getUserExams';

import registerCert from './users/certifications/register';
import getUserExamQuizQuestions from './users/exams/getExamQuestions';
import createExamForUser from './users/exams/createExamForUser';
import getUserCertifications from './users/certifications/getUserCertifications';
import answerUserExamQuestions from './users/exams/answerUserExamQuestions';
import submitExamForUser from './users/exams/submitExamForUser';

const router = createRouter();

router.use('/ai', verifyFirebaseToken, ai);

router.post('/protected-resources', verifyFirebaseToken, protectedResources);

// User register
router.post('/auth/register', verifyFirebaseToken, authRegister);

// User login
router.post('/auth/login', verifyFirebaseToken, authLogin);

// Show a list of certifications
router.get('/certifications', verifyFirebaseToken, getCertifications);

// Create a new user exam
router.post('/users/:user_id/exams', verifyFirebaseToken, createExamForUser);

router.post(
  '/users/:user_id/exams/:exam_id/submit',
  verifyFirebaseToken,
  submitExamForUser,
);

// Show a list of exams for a user
router.get('/users/:user_id/exams', verifyFirebaseToken, getUserExams);

// Show a list of questions for a specific exam
router.get(
  '/users/:user_id/exams/:exam_id/questions',
  verifyFirebaseToken,
  getUserExamQuizQuestions,
);

// Answer a specific question in a user exam
router.put(
  '/users/:user_id/exams/:exam_id/questions/:quiz_question_id',
  verifyFirebaseToken,
  answerUserExamQuestions,
);

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

export default router;
