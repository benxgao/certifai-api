import { Response, NextFunction } from 'express';

import { firebaseAdmin as admin } from '../services/firebase/admin';
import logger from '../services/firebase/logger';
import { FirebaseJwtToken } from '../types';

export const verifyFirebaseToken = async (
  req: any,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  logger.info(`req.headers: ${JSON.stringify(req.headers)}`);
  logger.info(`token received: ${token}`);

  if (!token) {
    res.sendStatus(401);
    return;
  }

  try {
    const decodedToken: FirebaseJwtToken = await admin
      .auth()
      .verifyIdToken(token);

    logger.info('Decoded JWT:', decodedToken);

    req.firebase_jwt_token = decodedToken;

    next();
    return;
  } catch (err) {
    console.error('JWT verification failed:', err);

    res.sendStatus(403);
    return;
  }
};
