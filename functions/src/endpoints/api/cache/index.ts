import { Response } from 'express';
import logger from '../../../services/firebase/logger';
import { AuthenticatedRequest } from '../../../middlewares/jwtAuth';
import { CacheManager } from '../../../services/cache';

/**
 * Get cache health status and basic statistics
 */
export const getCacheHealth = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    logger.info(
      `Getting cache health status, user: ${JSON.stringify(req.user)}`,
    );

    const stats = await CacheManager.getCacheStats();

    res.status(200).json({
      success: true,
      data: {
        redis: {
          connected: stats.isConnected,
          url: process.env.UPSTASH_REDIS_REST_URL
            ? 'configured'
            : 'not configured',
        },
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error(`Error getting cache health: ${error}`);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get cache health',
    });
  }
};

/**
 * Clear all cache (admin function - use with caution)
 */
export const clearAllCache = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    logger.info(`Clearing all cache, user: ${JSON.stringify(req.user)}`);

    await CacheManager.invalidateAllCache();

    res.status(200).json({
      success: true,
      message: 'All cache cleared successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error(`Error clearing cache: ${error}`);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to clear cache',
    });
  }
};

/**
 * Clear firms cache
 */
export const clearFirmsCache = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    logger.info(`Clearing firms cache, user: ${JSON.stringify(req.user)}`);

    const firmId = req.params.firmId as string | undefined;
    const firmIdNum = firmId ? parseInt(firmId, 10) : undefined;
    await CacheManager.invalidateFirmCache(firmIdNum);

    res.status(200).json({
      success: true,
      message: `Firms cache cleared successfully${
        firmIdNum ? ` for firm ${firmIdNum}` : ''
      }`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error(`Error clearing firms cache: ${error}`);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to clear firms cache',
    });
  }
};

/**
 * Clear certifications cache
 */
export const clearCertificationsCache = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    logger.info(
      `Clearing certifications cache, user: ${JSON.stringify(req.user)}`,
    );

    const certId = req.params.certId as string | undefined;
    const firmId = req.params.firmId as string | undefined;
    const certIdNum = certId ? parseInt(certId, 10) : undefined;
    const firmIdNum = firmId ? parseInt(firmId, 10) : undefined;

    await CacheManager.invalidateCertificationCache(certIdNum, firmIdNum);

    res.status(200).json({
      success: true,
      message: `Certifications cache cleared successfully${
        certId ? ` for cert ${certId}` : ''
      }`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error(`Error clearing certifications cache: ${error}`);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to clear certifications cache',
    });
  }
};
