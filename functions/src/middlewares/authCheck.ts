import { Response, NextFunction } from 'express';

import { firebaseAdmin as admin } from '../services/firebase/admin';
import logger from '../services/firebase/logger';
import { AuthenticatedRequest } from '../types/express';

export const verifyFirebaseToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const authHeader = req.headers['authorization'];
  const token: string = authHeader && authHeader.split(' ')[1];

  // logger.info(`jwt_token received: ${token}`);

  if (!token) {
    res.status(401).json({
      success: false,
      error: 'Authentication token is required',
    });
    return;
  }

  try {
    const decodedToken: FirebaseJwtToken = await admin
      .auth()
      .verifyIdToken(token);

    // logger.info(
    //   `verifyFirebaseToken: decoded JWT: ${JSON.stringify(decodedToken)}`,
    // );

    if (decodedToken.exp < Date.now() / 1000) {
      logger.info('verifyFirebaseToken: token expired');
      res.status(401).json({
        success: false,
        error: 'Authentication token has expired',
      });
      return;
    }

    req.firebase_user_info = decodedToken;

    next();
    return;
  } catch (err) {
    console.error('verifyFirebaseToken: JWT verification failed:', err);

    res.status(403).json({
      success: false,
      error: 'Invalid authentication token',
    });
    return;
  }
};
