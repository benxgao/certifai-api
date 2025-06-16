import { Router as createRouter } from 'express';
import ai from './ai';
import { verifyFirebaseToken } from '../../middlewares/authCheck';
import protectedResources from './protected_resources';
import authRegister from './auth/register';
import authLogin from './auth/login';
import getCertifications from './certifications/getList';
import getUserExams from './users/exams/getUserExams';
import getUserExam from './users/exams/getUserExam';

import registerCert from './users/certifications/register';
import getUserExamQuizQuestions from './users/exams/getExamQuestions';
import createExam from './users/exams/createExam';
import getUserCertifications from './users/certifications/getUserCertifications';
import answerUserExamQuestions from './users/exams/answerUserExamQuestions';
import submitExamForUser from './users/exams/submitExamForUser';

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
router.get('/certifications', verifyFirebaseToken, getCertifications);

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
  getUserCertifications,
);

/** *********************** EXAMS ******************************** */

// Create a new user exam
router.post('/users/:user_id/exams', verifyFirebaseToken, createExam);

// Show a list of exams for a user
router.get('/users/:user_id/exams', verifyFirebaseToken, getUserExams);

// Show a list of questions for a specific exam
router.get(
  '/users/:user_id/exams/:exam_id/questions',
  verifyFirebaseToken,
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
