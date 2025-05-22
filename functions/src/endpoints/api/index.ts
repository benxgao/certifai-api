import { Router as createRouter } from 'express';
import ai from './ai';
import { verifyFirebaseToken } from '../../middlewares/firebase_auth';
import protectedResources from './protected_resources';

import createUser from './users/create';
import registerCertification from './certifications/register';
import createExam from './exams/create';
import updateExam from './exams/update';
import submitExam from './exams/submit';

const router = createRouter();

router.use('/ai', verifyFirebaseToken, ai);

router.post('/protected-resources', verifyFirebaseToken, protectedResources);

router.post('/users', verifyFirebaseToken, createUser);

router.put(
  '/certifications/:cert_id/users/:user_id',
  verifyFirebaseToken,
  registerCertification,
);

router.post('/exams', verifyFirebaseToken, createExam);
router.put('/exams/:exam_id', verifyFirebaseToken, updateExam);
router.post('/exams/:exam_id/answers', verifyFirebaseToken, submitExam);




export default router;
