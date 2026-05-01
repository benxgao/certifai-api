/**
 * Prisma model type re-exports.
 *
 * Source of truth is the Prisma schema. These aliases provide a stable
 * import surface from `@/src/types` for app code.
 */

/**
 * Firm record
 * @see functions/prisma/schema.prisma:43
 * @prismaModel Firm
 */
export type Firm = import('../generated/prisma/client').Firm;

/**
 * Certification record
 * @see functions/prisma/schema.prisma:59
 * @prismaModel Certification
 */
export type Certification = import('../generated/prisma/client').Certification;

/**
 * User record
 * @see functions/prisma/schema.prisma:81
 * @prismaModel User
 */
export type User = import('../generated/prisma/client').User;

/**
 * UserCertification record
 * @see functions/prisma/schema.prisma:96
 * @prismaModel UserCertification
 */
export type UserCertification = import('../generated/prisma/client').UserCertification;

/**
 * QuizQuestion record
 * @see functions/prisma/schema.prisma:112
 * @prismaModel QuizQuestion
 */
export type QuizQuestion = import('../generated/prisma/client').QuizQuestion;

/**
 * AnswerOption record
 * @see functions/prisma/schema.prisma:134
 * @prismaModel AnswerOption
 */
export type AnswerOption = import('../generated/prisma/client').AnswerOption;

/**
 * ExamAttempt record
 * @see functions/prisma/schema.prisma:149
 * @prismaModel ExamAttempt
 */
export type ExamAttempt = import('../generated/prisma/client').ExamAttempt;

/**
 * ExamUserAnswer record
 * @see functions/prisma/schema.prisma:170
 * @prismaModel ExamUserAnswer
 */
export type ExamUserAnswer = import('../generated/prisma/client').ExamUserAnswer;
