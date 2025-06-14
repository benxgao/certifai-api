import prismaInstance from '../services/prisma';

// npx ts-node src/db/seed.ts

async function main() {
  // // Seed CertCategories
  // const certCategories = [
  //   { name: 'Cloud Computing' },
  //   { name: 'Data Engineering' },
  //   { name: 'Cybersecurity' },
  //   { name: 'Project Management' },
  //   { name: 'DevOps' },
  //   { name: 'Artificial Intelligence' },
  //   { name: 'Networking' },
  //   { name: 'Programming' },
  //   { name: 'Database Administration' },
  //   { name: 'Blockchain' },
  // ];

  // for (const category of certCategories) {
  //   await prismaInstance.certCategories.create({
  //     data: category,
  //   });
  // }

  // console.log('CertCategories seeded successfully.');

  // Refactor Certifications to link with CertCategories
  const certifications = [
    {
      name: 'AWS Certified Solutions Architect',
      exam_guide_url:
        'https://aws.amazon.com/certification/certified-solutions-architect-associate/',
      min_quiz_counts: 10,
      max_quiz_counts: 50,
      cert_category_id: 1, // Cloud Computing
      pass_score: 75.0,
    },
    {
      name: 'Google Cloud Professional Cloud Developer',
      exam_guide_url:
        'https://cloud.google.com/learn/certification/guides/cloud-developer',
      min_quiz_counts: 15,
      max_quiz_counts: 60,
      cert_category_id: 2, // Data Engineering
      pass_score: 80.0,
    },
    {
      name: 'Google Cloud Professional Data Engineer',
      exam_guide_url: 'https://cloud.google.com/certification/data-engineer',
      min_quiz_counts: 15,
      max_quiz_counts: 60,
      cert_category_id: 2, // Data Engineering
      pass_score: 80.0,
    },
    {
      name: 'Microsoft Certified: Azure Solutions Architect Expert',
      exam_guide_url:
        'https://learn.microsoft.com/en-us/certifications/azure-solutions-architect/',
      min_quiz_counts: 20,
      max_quiz_counts: 70,
      cert_category_id: 3, // Cybersecurity
      pass_score: 85.0,
    },
    {
      name: 'AWS Certified SysOps Administrator',
      exam_guide_url:
        'https://aws.amazon.com/certification/certified-sysops-administrator-associate/',
      min_quiz_counts: 10,
      max_quiz_counts: 40,
      cert_category_id: 1, // Cloud Computing
      pass_score: 72.0,
    },
    {
      name: 'Google Cloud Associate Cloud Engineer',
      exam_guide_url: 'https://cloud.google.com/certification/cloud-engineer',
      min_quiz_counts: 12,
      max_quiz_counts: 50,
      cert_category_id: 2, // Data Engineering
      pass_score: 75.0,
    },
    {
      name: 'Google Cloud Professional Cloud Architect',
      exam_guide_url: 'https://cloud.google.com/certification/cloud-architect',
      min_quiz_counts: 15,
      max_quiz_counts: 60,
      cert_category_id: 2, // Data Engineering
      pass_score: 80.0,
    },
    {
      name: 'Microsoft Certified: Azure Administrator Associate',
      exam_guide_url:
        'https://learn.microsoft.com/en-us/certifications/azure-administrator/',
      min_quiz_counts: 15,
      max_quiz_counts: 50,
      cert_category_id: 3, // Cybersecurity
      pass_score: 78.0,
    },
    {
      name: 'Microsoft Certified: Azure Developer Associate',
      exam_guide_url:
        'https://learn.microsoft.com/en-us/certifications/azure-developer/',
      min_quiz_counts: 15,
      max_quiz_counts: 50,
      cert_category_id: 3, // Cybersecurity
      pass_score: 75.0,
    },
    {
      name: 'Certified Kubernetes Administrator (CKA)',
      exam_guide_url:
        'https://training.linuxfoundation.org/certification/certified-kubernetes-administrator-cka/',
      min_quiz_counts: 20,
      max_quiz_counts: 60,
      cert_category_id: 5, // DevOps
      pass_score: 85.0,
    },
    {
      name: 'Certified Kubernetes Application Developer (CKAD)',
      exam_guide_url:
        'https://training.linuxfoundation.org/certification/certified-kubernetes-application-developer-ckad/',
      min_quiz_counts: 20,
      max_quiz_counts: 60,
      cert_category_id: 5, // DevOps
      pass_score: 80.0,
    },
    {
      name: 'Certified Information Systems Security Professional (CISSP)',
      exam_guide_url: 'https://www.isc2.org/Certifications/CISSP',
      min_quiz_counts: 25,
      max_quiz_counts: 70,
      cert_category_id: 6, // Cybersecurity
      pass_score: 85.0,
    },
    {
      name: 'AWS Certified Machine Learning – Specialty',
      exam_guide_url:
        'https://aws.amazon.com/certification/certified-machine-learning-specialty/',
      min_quiz_counts: 20,
      max_quiz_counts: 60,
      cert_category_id: 1, // Cloud Computing
      pass_score: 80.0,
    },
    {
      name: 'Google Cloud Professional Machine Learning Engineer',
      exam_guide_url:
        'https://cloud.google.com/certification/machine-learning-engineer',
      min_quiz_counts: 20,
      max_quiz_counts: 60,
      cert_category_id: 2, // Data Engineering
      pass_score: 80.0,
    },
  ];

  for (const cert of certifications) {
    await prismaInstance.certification.create({
      data: {
        name: cert.name,
        exam_guide_url: cert.exam_guide_url,
        min_quiz_counts: cert.min_quiz_counts,
        max_quiz_counts: cert.max_quiz_counts,
        pass_score: cert.pass_score,
        // cert_category_id: cert.cert_category_id,
      },
    });
  }

  console.log('Certifications linked with CertCategories seeded successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prismaInstance.$disconnect();
  });
