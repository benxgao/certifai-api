import prismaInstance from '../services/prisma';

async function main() {
  const targetCertId = 2; // Assuming cert_id for 'google professional cloud developer'
  const topicNames = [
    'Designing and Developing Cloud-Native Applications',
    'Managing Application Data',
    'Securing Applications and Data',
    'Deploying and Operating Applications',
    'Monitoring and Troubleshooting Applications',
  ];

  console.log(`Seeding topics for certification ID: ${targetCertId} (Google Professional Cloud Developer)`);

  for (const topicName of topicNames) {
    try {
      // Create the Topic
      let topic = await prismaInstance.topic.findUnique({
        where: { name: topicName },
      });

      if (!topic) {
        topic = await prismaInstance.topic.create({
          data: {
            name: topicName,
          },
        });
        console.log(`Created topic: '${topic.name}' (ID: ${topic.id})`);
      } else {
        console.log(`Topic '${topic.name}' already exists (ID: ${topic.id})`);
      }

      // Link Topic to Certification if not already linked
      const existingLink = await prismaInstance.certTopic.findUnique({
        where: {
          cert_id_topic_id: {
            cert_id: targetCertId,
            topic_id: topic.id,
          },
        },
      });

      if (!existingLink) {
        await prismaInstance.certTopic.create({
          data: {
            cert_id: targetCertId,
            topic_id: topic.id,
          },
        });
        console.log(`Linked topic '${topic.name}' to certification ID ${targetCertId}`);
      } else {
        console.log(`Topic '${topic.name}' already linked to certification ID ${targetCertId}`);
      }

    } catch (error: any) { // Added type annotation for error
      if (error.code === 'P2002') { // Unique constraint failed (should be less likely with checks)
        console.warn(`Skipping due to potential unique constraint conflict for topic: "${topicName}". This might indicate a race condition or an unexpected state.`);
      } else {
        console.error(`Error processing topic "${topicName}":`, error);
        // Decide if you want to re-throw or continue with other topics
        // throw error;
      }
    }
  }

  console.log('Topics and certification links seeding process completed.');
}

main()
  .catch((e) => {
    console.error('Error during topic seeding process:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prismaInstance.$disconnect();
  });
