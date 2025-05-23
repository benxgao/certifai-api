import prismaInstance from '../services/prisma';

// Define simulated questions and answers
const simulatedQuestionsByTopic: Record<string, Array<any>> = {
  'Designing and Developing Cloud-Native Applications': [
    {
      question_body: 'When designing a microservices architecture on Google Cloud, which service is primarily recommended for orchestrating containerized applications?',
      difficulty: 'Intermediate',
      explanations: 'GKE is Google Cloud\'s managed Kubernetes service, ideal for deploying, managing, and scaling containerized applications, which are a core component of microservices.',
      answerOptions: [
        { option_text: 'Cloud Functions', is_correct: false },
        { option_text: 'Google Kubernetes Engine (GKE)', is_correct: true },
        { option_text: 'App Engine Standard', is_correct: false },
        { option_text: 'Compute Engine', is_correct: false },
      ],
    },
    {
      question_body: 'Your application needs to process event-driven workloads and scale to zero when not in use. Which Google Cloud compute service is most suitable?',
      difficulty: 'Beginner',
      explanations: 'Cloud Functions is a serverless execution environment for building and connecting cloud services. It automatically scales based on load and can scale to zero.',
      answerOptions: [
        { option_text: 'Compute Engine', is_correct: false },
        { option_text: 'Google Kubernetes Engine (GKE)', is_correct: false },
        { option_text: 'Cloud Functions', is_correct: true },
        { option_text: 'App Engine Flexible', is_correct: false },
      ],
    },
    {
      question_body: 'Which Google Cloud service provides a fully managed environment for running containerized applications without needing to manage the underlying infrastructure like GKE clusters?',
      difficulty: 'Intermediate',
      explanations: 'Cloud Run allows you to run stateless containers in a fully managed environment, abstracting away all infrastructure management.',
      answerOptions: [
        { option_text: 'Compute Engine', is_correct: false },
        { option_text: 'Cloud Run', is_correct: true },
        { option_text: 'App Engine Standard', is_correct: false },
        { option_text: 'Bare Metal Solution', is_correct: false },
      ],
    },
    {
      question_body: 'When building a new API on Google Cloud, which service is recommended for creating, deploying, and managing APIs, including features like authentication, monitoring, and quotas?',
      difficulty: 'Intermediate',
      explanations: 'Apigee (and Cloud Endpoints for simpler use cases) are designed for API management on Google Cloud.',
      answerOptions: [
        { option_text: 'Cloud Functions', is_correct: false },
        { option_text: 'Cloud Load Balancing', is_correct: false },
        { option_text: 'Apigee API Management', is_correct: true },
        { option_text: 'Cloud DNS', is_correct: false },
      ],
    },
    {
      question_body: 'For an application that requires durable, low-latency message queuing to decouple services, which Google Cloud service is most appropriate?',
      difficulty: 'Beginner',
      explanations: 'Pub/Sub is a scalable, durable, and global messaging service that allows services to communicate asynchronously.',
      answerOptions: [
        { option_text: 'Cloud Storage', is_correct: false },
        { option_text: 'Memorystore', is_correct: false },
        { option_text: 'Cloud Pub/Sub', is_correct: true },
        { option_text: 'Cloud Tasks', is_correct: false },
      ],
    },
    {
      question_body: 'Which Google Cloud service is best suited for storing and serving large, unstructured data sets, such as images and videos, with high throughput?',
      difficulty: 'Advanced',
      explanations: 'Cloud Storage is designed for high-throughput access to large, unstructured data sets, making it ideal for serving media content.',
      answerOptions: [
        { option_text: 'Cloud SQL', is_correct: false },
        { option_text: 'Cloud Spanner', is_correct: false },
        { option_text: 'Cloud Storage', is_correct: true },
        { option_text: 'Bigtable', is_correct: false },
      ],
    },
    {
      question_body: 'Your company is building a data lake on Google Cloud to store structured and semi-structured data for analytics. Which storage solution should you use?',
      difficulty: 'Advanced',
      explanations: 'Cloud Storage is commonly used for data lakes due to its ability to store vast amounts of unstructured data at low cost.',
      answerOptions: [
        { option_text: 'Cloud SQL', is_correct: false },
        { option_text: 'Cloud Spanner', is_correct: false },
        { option_text: 'Cloud Storage', is_correct: true },
        { option_text: 'Firestore', is_correct: false },
      ],
    },
    {
      question_body: 'To ensure your application can scale to handle variable workloads, which Google Cloud feature should you implement?',
      difficulty: 'Beginner',
      explanations: 'Google Cloud offers various scaling options, including autoscaling for GKE and Compute Engine, and serverless options like Cloud Functions and Cloud Run.',
      answerOptions: [
        { option_text: 'Manual scaling only', is_correct: false },
        { option_text: 'Using only preemptible VMs', is_correct: false },
        { option_text: 'Autoscaling and serverless options', is_correct: true },
        { option_text: 'Deploying in a single region', is_correct: false },
      ],
    },
  ],
  'Managing Application Data': [
    {
      question_body: 'You need a globally distributed, strongly consistent, relational database for your application. Which Google Cloud database service should you choose?',
      difficulty: 'Intermediate',
      explanations: 'Cloud Spanner is a fully managed, mission-critical, relational database service that offers transactional consistency at global scale, schemas, SQL, and automatic, synchronous replication for high availability.',
      answerOptions: [
        { option_text: 'Cloud SQL', is_correct: false },
        { option_text: 'Cloud Spanner', is_correct: true },
        { option_text: 'Bigtable', is_correct: false },
        { option_text: 'Firestore', is_correct: false },
      ],
    },
    {
      question_body: 'For an application requiring a highly scalable NoSQL document database with real-time synchronization capabilities, which service is the best fit?',
      difficulty: 'Beginner',
      explanations: 'Firestore is a NoSQL document database built for automatic scaling, high performance, and ease of application development, offering real-time synchronization.',
      answerOptions: [
        { option_text: 'Cloud SQL for PostgreSQL', is_correct: false },
        { option_text: 'Cloud Spanner', is_correct: false },
        { option_text: 'Firestore', is_correct: true },
        { option_text: 'Memorystore', is_correct: false },
      ],
    },
    {
      question_body: 'Your application requires a managed in-memory data store service for caching and session management. Which Google Cloud service should you use?',
      difficulty: 'Beginner',
      explanations: 'Memorystore provides fully managed Redis and Memcached services for use cases like caching and session management.',
      answerOptions: [
        { option_text: 'Cloud SQL', is_correct: false },
        { option_text: 'Firestore', is_correct: false },
        { option_text: 'Memorystore', is_correct: true },
        { option_text: 'Bigtable', is_correct: false },
      ],
    },
    {
      question_body: 'Which Google Cloud storage service is best suited for storing large, immutable binary objects like images, videos, and backups at low cost?',
      difficulty: 'Beginner',
      explanations: 'Cloud Storage is designed for storing and retrieving any amount of data at any time, suitable for unstructured data like blobs and objects.',
      answerOptions: [
        { option_text: 'Cloud Spanner', is_correct: false },
        { option_text: 'Cloud Storage', is_correct: true },
        { option_text: 'Persistent Disk', is_correct: false },
        { option_text: 'Filestore', is_correct: false },
      ],
    },
    {
      question_body: 'You need to perform complex analytical queries on petabytes of data using SQL. Which Google Cloud service is optimized for this use case?',
      difficulty: 'Intermediate',
      explanations: 'BigQuery is a serverless, highly scalable, and cost-effective multicloud data warehouse designed for business agility.',
      answerOptions: [
        { option_text: 'Cloud SQL', is_correct: false },
        { option_text: 'BigQuery', is_correct: true },
        { option_text: 'Datastore (now Firestore in Datastore mode)', is_correct: false },
        { option_text: 'Cloud Spanner', is_correct: false },
      ],
    },
    {
      question_body: 'Which Google Cloud service should you use to migrate an on-premises Oracle database to Google Cloud with minimal downtime?',
      difficulty: 'Advanced',
      explanations: 'Database Migration Service supports online migrations with minimal downtime for Oracle databases to Cloud SQL or other Google Cloud databases.',
      answerOptions: [
        { option_text: 'Cloud SQL', is_correct: false },
        { option_text: 'Cloud Spanner', is_correct: false },
        { option_text: 'Database Migration Service', is_correct: true },
        { option_text: 'Cloud Dataflow', is_correct: false },
      ],
    },
    {
      question_body: 'To analyze streaming data in real-time and store it for batch processing later, which Google Cloud service combination is ideal?',
      difficulty: 'Advanced',
      explanations: 'Using Cloud Pub/Sub for real-time messaging and Cloud Storage or BigQuery for storage allows for both real-time and batch processing of data.',
      answerOptions: [
        { option_text: 'Cloud Functions and Cloud SQL', is_correct: false },
        { option_text: 'Cloud Pub/Sub and Cloud Storage', is_correct: true },
        { option_text: 'Cloud Run and Bigtable', is_correct: false },
        { option_text: 'Compute Engine and Cloud Spanner', is_correct: false },
      ],
    },
    {
      question_body: 'What is the recommended approach to ensure data consistency when migrating from an on-premises database to Cloud SQL?',
      difficulty: 'Advanced',
      explanations: 'Using Database Migration Service with change data capture (CDC) ensures that ongoing changes are captured and applied to the Cloud SQL database, maintaining consistency.',
      answerOptions: [
        { option_text: 'Export and import data dumps', is_correct: false },
        { option_text: 'Use Cloud Storage transfer service', is_correct: false },
        { option_text: 'Database Migration Service with CDC', is_correct: true },
        { option_text: 'Manually sync data using scripts', is_correct: false },
      ],
    },
  ],
  'Securing Applications and Data': [
    {
      question_body: 'What is the primary Google Cloud service for managing encryption keys for your data at rest?',
      difficulty: 'Intermediate',
      explanations: 'Cloud KMS allows you to create, import, and manage cryptographic keys and perform cryptographic operations in a centralized cloud service for use in your other Google Cloud services.',
      answerOptions: [
        { option_text: 'Identity Platform', is_correct: false },
        { option_text: 'Cloud Key Management Service (KMS)', is_correct: true },
        { option_text: 'Secret Manager', is_correct: false },
        { option_text: 'Security Command Center', is_correct: false },
      ],
    },
    {
      question_body: 'To securely store and manage API keys, passwords, and certificates for your applications on Google Cloud, which service should you use?',
      difficulty: 'Beginner',
      explanations: 'Secret Manager provides a secure and convenient way to store API keys, passwords, certificates, and other sensitive data.',
      answerOptions: [
        { option_text: 'Cloud KMS', is_correct: false },
        { option_text: 'Cloud Storage', is_correct: false },
        { option_text: 'Secret Manager', is_correct: true },
        { option_text: 'Cloud IAM', is_correct: false },
      ],
    },
    {
      question_body: 'Which Google Cloud service helps you define and enforce fine-grained access control policies for your Google Cloud resources?',
      difficulty: 'Beginner',
      explanations: 'Cloud IAM (Identity and Access Management) allows you to grant granular access to specific Google Cloud resources and prevents unwanted access from other resources.',
      answerOptions: [
        { option_text: 'Cloud Armor', is_correct: false },
        { option_text: 'Cloud IAM', is_correct: true },
        { option_text: 'VPC Service Controls', is_correct: false },
        { option_text: 'Security Command Center', is_correct: false },
      ],
    },
    {
      question_body: 'To protect your web applications and APIs from DDoS attacks and web application exploits like SQL injection, which Google Cloud service should be used?',
      difficulty: 'Intermediate',
      explanations: 'Cloud Armor provides DDoS protection and Web Application Firewall (WAF) capabilities to defend your applications.',
      answerOptions: [
        { option_text: 'Cloud Firewall Rules', is_correct: false },
        { option_text: 'Cloud Armor', is_correct: true },
        { option_text: 'BeyondCorp Enterprise', is_correct: false },
        { option_text: 'Cloud IDS', is_correct: false },
      ],
    },
    {
      question_body: 'What is the purpose of VPC Service Controls in Google Cloud?',
      difficulty: 'Advanced',
      explanations: 'VPC Service Controls allow you to define a security perimeter around Google-managed services to prevent data exfiltration.',
      answerOptions: [
        { option_text: 'To manage firewall rules for Compute Engine instances', is_correct: false },
        { option_text: 'To create private connections to on-premises networks', is_correct: false },
        { option_text: 'To prevent data exfiltration by creating service perimeters', is_correct: true },
        { option_text: 'To manage SSL certificates for load balancers', is_correct: false },
      ],
    },
    {
      question_body: 'Which Google Cloud service provides a centralized way to manage and rotate SSL/TLS certificates for your Google Cloud resources?',
      difficulty: 'Advanced',
      explanations: 'Certificate Manager allows you to manage SSL/TLS certificates for your Google Cloud resources, including automatic renewal and deployment.',
      answerOptions: [
        { option_text: 'Cloud KMS', is_correct: false },
        { option_text: 'Secret Manager', is_correct: false },
        { option_text: 'Certificate Manager', is_correct: true },
        { option_text: 'Cloud IAM', is_correct: false },
      ],
    },
    {
      question_body: 'To ensure that your Google Cloud resources are not publicly accessible and can only be accessed through specified IP ranges, which feature should you use?',
      difficulty: 'Advanced',
      explanations: 'VPC Service Controls allow you to create a security perimeter around your Google Cloud resources, restricting access to specified IP ranges and preventing data exfiltration.',
      answerOptions: [
        { option_text: 'Cloud Armor', is_correct: false },
        { option_text: 'VPC Service Controls', is_correct: true },
        { option_text: 'Firewall Rules', is_correct: false },
        { option_text: 'Cloud IDS', is_correct: false },
      ],
    },
  ],
  'Deploying and Operating Applications': [
    {
      question_body: 'Which Google Cloud tool provides a centralized dashboard for managing and observing your applications deployed across various services like GKE and App Engine?',
      difficulty: 'Intermediate',
      explanations: 'Cloud Operations suite (including Monitoring, Logging, Trace) provides powerful observability tools for applications running on Google Cloud.',
      answerOptions: [
        { option_text: 'Cloud Build', is_correct: false },
        { option_text: 'Cloud Operations (formerly Stackdriver)', is_correct: true },
        { option_text: 'Deployment Manager', is_correct: false },
        { option_text: 'Cloud Source Repositories', is_correct: false },
      ],
    },
    {
      question_body: 'You want to automate your build, test, and deployment pipeline on Google Cloud. Which service is designed for this purpose?',
      difficulty: 'Beginner',
      explanations: 'Cloud Build is a service that executes your builds on Google Cloud. It can import source code from various repositories or cloud storage spaces, execute a build to your specifications, and produce artifacts.',
      answerOptions: [
        { option_text: 'Cloud Functions', is_correct: false },
        { option_text: 'Cloud Run', is_correct: false },
        { option_text: 'Cloud Build', is_correct: true },
        { option_text: 'Artifact Registry', is_correct: false },
      ],
    },
    {
      question_body: 'Which Google Cloud service allows you to manage infrastructure as code using declarative configuration files?',
      difficulty: 'Intermediate',
      explanations: 'Cloud Deployment Manager allows you to specify all the resources needed for your application in a declarative format using yaml.',
      answerOptions: [
        { option_text: 'Cloud Shell', is_correct: false },
        { option_text: 'Cloud Deployment Manager', is_correct: true },
        { option_text: 'Terraform on Google Cloud', is_correct: false },
        { option_text: 'Ansible on Google Cloud', is_correct: false },
      ],
    },
    {
      question_body: 'For applications running on Compute Engine, what is the recommended way to manage software updates and configurations consistently across multiple instances?',
      difficulty: 'Intermediate',
      explanations: 'OS Configuration management (part of VM Manager) allows you to deploy, query, and maintain consistent configurations for your VMs.',
      answerOptions: [
        { option_text: 'Manually SSHing into each instance', is_correct: false },
        { option_text: 'Using startup scripts only', is_correct: false },
        { option_text: 'OS Configuration management (VM Manager)', is_correct: true },
        { option_text: 'Cloud Build', is_correct: false },
      ],
    },
    {
      question_body: 'What is a common strategy for achieving high availability for applications deployed on Compute Engine across different zones?',
      difficulty: 'Beginner',
      explanations: 'Deploying instances in multiple zones within a region and using a load balancer to distribute traffic is a common HA strategy.',
      answerOptions: [
        { option_text: 'Deploying all instances in a single zone', is_correct: false },
        { option_text: 'Using preemptible VMs exclusively', is_correct: false },
        { option_text: 'Deploying instances in multiple zones with a regional load balancer', is_correct: true },
        { option_text: 'Relying solely on instance autohealing', is_correct: false },
      ],
    },
    {
      question_body: 'Which Google Cloud service provides a managed environment for deploying, managing, and scaling containerized applications using Kubernetes?',
      difficulty: 'Intermediate',
      explanations: 'Google Kubernetes Engine (GKE) is a managed environment for deploying, managing, and scaling containerized applications using Google Cloud\'s infrastructure.',
      answerOptions: [
        { option_text: 'Cloud Functions', is_correct: false },
        { option_text: 'Google Kubernetes Engine (GKE)', is_correct: true },
        { option_text: 'App Engine Standard', is_correct: false },
        { option_text: 'Compute Engine', is_correct: false },
      ],
    },
    {
      question_body: 'To enable continuous integration and continuous delivery (CI/CD) for your applications on Google Cloud, which combination of services would you use?',
      difficulty: 'Advanced',
      explanations: 'Using Cloud Build for building and testing, Cloud Source Repositories for source control, and Cloud Deploy for delivery enables a full CI/CD pipeline on Google Cloud.',
      answerOptions: [
        { option_text: 'Cloud Build, Cloud Source Repositories, and Cloud Deploy', is_correct: true },
        { option_text: 'Cloud Functions and Cloud Run', is_correct: false },
        { option_text: 'Compute Engine and App Engine', is_correct: false },
        { option_text: 'Cloud Storage and BigQuery', is_correct: false },
      ],
    },
    {
      question_body: 'What is the purpose of using a load balancer in front of your Compute Engine instances?',
      difficulty: 'Beginner',
      explanations: 'A load balancer distributes incoming traffic across multiple Compute Engine instances, ensuring no single instance bears too much load and improving application availability.',
      answerOptions: [
        { option_text: 'To increase the storage capacity of your instances', is_correct: false },
        { option_text: 'To distribute incoming traffic and improve availability', is_correct: true },
        { option_text: 'To manage SSL certificates for your domain', is_correct: false },
        { option_text: 'To automatically scale your instances vertically', is_correct: false },
      ],
    },
  ],
  'Monitoring and Troubleshooting Applications': [
    {
      question_body: 'Which component of the Cloud Operations suite is primarily used for collecting, searching, analyzing, and alerting on log data from Google Cloud services and applications?',
      difficulty: 'Intermediate',
      explanations: 'Cloud Logging allows you to store, search, analyze, monitor, and alert on logging data and events from Google Cloud and Amazon Web Services.',
      answerOptions: [
        { option_text: 'Cloud Monitoring', is_correct: false },
        { option_text: 'Cloud Logging', is_correct: true },
        { option_text: 'Cloud Trace', is_correct: false },
        { option_text: 'Cloud Profiler', is_correct: false },
      ],
    },
    {
      question_body: 'To understand the latency of requests as they propagate through different services in your distributed application, which Cloud Operations tool is most appropriate?',
      difficulty: 'Beginner',
      explanations: 'Cloud Trace is a distributed tracing system that collects latency data from your applications and displays it in the Google Cloud Console.',
      answerOptions: [
        { option_text: 'Cloud Logging', is_correct: false },
        { option_text: 'Cloud Monitoring', is_correct: false },
        { option_text: 'Cloud Trace', is_correct: true },
        { option_text: 'Cloud Debugger', is_correct: false },
      ],
    },
    {
      question_body: 'Which Cloud Operations tool helps you understand the performance characteristics of your application code by sampling and analyzing CPU and memory usage?',
      difficulty: 'Intermediate',
      explanations: 'Cloud Profiler continuously analyzes the performance of applications running on Google Cloud, helping identify bottlenecks.',
      answerOptions: [
        { option_text: 'Cloud Logging', is_correct: false },
        { option_text: 'Cloud Profiler', is_correct: true },
        { option_text: 'Cloud Monitoring Dashboards', is_correct: false },
        { option_text: 'Error Reporting', is_correct: false },
      ],
    },
    {
      question_body: 'You want to be alerted when the 99th percentile latency of your App Engine service exceeds a certain threshold. Which Cloud Operations service would you use to configure this alert?',
      difficulty: 'Intermediate',
      explanations: 'Cloud Monitoring allows you to create alerting policies based on metrics, including latency metrics for App Engine services.',
      answerOptions: [
        { option_text: 'Cloud Trace', is_correct: false },
        { option_text: 'Cloud Logging', is_correct: false },
        { option_text: 'Cloud Monitoring', is_correct: true },
        { option_text: 'Cloud Debugger', is_correct: false },
      ],
    },
    {
      question_body: 'What is the primary purpose of Error Reporting in the Cloud Operations suite?',
      difficulty: 'Beginner',
      explanations: 'Error Reporting automatically collects, groups, and displays errors produced by your running cloud services, helping you identify and understand application crashes.',
      answerOptions: [
        { option_text: 'To trace requests across distributed services', is_correct: false },
        { option_text: 'To aggregate and analyze application logs', is_correct: false },
        { option_text: 'To automatically identify and group application errors and crashes', is_correct: true },
        { option_text: 'To profile CPU and memory usage of applications', is_correct: false },
      ],
    },
    {
      question_body: 'Which Google Cloud service provides real-time monitoring and logging for applications running on Google Cloud, allowing you to view logs and metrics in one place?',
      difficulty: 'Beginner',
      explanations: 'Cloud Operations suite provides integrated monitoring and logging for Google Cloud applications, allowing you to view and analyze logs and metrics in one place.',
      answerOptions: [
        { option_text: 'Cloud Build', is_correct: false },
        { option_text: 'Cloud Operations (formerly Stackdriver)', is_correct: true },
        { option_text: 'Deployment Manager', is_correct: false },
        { option_text: 'Cloud Source Repositories', is_correct: false },
      ],
    },
    {
      question_body: 'To troubleshoot performance issues in your application, you need to analyze the request traces and see how requests propagate through your services. Which tool would you use?',
      difficulty: 'Intermediate',
      explanations: 'Cloud Trace allows you to analyze the latency of requests and how they propagate through your application, helping identify bottlenecks and performance issues.',
      answerOptions: [
        { option_text: 'Cloud Logging', is_correct: false },
        { option_text: 'Cloud Monitoring', is_correct: false },
        { option_text: 'Cloud Trace', is_correct: true },
        { option_text: 'Cloud Debugger', is_correct: false },
      ],
    },
  ],
};

