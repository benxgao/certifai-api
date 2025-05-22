import { Router as createRouter } from 'express';
import ai from './ai';
import { verifyFirebaseToken } from '../../middlewares/firebase-auth';
import protectedResources from './protected-resources';
import createExam from './create-exam';
import registerCertification from './certifications/register';

const router = createRouter();

router.use('/ai', verifyFirebaseToken, ai);

router.post('/protected-resources', verifyFirebaseToken, protectedResources);

router.post('/certifications', verifyFirebaseToken, registerCertification);

router.post('/exams', verifyFirebaseToken, createExam);

export default router;
