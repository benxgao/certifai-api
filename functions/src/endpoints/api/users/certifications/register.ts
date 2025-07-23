import { Response } from 'express';
import logger from '../../../../services/firebase/logger';
import { CustomRequest } from '../../../../types';
import { BatchWriteOptimizer } from '../../../../services/database/batchWriteOptimizer';
import { CacheManager } from '../../../../services/cache';

import prismaInstance, {
  CertificationStatus,
} from '../../../../services/prisma';

const handler = async (req: any | CustomRequest, res: Response) => {
  const operationStart = Date.now();
  const timingAudit = {
    total_operation: 0,
    prisma_operations: {
      user_validation: 0,
      certification_validation: 0,
      registration_create: 0,
    },
    external_services: {
      cache_operations: 0,
    },
  };

  try {
    const { user_id } = req.params;
    const { cert_id } = req.body;
    const firebaseUserIdFromToken = req.firebase_user_info?.user_id;

    // 1. Basic input validation
    if (!user_id) {
      res.status(400).json({
        success: false,
        error: 'user_id is required in params',
      });
      return;
    }

    if (!cert_id) {
      res.status(400).json({
        success: false,
        error: 'cert_id is required in body',
      });
      return;
    }

    if (!firebaseUserIdFromToken) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized: Firebase token missing.',
      });
      return;
    }

    const certIdNumber = parseInt(cert_id as string, 10);
    if (isNaN(certIdNumber)) {
      res.status(400).json({
        success: false,
        error: 'cert_id must be a valid number',
      });
      return;
    }

    logger.info(
      `USER_CERT_REGISTER_INIT: user_id=${user_id}, cert_id=${certIdNumber}`,
    );

    // 2. Validate user exists and authorize access
    const userValidationStart = Date.now();
    const user = await prismaInstance.user.findUnique({
      where: { user_id: user_id },
      select: { user_id: true, firebase_user_id: true },
    });
    timingAudit.prisma_operations.user_validation =
      Date.now() - userValidationStart;

    if (!user) {
      res.status(404).json({
        success: false,
        error: `User with ID: ${user_id} not found.`,
      });
      return;
    }

    // Authorization: Check if the firebase_user_id from token matches the user's firebase_user_id
    if (user.firebase_user_id !== firebaseUserIdFromToken) {
      logger.warn(
        `Forbidden: Firebase user ${firebaseUserIdFromToken} attempted to register certification for user ${user_id}.`,
      );
      res.status(403).json({
        success: false,
        error:
          'Forbidden: You can only register certifications for your own account.',
      });
      return;
    }

    // 3. Validate certification exists
    const certValidationStart = Date.now();
    const certification = await prismaInstance.certification.findUnique({
      where: { cert_id: certIdNumber },
      select: { cert_id: true, name: true, firm_id: true },
    });
    timingAudit.prisma_operations.certification_validation =
      Date.now() - certValidationStart;

    if (!certification) {
      res.status(404).json({
        success: false,
        error: `Certification with ID: ${certIdNumber} not found.`,
      });
      return;
    }

    logger.info(
      `USER_CERT_REGISTER_VALIDATED: user_id=${user_id}, cert_id=${certIdNumber}, cert_name=${certification.name}`,
    );

    // 4. Create user certification registration using optimized batch operation
    const registrationStart = Date.now();

    const registrationOperations = [
      {
        operation: (tx: any) =>
          tx.userCertification.create({
            data: {
              user_id: user_id as string,
              cert_id: certIdNumber,
              status: CertificationStatus.IN_PROGRESS,
            },
          }),
        description: 'Create user certification registration',
      },
    ];

    const registrationResults = await BatchWriteOptimizer.batchOperations(
      prismaInstance,
      registrationOperations,
      {
        useTransaction: true,
        batchSize: 1,
      },
    );

    const newCertificationRegistration = registrationResults[0] as any;
    const registrationDuration = Date.now() - registrationStart;
    timingAudit.prisma_operations.registration_create = registrationDuration;

    logger.info('AUDIT_PRISMA_USER_CERT_CREATE_OPTIMIZED', {
      operation: 'userCertification.create_batch',
      duration_ms: registrationDuration,
      user_id: user_id,
      cert_id: certIdNumber,
      cert_name: certification.name,
      firm_id: certification.firm_id,
      status: CertificationStatus.IN_PROGRESS,
      optimization: 'batch_write_optimizer',
    });

    // 5. Invalidate relevant caches in parallel
    const cacheStart = Date.now();
    await Promise.all([
      CacheManager.invalidateUserCertificationCache(user_id),
      CacheManager.invalidateCertificationCache(
        certIdNumber,
        certification.firm_id,
      ),
    ]);
    timingAudit.external_services.cache_operations = Date.now() - cacheStart;

    // 6. Successful response
    timingAudit.total_operation = Date.now() - operationStart;

    logger.info(
      `USER_CERT_REGISTER_SUCCESS: user_id=${user_id}, cert_id=${certIdNumber}, registration_id=${newCertificationRegistration.id}`,
      {
        timing_audit: timingAudit,
        structured_data: true,
      },
    );

    res.status(201).json({
      success: true,
      data: newCertificationRegistration,
      performance: {
        total_duration_ms: timingAudit.total_operation,
        database_operations_ms: Object.values(
          timingAudit.prisma_operations,
        ).reduce((a, b) => a + b, 0),
        cache_operations_ms: timingAudit.external_services.cache_operations,
      },
    });
  } catch (error) {
    timingAudit.total_operation = Date.now() - operationStart;

    logger.error('USER_CERT_REGISTER_ERROR', {
      error: error instanceof Error ? error.message : 'Unknown error',
      timing_audit: timingAudit,
      user_id: req.params?.user_id,
      cert_id: req.body?.cert_id,
      structured_data: true,
    });

    if (
      error instanceof Error &&
      error.name === 'PrismaClientKnownRequestError'
    ) {
      // Handle specific Prisma errors
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      if (error.code === 'P2002') {
        // Unique constraint failed - user already registered for this certification
        res.status(409).json({
          success: false,
          error: 'This certification is already registered for the user.',
          errorCode: 'CERTIFICATION_ALREADY_REGISTERED',
        });
        return;
      }
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      if (error.code === 'P2003') {
        // Foreign key constraint failed
        res.status(400).json({
          success: false,
          error: 'Invalid user_id or cert_id.',
          errorCode: 'INVALID_FOREIGN_KEY',
        });
        return;
      }
    }

    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      errorCode: 'INTERNAL_SERVER_ERROR',
    });
  }
};

export default handler;