async function main() {
  const targetCertId = 2; // Assuming cert_id for 'Google Professional Cloud Developer'
  console.log(`Starting to seed quiz questions for certification ID: ${targetCertId}`);

  const certificationWithTopics = await prismaInstance.certifications.findUnique({
    where: { cert_id: targetCertId },
    include: {
      certTopics: { // CORRECTED: Was certificationTopics
        include: {
          topic: true, // Include the actual Topic model
        },
      },
    },
  });

  if (!certificationWithTopics) {
    console.error(`Certification with ID ${targetCertId} not found.`);
    return; // Exit if certification not found
  }

  if (!certificationWithTopics.certTopics || certificationWithTopics.certTopics.length === 0) { // CORRECTED: Was certificationTopics
    console.log(`No topics found for certification ID ${targetCertId}. Skipping question seeding.`);
    return; // Exit if no topics are linked
  }

  for (const certTopic of certificationWithTopics.certTopics) { // CORRECTED: Was certificationTopics
    const topic = certTopic.topic;
    if (!topic || !topic.name) {
      console.warn(`  Skipping a certificationTopic entry for cert ID ${targetCertId} as the linked topic or topic name is missing.`);
      continue;
    }
    console.log(`Processing topic: "${topic.name}" (ID: ${topic.id}) for cert ID: ${targetCertId}`);

    const questionsForTopic = simulatedQuestionsByTopic[topic.name];
    if (!questionsForTopic || questionsForTopic.length === 0) {
      console.log(`  No simulated questions found for topic "${topic.name}". Skipping.`);
      continue;
    }

    for (const qData of questionsForTopic) {
      try {
        const newQuestion = await prismaInstance.quizQuestions.create({
          data: {
            cert_id: targetCertId,
            topic_id: topic.id,
            difficulty: qData.difficulty,
            question_body: qData.question_body,
            explanations: qData.explanations,
            answerOptions: {
              create: qData.answerOptions.map((opt: any) => ({
                option_text: opt.option_text,
                is_correct: opt.is_correct,
              })),
            },
          },
        });
        console.log(`  Successfully created question: "${qData.question_body.substring(0, 50)}..." for topic "${topic.name}" (ID: ${newQuestion.quiz_question_id})`);
      } catch (error) {
        console.error(`  Failed to create question "${qData.question_body.substring(0,50)}..." for topic "${topic.name}":`, error);
      }
    }
  }
  console.log('Simulated quiz questions seeding process completed.');
}

main()
  .catch((e) => {
    console.error('Error during quiz question seeding process:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prismaInstance.$disconnect();
  });
