import { Request, Response, NextFunction } from 'express';
import { jwtService } from '../services/jwt';

export interface AuthenticatedRequest extends Request {
  user?: {
    sub: string;
    scope: string;
  };
}

/**
 * Middleware to verify JWT token for public API routes
 */
export const verifyJWTToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing or invalid authorization header',
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    const payload = await jwtService.verifyToken(token);

    // Attach user info to request
    req.user = {
      sub: payload.sub,
      scope: payload.scope || 'public:read',
    };

    next();
  } catch {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired token',
    });
  }
};
