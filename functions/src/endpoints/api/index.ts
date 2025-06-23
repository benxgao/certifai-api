import { Router as createRouter } from 'express';
import ai from './ai';
import { verifyFirebaseToken } from '../../middlewares/authCheck';
import { mediumPagePagination } from '../../middlewares/pagination';
import protectedResources from './protected_resources';
import authRegister from './auth/register';
import authLogin from './auth/login';
import getCertifications from './certifications/getList';
import getCertificationsByFirm from './certifications/getByFirm';
import getUserExams from './users/exams/getUserExams';
import getUserExam from './users/exams/getUserExam';

import registerCert from './users/certifications/register';
import getUserExamQuizQuestions from './users/exams/getExamQuestions';
import createExam from './users/exams/createExam';
import getUserCertifications from './users/certifications/getUserCertifications';
import answerUserExamQuestions from './users/exams/answerUserExamQuestions';
import submitExamForUser from './users/exams/submitExamForUser';
import getUserProfile from './users/getUserProfile';
import {
  getFirms,
  getFirmById,
  searchFirms,
  createFirm,
  updateFirm,
  deleteFirm,
} from './firms';

const router = createRouter();

/** ******************* TO BE DEPRECATED ************************* */

router.use('/ai', verifyFirebaseToken, ai);
router.post('/protected-resources', verifyFirebaseToken, protectedResources);

/** ******************* AUTHENTICATIONS ************************* */

// User register
router.post('/auth/register', verifyFirebaseToken, authRegister);

// User login
router.post('/auth/login', verifyFirebaseToken, authLogin);

/** ******************* CERTIFICATIONS ************************* */

// Show a list of certifications
router.get(
  '/certifications',
  verifyFirebaseToken,
  mediumPagePagination,
  getCertifications,
);

/** ******************* FIRMS ************************* */

// Get all firms (protected)
router.get('/firms', verifyFirebaseToken, mediumPagePagination, getFirms);

// Search firms (protected)
router.get(
  '/firms/search',
  verifyFirebaseToken,
  mediumPagePagination,
  searchFirms,
);

// Get a specific firm (protected)
router.get('/firms/:firmId', verifyFirebaseToken, getFirmById);

// Get certifications for a specific firm (protected)
router.get(
  '/firms/:firmId/certifications',
  verifyFirebaseToken,
  mediumPagePagination,
  getCertificationsByFirm,
);

// Create a new firm (protected)
router.post('/firms', verifyFirebaseToken, createFirm);

// Update a firm (protected)
router.put('/firms/:firmId', verifyFirebaseToken, updateFirm);

// Delete a firm (protected)
router.delete('/firms/:firmId', verifyFirebaseToken, deleteFirm);

/** ******************* USERS ************************* */

// Get user profile (including credit tokens)
router.get('/users/:user_id/profile', verifyFirebaseToken, getUserProfile);

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
router.post('/users/:user_id/exams', verifyFirebaseToken, createExam);

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

export default router;
