import { prisma } from './index'; // Corrected import to use named export

/**
 * Creates an Exam record in the database.
 * Fetches QuizQuestions based on the min and max quiz counts from the Certifications model.
 *
 * @param {number} certificationId - The ID of the certification.
 * @param {number} userId - The ID of the user taking the exam.
 * @returns {Promise<object>} - The created Exam record.
 */
export async function createExam(
  certificationId: number,
  userId: number,
): Promise<object> {
  // Fetch the certification details
  const certification = await prisma.certifications.findUnique({
    where: { cert_id: certificationId },
    select: { min_quiz_counts: true, max_quiz_counts: true },
  });

  if (!certification) {
    throw new Error('Certification not found');
  }

  const { min_quiz_counts, max_quiz_counts } = certification;

  // Fetch QuizQuestions from the database
  const quizQuestions = await prisma.quizQuestions.findMany({
    where: { cert_id: certificationId },
    take:
      Math.floor(Math.random() * (max_quiz_counts - min_quiz_counts + 1)) +
      min_quiz_counts,
  });

  if (quizQuestions.length === 0) {
    throw new Error('No QuizQuestions available');
  }

  // Create the Exam record
  const exam = await prisma.exams.create({
    data: {
      user_id: userId, // Added user_id
      cert_id: certificationId,
      quiz_question_id_list: JSON.stringify(
        quizQuestions.map((q) => q.quiz_question_id),
      ),
      score: 0, // Default score
      started_at: new Date(), // Current timestamp
    },
  });

  return exam;
}
