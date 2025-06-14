import { Response } from 'express';
import logger from '../../../../services/firebase/logger';
import { CustomRequest } from '../../../../types';

import prismaInstance, {
  CertificationStatus,
} from '../../../../services/prisma';

const handler = async (req: any | CustomRequest, res: Response) => {
  try {
    const { user_id } = req.params;
    const { cert_id } = req.body;

    if (!user_id) {
      res.status(400).json({
        success: false,
        error: 'user_id is required in params',
      });
    }

    if (!cert_id) {
      res.status(400).json({
        success: false,
        error: 'cert_id is required in body',
      });
    }

    logger.info(
      `Registering certification ${cert_id} for user ${user_id} with status IN_PROGRESS`,
    );

    const newCertificationRegistration =
      await prismaInstance.userCertification.create({
        data: {
          user_id: user_id as string,
          cert_id: parseInt(cert_id as string, 10),
          status: CertificationStatus.IN_PROGRESS,
        },
      });

    res.status(201).json({
      success: true,
      data: newCertificationRegistration,
    });
  } catch (error) {
    logger.error(`Error in user certification registration endpoint: ${error}`);

    if (
      error instanceof Error &&
      error.name === 'PrismaClientKnownRequestError'
    ) {
      // Handle specific Prisma errors, e.g., unique constraint violation or foreign key constraint
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      if (error.code === 'P2002') {
        // Unique constraint failed
        res.status(409).json({
          success: false,
          error: 'This certification is already registered for the user.',
        });
      }
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      if (error.code === 'P2003') {
        // Foreign key constraint failed
        res.status(400).json({
          success: false,
          error: 'Invalid user_id or cert_id.',
        });
      }
    }
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
};

export default handler;
