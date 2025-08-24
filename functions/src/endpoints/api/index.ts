import { Router as createRouter } from 'express';
import ai from './ai';
import { verifyFirebaseToken } from '../../middlewares/authCheck';
import { verifyUserAccess } from '../../middlewares/verifyUserAccess';
import { mediumPagePagination } from '../../middlewares/pagination';
import protectedResources from './protected_resources';
import authRegister from './auth/register';
import authLogin from './auth/login';
import firestoreEnsureAccount from './users/ensure-account';
import { generateToken } from './auth/generateToken';
import { generateServiceToken } from './auth/generateServiceToken';
import getUserExams from './users/exams/getUserExams';
import getUserExam from './users/exams/getUserExam';
import getExamGeneratingProgress from './users/exams/getExamGeneratingProgress';
import publicRoutes from './public';

import registerCert from './users/certifications/register';
import getUserExamQuizQuestions from './users/exams/getExamQuestions';
import createExam from './users/exams/createExam';
import getUserCertifications from './users/certifications/getUserCertifications';
import deleteCertification from './users/certifications/deleteCertification';
import answerUserExamQuestions from './users/exams/answerUserExamQuestions';
import submitExamForUser from './users/exams/submitExamForUser';
import deleteExam from './users/exams/deleteExam';
import getUserProfile from './users/getUserProfile';
import getRateLimit from './users/getRateLimit';
import deleteUser from './users/deleteUser';
import {
  getExamReport,
  regenerateExamReport,
} from './users/exams/getExamReport';
import {
  getCertSummary,
  regenerateCertSummary,
} from './users/certifications/getCertSummary';
import { getKnowledgePooling } from './users/certifications/getKnowledgePooling';
import { generateKnowledgePooling } from './users/certifications/generateKnowledgePooling';

// Admin endpoints
// import autoFailStuckExams from './admin/exams/autoFailStuckExams';
// import stuckExams from './admin/exam-generation/stuck-exams';
// import healthCheck from './admin/exam-generation/health';
// import metricsReport from './admin/exam-generation/metrics';
// import forceComplete from './admin/exam-generation/force-complete';

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

// Ensure Firestore account exists
router.post(
  '/users/ensure-account',
  verifyFirebaseToken,
  firestoreEnsureAccount,
);

// Get user profile (including credit tokens)
router.get(
  '/users/:user_id/profile',
  verifyFirebaseToken,
  verifyUserAccess,
  getUserProfile,
);

// Get user rate limit information
router.get(
  '/users/:user_id/rate-limit',
  verifyFirebaseToken,
  verifyUserAccess,
  getRateLimit,
);

// Delete user account
router.delete(
  '/users/:user_id',
  verifyFirebaseToken,
  verifyUserAccess,
  deleteUser,
);

// Register a certification for a user
router.post(
  '/users/:user_id/certifications',
  verifyFirebaseToken,
  verifyUserAccess,
  registerCert,
);

// Show a list of certifications for a user
router.get(
  '/users/:user_id/certifications',
  verifyFirebaseToken,
  verifyUserAccess,
  mediumPagePagination,
  getUserCertifications,
);

// Delete a user certification
router.delete(
  '/users/:user_id/certifications/:cert_id',
  verifyFirebaseToken,
  verifyUserAccess,
  deleteCertification,
);

/** *********************** EXAMS ******************************** */

// Create a new user exam
router.post(
  '/users/:user_id/certifications/:cert_id/exams',
  verifyFirebaseToken,
  verifyUserAccess,
  createExam,
);

// Show a list of exams for a user
router.get(
  '/users/:user_id/exams',
  verifyFirebaseToken,
  verifyUserAccess,
  mediumPagePagination,
  getUserExams,
);

// Show a list of questions for a specific exam
router.get(
  '/users/:user_id/exams/:exam_id/questions',
  verifyFirebaseToken,
  verifyUserAccess,
  mediumPagePagination,
  getUserExamQuizQuestions,
);

// Show a specific exam
router.get(
  '/users/:user_id/exams/:exam_id',
  verifyFirebaseToken,
  verifyUserAccess,
  getUserExam,
);

// Get exam generation progress
router.get(
  '/users/:user_id/exams/:exam_id/generating-progress',
  verifyFirebaseToken,
  verifyUserAccess,
  getExamGeneratingProgress,
);

// Answer a specific question in a user exam
router.put(
  '/users/:user_id/exams/:exam_id/questions/:quiz_question_id',
  verifyFirebaseToken,
  verifyUserAccess,
  answerUserExamQuestions,
);

// Submit a user exam
router.post(
  '/users/:user_id/certifications/:cert_id/exams/:exam_id/submit',
  verifyFirebaseToken,
  verifyUserAccess,
  submitExamForUser,
);

// Delete a user exam
router.delete(
  '/users/:user_id/exams/:exam_id',
  verifyFirebaseToken,
  verifyUserAccess,
  deleteExam,
);

// Get certification summary for a user
router.get(
  '/users/:user_id/certifications/:cert_id/cert-summary',
  verifyFirebaseToken,
  verifyUserAccess,
  getCertSummary,
);

// Regenerate certification summary for a user
router.post(
  '/users/:user_id/certifications/:cert_id/cert-summary',
  verifyFirebaseToken,
  verifyUserAccess,
  regenerateCertSummary,
);

// Get knowledge pooling data for a user certification
router.get(
  '/users/:user_id/certifications/:cert_id/knowledge-pooling',
  verifyFirebaseToken,
  verifyUserAccess,
  getKnowledgePooling,
);

// Generate/regenerate knowledge pooling for a user certification
router.post(
  '/users/:user_id/certifications/:cert_id/knowledge-pooling',
  verifyFirebaseToken,
  verifyUserAccess,
  generateKnowledgePooling,
);

// Get exam report for a user exam
router.get(
  '/users/:user_id/exams/:exam_id/exam-report',
  verifyFirebaseToken,
  verifyUserAccess,
  getExamReport,
);

// Regenerate exam report for a user exam
router.post(
  '/users/:user_id/exams/:exam_id/exam-report',
  verifyFirebaseToken,
  verifyUserAccess,
  regenerateExamReport,
);

/** *********************** ADMIN ENDPOINTS ******************************** */

// // Admin: Get stuck exams
// router.get(
//   '/admin/exam-generation/stuck-exams',
//   verifyFirebaseToken,
//   stuckExams,
// );

// // Admin: Get system health
// router.get('/admin/exam-generation/health', verifyFirebaseToken, healthCheck);

// // Admin: Get metrics report
// router.get(
//   '/admin/exam-generation/metrics',
//   verifyFirebaseToken,
//   metricsReport,
// );

// // Admin: Force complete stuck exam
// router.post(
//   '/admin/exam-generation/force-complete',
//   verifyFirebaseToken,
//   forceComplete,
// );

// // Admin: Auto-fail stuck exams
// router.post(
//   '/admin/exams/auto-fail-stuck',
//   verifyFirebaseToken,
//   autoFailStuckExams,
// );

export default router;
