import prismaInstance from '../services/prisma';

async function main() {
  const usersToProcess = [
    {
      firebase_user_id: '2GzVTQIKe3dQBeHONzrnYO7pObj1',
    },
    // You can add more users here if needed, e.g.:
    // { firebase_user_id: 'tyPOPiI7DXdO9sXiyjL8aAQTJ412' },
  ];

  const targetCertId = 2;
  const numberOfQuestions = 20;

  console.log(`Starting to create exams for cert ID: ${targetCertId} with up to ${numberOfQuestions} questions.`);

  for (const userData of usersToProcess) {
    try {
      // 1. Find the user by firebase_user_id
      const user = await prismaInstance.users.findUnique({
        where: { firebase_user_id: userData.firebase_user_id },
      });

      if (!user) {
        console.warn(`User with firebase_user_id: ${userData.firebase_user_id} not found. Skipping exam creation.`);
        continue;
      }

      // 2. Fetch quiz questions for the target certification
      // Order by a random factor or by creation date if you want variety/consistency
      const questions = await prismaInstance.quizQuestions.findMany({
        where: { cert_id: targetCertId },
        take: numberOfQuestions,
        select: { quiz_question_id: true }, // Only need IDs for connecting
        // orderBy: { createdAt: 'asc' }, // Optional: for consistent question sets if re-run
      });

      if (questions.length === 0) {
        console.warn(`No quiz questions found for cert ID: ${targetCertId}. Cannot create exam for user ${user.user_id} (${userData.firebase_user_id}).`);
        continue;
      }

      if (questions.length < numberOfQuestions) {
        console.warn(`Warning: Fetched only ${questions.length} questions for cert ID: ${targetCertId} (requested ${numberOfQuestions}). Exam for user ${user.user_id} will be created with these available questions.`);
      }

      // 3. Create the exam and link answers
      const newExam = await prismaInstance.exams.create({
        data: {
          user: {
            connect: { user_id: user.user_id },
          },
          certification: {
            connect: { cert_id: targetCertId },
          },
          // score and submitted_at will be null/default initially
          answers: {
            create: questions.map((question) => ({
              quizQuestion: {
                connect: { quiz_question_id: question.quiz_question_id },
              },
              // selected_option_id and is_correct will be null initially as the exam is new
            })),
          },
        },
      });

      console.log(`Successfully created exam ID: ${newExam.exam_id} for user ${user.user_id} (${userData.firebase_user_id}) with ${questions.length} questions.`);

    } catch (error) {
      console.error(`Failed to create exam for user ${userData.firebase_user_id}:`, error);
    }
  }

  console.log('Exam seeding process completed.');
}

main()
  .catch((e) => {
    console.error('Error during exam seeding process:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prismaInstance.$disconnect();
  });
