import prismaInstance from '../services/prisma';

async function main() {
  const users = [
    {
      firebase_user_id: 'tyPOPiI7DXdO9sXiyjL8aAQTJ412',
    },
    {
      firebase_user_id: '2GzVTQIKe3dQBeHONzrnYO7pObj1',
    },
  ];

  for (const user of users) {
    await prismaInstance.exams.create({
      data: {

      },
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
