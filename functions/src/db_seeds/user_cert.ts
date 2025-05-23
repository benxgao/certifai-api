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
    await prismaInstance.userCertification.create({
      data: {
        user: {
          connect: {
            firebase_user_id: user.firebase_user_id,
          },
        },
        certification: {
          connect: {
            cert_id: 2,
          },
        },
        status: 'IN_PROGRESS', // Added status
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
