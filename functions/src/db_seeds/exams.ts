import prismaInstance from '../services/prisma';

async function main() {
  const certifications = [];

  for (const certification of certifications) {
    await prismaInstance.quizQuestions.create({
      data: {},
    });
  }

  console.log('User certifications seeded successfully'); // Updated log message
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prismaInstance.$disconnect();
  });
