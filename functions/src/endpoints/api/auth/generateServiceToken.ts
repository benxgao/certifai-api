import { Response, Request } from 'express';
import logger from '../../../services/firebase/logger';
import { jwtService } from '../../../services/jwt';

/**
 * Generate a service JWT token for marketing page / public access
 * This endpoint is designed for server-side applications that need access to public APIs
 */
export const generateServiceToken = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    // Check for service secret in headers to prevent abuse
    const serviceSecret = req.headers['x-service-secret'] as string;
    const expectedSecret = process.env.PUBLIC_JWT_SECRET;

    if (!expectedSecret) {
      logger.error('PUBLIC_JWT_SECRET environment variable not configured');
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Service not properly configured',
      });
      return;
    }

    if (!serviceSecret || serviceSecret !== expectedSecret) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid service credentials',
      });
      return;
    }

    const {
      clientId = 'marketing-service',
      scope = 'public:read',
      expiresIn = '24h',
    } = req.body;

    logger.info(`Generating service JWT token for client: ${clientId}`);

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
    logger.error(`Error generating service JWT token: ${error}`);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to generate service token',
    });
  }
};
