import { Router } from 'express';
import { verifyJWTToken } from '../../../middlewares/jwtAuth';
import { mediumPagePagination } from '../../../middlewares/pagination';
import { getPublicFirms, getPublicFirmById } from './firms';
import {
  getPublicCertifications,
  getPublicCertificationById,
  getPublicCertificationBySlug,
  getPublicCertificationsByFirm,
} from './certifications';
import {
  getCacheHealth,
  clearAllCache,
  clearFirmsCache,
  clearCertificationsCache,
} from '../cache';

const router = Router();

/** ******************* PUBLIC FIRMS ************************* */

// Get all firms (public)
router.get('/firms', verifyJWTToken, mediumPagePagination, getPublicFirms);

// Get a specific firm by ID (public)
router.get('/firms/:firmId', verifyJWTToken, getPublicFirmById);

// Get certifications for a specific firm (public)
router.get(
  '/firms/:firmId/certifications',
  verifyJWTToken,
  mediumPagePagination,
  getPublicCertificationsByFirm,
);

/** ******************* PUBLIC CERTIFICATIONS ************************* */

// Get all certifications (public)
router.get(
  '/certifications',
  verifyJWTToken,
  mediumPagePagination,
  getPublicCertifications,
);

// Get a specific certification by ID (public)
router.get(
  '/certifications/:certId',
  verifyJWTToken,
  getPublicCertificationById,
);

// Get a specific certification by slug (public)
router.get(
  '/certifications/slug/:slug',
  verifyJWTToken,
  getPublicCertificationBySlug,
);

/** ******************* CACHE MANAGEMENT ************************* */

// Get cache health status
router.get('/cache/health', verifyJWTToken, getCacheHealth);

// Clear all cache (admin function)
router.delete('/cache', verifyJWTToken, clearAllCache);

// Clear firms cache
router.delete('/cache/firms', verifyJWTToken, clearFirmsCache);
router.delete('/cache/firms/:firmId', verifyJWTToken, clearFirmsCache);

// Clear certifications cache
router.delete(
  '/cache/certifications',
  verifyJWTToken,
  clearCertificationsCache,
);
router.delete(
  '/cache/certifications/:certId',
  verifyJWTToken,
  clearCertificationsCache,
);

export default router;
