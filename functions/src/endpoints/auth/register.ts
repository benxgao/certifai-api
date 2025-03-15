/**
 * POST /auth/register
 *
 * Register a new user account
 *
 * Example Postman request:
 * Method: POST
 * URL: http://localhost:5001/your-project/us-central1/auth/register
 * Headers:
 *   Content-Type: application/json
 *
 * Request body:
 * {
 *   "email": "user@example.com",
 *   "password": "password123"
 * }
 *
 * Success Response (201):
 * {
 *   "success": true,
 *   "data": {
 *     "uid": "generated-uid",
 *     "email": "user@example.com",
 *     "token": "custom-token"
 *   }
 * }
 */

import { inspect } from 'util';
import { Request, Response } from 'express';
import * as logger from 'firebase-functions/logger';
import { firebaseAuth } from '../../services/firebase/admin';

interface RegisterRequest {
  email: string;
  password: string;
}

const register = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body as RegisterRequest;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password should be at least 6 characters',
      });
    }

    // Create user
    const userRecord = await firebaseAuth.createUser({
      email,
      password,
      displayName: 'John Doe',
      emailVerified: false,
      disabled: false,
    });

    const customClaims = {
      admin: true,
      accessLevel: 9,
    };

    await firebaseAuth.setCustomUserClaims(userRecord.uid, customClaims);

    logger.info(`Created new user: ${inspect(userRecord.customClaims)}`);

    // Generate custom token for immediate sign-in
    const token = await firebaseAuth.createCustomToken(userRecord.uid);

    return res.status(201).json({
      success: true,
      data: {
        uid: userRecord.uid,
        email: userRecord.email,
        token,
      },
    });
  } catch (error) {
    logger.error('Error in register endpoint:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
};

export default register;
