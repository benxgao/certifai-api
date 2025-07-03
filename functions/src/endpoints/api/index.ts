import { Router as createRouter } from 'express';
import ai from './ai';
import { verifyFirebaseToken } from '../../middlewares/authCheck';
import { mediumPagePagination } from '../../middlewares/pagination';
import protectedResources from './protected_resources';
import authRegister from './auth/register';
import authLogin from './auth/login';
import { generateToken } from './auth/generateToken';
import { generateServiceToken } from './auth/generateServiceToken';
import getUserExams from './users/exams/getUserExams';
import getUserExam from './users/exams/getUserExam';
import publicRoutes from './public';

import registerCert from './users/certifications/register';
import getUserExamQuizQuestions from './users/exams/getExamQuestions';
import createExam from './users/exams/createExam';
import getUserCertifications from './users/certifications/getUserCertifications';
import answerUserExamQuestions from './users/exams/answerUserExamQuestions';
import submitExamForUser from './users/exams/submitExamForUser';
import deleteExam from './users/exams/deleteExam';
import getUserProfile from './users/getUserProfile';
import getRateLimit from './users/getRateLimit';

const router = createRouter();

/** ******************* PUBLIC ROUTES ************************* */

router.use('/public', publicRoutes);

/** ******************* TO BE DEPRECATED ************************* */

router.use('/ai', verifyFirebaseToken, ai);
router.post('/protected-resources', verifyFirebaseToken, protectedResources);

/** ******************* AUTHENTICATIONS ************************* */

// User register
router.post('/auth/register', verifyFirebaseToken, authRegister);

// User login
router.post('/auth/login', verifyFirebaseToken, authLogin);

// Generate JWT token for public API access
router.post('/auth/generate-token', verifyFirebaseToken, generateToken);

// Generate service JWT token for marketing/public access (no Firebase auth required)
router.post('/auth/generate-service-token', generateServiceToken);

/** ******************* USERS ************************* */

// Get user profile (including credit tokens)
router.get('/users/:user_id/profile', verifyFirebaseToken, getUserProfile);

// Get user rate limit information
router.get('/users/:user_id/rate-limit', verifyFirebaseToken, getRateLimit);

// Register a certification for a user
router.post(
  '/users/:user_id/certifications',
  verifyFirebaseToken,
  registerCert,
);

// Show a list of certifications for a user
router.get(
  '/users/:user_id/certifications',
  verifyFirebaseToken,
  mediumPagePagination,
  getUserCertifications,
);

/** *********************** EXAMS ******************************** */

// Create a new user exam
router.post(
  '/users/:user_id/certifications/:cert_id/exams',
  verifyFirebaseToken,
  createExam,
);

// Show a list of exams for a user
router.get(
  '/users/:user_id/exams',
  verifyFirebaseToken,
  mediumPagePagination,
  getUserExams,
);

// Show a list of questions for a specific exam
router.get(
  '/users/:user_id/exams/:exam_id/questions',
  verifyFirebaseToken,
  mediumPagePagination,
  getUserExamQuizQuestions,
);

// Show a list of questions for a specific exam
router.get('/users/:user_id/exams/:exam_id', verifyFirebaseToken, getUserExam);

// Answer a specific question in a user exam
router.put(
  '/users/:user_id/exams/:exam_id/questions/:quiz_question_id',
  verifyFirebaseToken,
  answerUserExamQuestions,
);

// Submit a user exam
router.post(
  '/users/:user_id/certifications/:cert_id/exams/:exam_id/submit',
  verifyFirebaseToken,
  submitExamForUser,
);

// Delete a user exam (only failed exams)
router.delete(
  '/users/:user_id/exams/:exam_id',
  verifyFirebaseToken,
  deleteExam,
);

export default router;
