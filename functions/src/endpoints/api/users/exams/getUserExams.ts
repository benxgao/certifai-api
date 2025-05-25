import { Response } from 'express';
import logger from '../../../../services/firebase/logger';
import { CustomRequest } from '../../../../types';
import prismaInstance from '../../../../services/prisma';

const handler = async (req: any | CustomRequest, res: Response) => {
  try {
    const { user_id } = req.params;
    const { cert_id } = req.query; // Add this line to get cert_id from query

    if (!user_id) {
      res.status(400).json({
        success: false,
        error: 'User ID is required.',
      });
      return;
    }

    logger.info(
      `Fetching exams for user_id: ${user_id}${
        cert_id ? ` and cert_id: ${cert_id}` : ''
      }`,
    );

    const whereClause: any = {
      user_id: user_id,
    };

    if (cert_id) {
      whereClause.cert_id = cert_id as string;
    }

    const examsFromDb = await prismaInstance.exams.findMany({
      where: whereClause, // Use the dynamically built whereClause
      include: {
        certification: true, // Include certification details
      },
    });

    // findMany returns an empty array if no records are found, so a 404 might not be appropriate here.
    // Sending a 200 with an empty array is common practice.
    // However, if the requirement is to return 404 for no exams, this check can be modified:
    // if (exams.length === 0) {
    //   res.status(404).json({
    //     success: false,
    //     error: 'No exams found for this user.',
    //   });
    //   return;
    // }

    const exams = examsFromDb.map((exam) => {
      let status = 'IN_PROGRESS';
      if (exam.submitted_at) {
        if (
          exam.score !== null &&
          exam.certification?.pass_score !== undefined
        ) {
          status =
            exam.score >= exam.certification.pass_score ? 'PASSED' : 'FAILED';
        } else {
          status = 'COMPLETED'; // Submitted but score or pass_score is not available
        }
      }
      return {
        ...exam,
        status,
      };
    });

    res.status(200).json({
      success: true,
      data: exams,
    });
  } catch (error) {
    logger.error('Error in getUserExams handler:', error as any);
    res
      .status(
        error instanceof Error && error.message === 'Unauthorized' ? 401 : 500,
      )
      .json({
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      });
  }
};

export default handler;
