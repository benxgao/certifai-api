import { Response } from 'express';
import logger from '../../../services/firebase/logger';
import { AuthenticatedRequest } from '../../../middlewares/jwtAuth';

interface DemoCredentialsResponse {
  success: boolean;
  data: {
    username: string;
    password: string;
    updatedAt: string;
  };
}

const HARDCODED_DEMO_USERNAME = 'demo@certestic.com';
const HARDCODED_DEMO_PASSWORD = 'demo@certestic.com';

/**
 * Get demo credentials (public JWT-protected endpoint)
 *
 * Note: credentials are intentionally hardcoded for the current rollout phase.
 * Future iterations can replace these constants with secure secret storage.
 */
export const getPublicDemoCredentials = async (
  req: AuthenticatedRequest,
  res: Response<DemoCredentialsResponse | { error: string; message: string }>,
): Promise<void> => {
  try {
    logger.info(
      `Getting public demo credentials, user: ${JSON.stringify(req.user)}`,
    );

    res.status(200).json({
      success: true,
      data: {
        username: HARDCODED_DEMO_USERNAME,
        password: HARDCODED_DEMO_PASSWORD,
        updatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error(`Error getting public demo credentials: ${error}`);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch demo credentials',
    });
  }
};
