import prismaInstance from '../services/prisma';

// npx ts-node src/db/seed.ts

async function main() {
  // Seed CertCategories
  const certCategories = [
    { name: 'Cloud Computing' },
    { name: 'Data Engineering' },
    { name: 'Cybersecurity' },
    { name: 'Project Management' },
    { name: 'DevOps' },
    { name: 'Artificial Intelligence' },
    { name: 'Networking' },
    { name: 'Programming' },
    { name: 'Database Administration' },
    { name: 'Blockchain' },
  ];

  for (const category of certCategories) {
    await prismaInstance.certCategories.create({
      data: category,
    });
  }

  console.log('CertCategories seeded successfully.');

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
    // Adding 30 more mainstream certifications
    {
      name: 'AWS Certified Developer',
      exam_guide_url:
        'https://aws.amazon.com/certification/certified-developer-associate/',
      min_quiz_counts: 10,
      max_quiz_counts: 40,
      cert_category_id: 1, // Cloud Computing
      pass_score: 70.0,
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
      name: 'CompTIA Security+',
      exam_guide_url: 'https://www.comptia.org/certifications/security',
      min_quiz_counts: 20,
      max_quiz_counts: 60,
      cert_category_id: 4, // Project Management
      pass_score: 80.0,
    },
    {
      name: 'CompTIA Network+',
      exam_guide_url: 'https://www.comptia.org/certifications/network',
      min_quiz_counts: 15,
      max_quiz_counts: 50,
      cert_category_id: 4, // Project Management
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
      name: 'Certified Ethical Hacker (CEH)',
      exam_guide_url:
        'https://www.eccouncil.org/programs/certified-ethical-hacker-ceh/',
      min_quiz_counts: 20,
      max_quiz_counts: 60,
      cert_category_id: 6, // Cybersecurity
      pass_score: 80.0,
    },
    {
      name: 'PMP: Project Management Professional',
      exam_guide_url:
        'https://www.pmi.org/certifications/project-management-pmp',
      min_quiz_counts: 30,
      max_quiz_counts: 80,
      cert_category_id: 7, // Project Management
      pass_score: 85.0,
    },
    {
      name: 'Certified ScrumMaster (CSM)',
      exam_guide_url:
        'https://www.scrumalliance.org/get-certified/scrum-master-track/certified-scrummaster',
      min_quiz_counts: 15,
      max_quiz_counts: 50,
      cert_category_id: 7, // Project Management
      pass_score: 75.0,
    },
    {
      name: 'ITIL Foundation',
      exam_guide_url:
        'https://www.axelos.com/certifications/itil-certifications/itil-foundation',
      min_quiz_counts: 20,
      max_quiz_counts: 60,
      cert_category_id: 8, // DevOps
      pass_score: 80.0,
    },
    {
      name: 'Certified Data Professional (CDP)',
      exam_guide_url:
        'https://iccp.org/certification/certified-data-professional/',
      min_quiz_counts: 25,
      max_quiz_counts: 70,
      cert_category_id: 9, // Database Administration
      pass_score: 85.0,
    },
    {
      name: 'Certified Business Analysis Professional (CBAP)',
      exam_guide_url:
        'https://www.iiba.org/certification/core-business-analysis-certifications/cbap/',
      min_quiz_counts: 20,
      max_quiz_counts: 60,
      cert_category_id: 10, // Blockchain
      pass_score: 80.0,
    },
    {
      name: 'Oracle Certified Professional: Java SE Programmer',
      exam_guide_url:
        'https://education.oracle.com/java-se-programmer/trackp_333',
      min_quiz_counts: 20,
      max_quiz_counts: 60,
      cert_category_id: 11, // Programming
      pass_score: 80.0,
    },
    {
      name: 'Red Hat Certified Engineer (RHCE)',
      exam_guide_url: 'https://www.redhat.com/en/services/certification/rhce',
      min_quiz_counts: 25,
      max_quiz_counts: 70,
      cert_category_id: 12, // Networking
      pass_score: 85.0,
    },
    {
      name: 'Salesforce Certified Administrator',
      exam_guide_url:
        'https://trailhead.salesforce.com/credentials/administratoroverview/',
      min_quiz_counts: 15,
      max_quiz_counts: 50,
      cert_category_id: 13, // Cloud Computing
      pass_score: 75.0,
    },
    {
      name: 'Salesforce Certified Platform Developer I',
      exam_guide_url:
        'https://trailhead.salesforce.com/credentials/platformdeveloperI/',
      min_quiz_counts: 20,
      max_quiz_counts: 60,
      cert_category_id: 13, // Cloud Computing
      pass_score: 80.0,
    },
    {
      name: 'Certified Blockchain Expert',
      exam_guide_url:
        'https://www.blockchain-council.org/certifications/certified-blockchain-expert/',
      min_quiz_counts: 20,
      max_quiz_counts: 60,
      cert_category_id: 14, // Blockchain
      pass_score: 80.0,
    },
    {
      name: 'Certified Internet of Things (IoT) Practitioner',
      exam_guide_url: 'https://certnexus.com/certification/ciotp/',
      min_quiz_counts: 20,
      max_quiz_counts: 60,
      cert_category_id: 15, // Artificial Intelligence
      pass_score: 80.0,
    },
    {
      name: 'Certified Artificial Intelligence Practitioner (CAIP)',
      exam_guide_url: 'https://certnexus.com/certification/caip/',
      min_quiz_counts: 20,
      max_quiz_counts: 60,
      cert_category_id: 16, // Artificial Intelligence
      pass_score: 80.0,
    },
    {
      name: 'Certified Information Security Manager (CISM)',
      exam_guide_url: 'https://www.isaca.org/credentialing/cism',
      min_quiz_counts: 25,
      max_quiz_counts: 70,
      cert_category_id: 6, // Cybersecurity
      pass_score: 85.0,
    },
    {
      name: 'Certified Information Systems Auditor (CISA)',
      exam_guide_url: 'https://www.isaca.org/credentialing/cisa',
      min_quiz_counts: 25,
      max_quiz_counts: 70,
      cert_category_id: 6, // Cybersecurity
      pass_score: 85.0,
    },
    {
      name: 'Certified Cloud Security Professional (CCSP)',
      exam_guide_url: 'https://www.isc2.org/Certifications/CCSP',
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
    await prismaInstance.certifications.create({
      data: cert,
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
