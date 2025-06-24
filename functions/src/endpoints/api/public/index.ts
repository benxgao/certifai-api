import { Router } from 'express';
import { verifyJWTToken } from '../../../middlewares/jwtAuth';
import { mediumPagePagination } from '../../../middlewares/pagination';
import { getPublicFirms, getPublicFirmById } from './firms';
import {
  getPublicCertifications,
  getPublicCertificationById,
  getPublicCertificationsByFirm,
} from './certifications';

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

export default router;
