import { Response } from 'express';
import logger from '../../../services/firebase/logger';
import { jwtService } from '../../../services/jwt';
import { AuthenticatedRequest } from '../../../types/express';

export interface TokenRequest {
  clientId: string;
  scope?: string;
  expiresIn?: string;
}

/**
 * Generate a JWT token for public API access
 * This should be protected by Firebase auth or another authentication method
 */
export const generateToken = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const {
      clientId,
      scope = 'public:read',
      expiresIn = '24h',
    } = req.body as TokenRequest;

    if (!clientId) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'clientId is required',
      });
      return;
    }

    logger.info(
      `Generating JWT token for client: ${clientId}, firebase_user: ${JSON.stringify(
        req.firebase_user_info,
      )}`,
    );

    const token = await jwtService.generateToken(
      {
        sub: clientId,
        scope,
      },
      expiresIn,
    );

    res.status(200).json({
      success: true,
      data: {
        token,
        type: 'Bearer',
        expiresIn,
        scope,
      },
    });
  } catch (error) {
    logger.error(`Error generating JWT token: ${error}`);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to generate token',
    });
  }
};
