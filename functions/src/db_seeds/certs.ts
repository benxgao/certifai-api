/* eslint-disable indent */
import prismaInstance from '../services/prisma';

// Consolidated certification seeding and update script
//
// Usage:
// - Seed certifications (default): npx ts-node src/db_seeds/certs.ts
// - Update question counts: npx ts-node src/db_seeds/certs.ts update-question-counts
// - Update URLs: npx ts-node src/db_seeds/certs.ts update-urls
// - Seed certifications explicitly: npx ts-node src/db_seeds/certs.ts seed

// Script to update existing certification question counts with more realistic values
async function updateCertificationQuestionCounts() {
  console.log('Starting certification question count updates...');

  // Updated certification data with correct min/max question counts
  const certificationUpdates = [
    {
      name: 'AWS Certified Solutions Architect',
      min_quiz_counts: 15,
      max_quiz_counts: 65,
    },
    {
      name: 'Google Cloud Professional Cloud Developer',
      min_quiz_counts: 12,
      max_quiz_counts: 60,
    },
    {
      name: 'Google Cloud Professional Data Engineer',
      min_quiz_counts: 15,
      max_quiz_counts: 70,
    },
    {
      name: 'Microsoft Certified: Azure Solutions Architect Expert',
      min_quiz_counts: 20,
      max_quiz_counts: 80,
    },
    {
      name: 'AWS Certified SysOps Administrator',
      min_quiz_counts: 12,
      max_quiz_counts: 50,
    },
    {
      name: 'Google Cloud Associate Cloud Engineer',
      min_quiz_counts: 10,
      max_quiz_counts: 50,
    },
    {
      name: 'Google Cloud Professional Cloud Architect',
      min_quiz_counts: 18,
      max_quiz_counts: 75,
    },
    {
      name: 'Microsoft Certified: Azure Administrator Associate',
      min_quiz_counts: 12,
      max_quiz_counts: 55,
    },
    {
      name: 'Microsoft Certified: Azure Developer Associate',
      min_quiz_counts: 15,
      max_quiz_counts: 60,
    },
    {
      name: 'Certified Kubernetes Administrator (CKA)',
      min_quiz_counts: 25,
      max_quiz_counts: 100,
    },
    {
      name: 'Certified Kubernetes Application Developer (CKAD)',
      min_quiz_counts: 20,
      max_quiz_counts: 80,
    },
    {
      name: 'Certified Information Systems Security Professional (CISSP)',
      min_quiz_counts: 30,
      max_quiz_counts: 150,
    },
    {
      name: 'AWS Certified Machine Learning – Specialty',
      min_quiz_counts: 18,
      max_quiz_counts: 75,
    },
    {
      name: 'Google Cloud Professional Machine Learning Engineer',
      min_quiz_counts: 18,
      max_quiz_counts: 75,
    },
  ];

  let updatedCount = 0;
  let notFoundCount = 0;

  for (const update of certificationUpdates) {
    try {
      // Find the certification by name
      const existingCert = await prismaInstance.certification.findFirst({
        where: {
          name: update.name,
        },
      });

      if (existingCert) {
        // Update the certification with new question counts
        await prismaInstance.certification.update({
          where: {
            cert_id: existingCert.cert_id,
          },
          data: {
            min_quiz_counts: update.min_quiz_counts,
            max_quiz_counts: update.max_quiz_counts,
          },
        });

        console.log(
          `✅ Updated "${update.name}": ${update.min_quiz_counts}-${update.max_quiz_counts} questions`,
        );
        updatedCount++;
      } else {
        console.log(`❌ Certification not found: "${update.name}"`);
        notFoundCount++;
      }
    } catch (error) {
      console.error(`Error updating certification "${update.name}":`, error);
    }
  }

  console.log('\n📊 Update Summary:');
  console.log(`✅ Successfully updated: ${updatedCount} certifications`);
  console.log(`❌ Not found: ${notFoundCount} certifications`);
  console.log(
    `📈 Total processed: ${certificationUpdates.length} certifications`,
  );

  // Optional: Show current state of all certifications
  console.log('\n📋 Current certification question counts:');
  const allCerts = await prismaInstance.certification.findMany({
    select: {
      name: true,
      min_quiz_counts: true,
      max_quiz_counts: true,
    },
    orderBy: {
      name: 'asc',
    },
  });

  allCerts.forEach((cert) => {
    console.log(
      `  ${cert.name}: ${cert.min_quiz_counts}-${cert.max_quiz_counts} questions`,
    );
  });
}

// Script to update existing certification exam guide URLs with official certification website URLs
async function updateCertificationUrls() {
  console.log(
    'Starting certification exam guide URL updates and new certification creation...',
  );

  // Updated and expanded certification data with correct and current exam guide URLs
  const certificationUrlUpdates: Array<{
    name: string;
    exam_guide_url: string;
    min_quiz_counts?: number;
    max_quiz_counts?: number;
    firm_code?: string;
  }> = [
    // Existing AWS Certifications
    {
      name: 'AWS Certified Solutions Architect',
      exam_guide_url:
        'https://aws.amazon.com/certification/certified-solutions-architect-associate/',
    },
    {
      name: 'AWS Certified SysOps Administrator',
      exam_guide_url:
        'https://aws.amazon.com/certification/certified-sysops-admin-associate/',
    },
    {
      name: 'AWS Certified Machine Learning – Specialty',
      exam_guide_url:
        'https://aws.amazon.com/certification/certified-machine-learning-specialty/',
    },
    // Additional AWS Certifications
    {
      name: 'AWS Certified Developer Associate',
      exam_guide_url:
        'https://aws.amazon.com/certification/certified-developer-associate/',
      min_quiz_counts: 12,
      max_quiz_counts: 65,
      firm_code: 'AWS',
    },
    {
      name: 'AWS Certified DevOps Engineer Professional',
      exam_guide_url:
        'https://aws.amazon.com/certification/certified-devops-engineer-professional/',
      min_quiz_counts: 20,
      max_quiz_counts: 75,
      firm_code: 'AWS',
    },
    {
      name: 'AWS Certified Security Specialty',
      exam_guide_url:
        'https://aws.amazon.com/certification/certified-security-specialty/',
      min_quiz_counts: 15,
      max_quiz_counts: 65,
      firm_code: 'AWS',
    },
    {
      name: 'AWS Certified Database Specialty',
      exam_guide_url:
        'https://aws.amazon.com/certification/certified-database-specialty/',
      min_quiz_counts: 15,
      max_quiz_counts: 65,
      firm_code: 'AWS',
    },

    // Existing Google Cloud Certifications
    {
      name: 'Google Cloud Professional Cloud Developer',
      exam_guide_url:
        'https://cloud.google.com/learn/certification/cloud-developer',
    },
    {
      name: 'Google Cloud Professional Data Engineer',
      exam_guide_url:
        'https://cloud.google.com/learn/certification/data-engineer',
    },
    {
      name: 'Google Cloud Associate Cloud Engineer',
      exam_guide_url:
        'https://cloud.google.com/learn/certification/cloud-engineer',
    },
    {
      name: 'Google Cloud Professional Cloud Architect',
      exam_guide_url:
        'https://cloud.google.com/learn/certification/cloud-architect',
    },
    {
      name: 'Google Cloud Professional Machine Learning Engineer',
      exam_guide_url:
        'https://cloud.google.com/learn/certification/machine-learning-engineer',
    },
    // Additional Google Cloud Certifications
    {
      name: 'Google Cloud Professional Cloud Security Engineer',
      exam_guide_url:
        'https://cloud.google.com/learn/certification/cloud-security-engineer',
      min_quiz_counts: 15,
      max_quiz_counts: 70,
      firm_code: 'GCP',
    },
    {
      name: 'Google Cloud Professional Cloud Network Engineer',
      exam_guide_url:
        'https://cloud.google.com/learn/certification/cloud-network-engineer',
      min_quiz_counts: 15,
      max_quiz_counts: 60,
      firm_code: 'GCP',
    },
    {
      name: 'Google Cloud Professional Cloud DevOps Engineer',
      exam_guide_url:
        'https://cloud.google.com/learn/certification/cloud-devops-engineer',
      min_quiz_counts: 18,
      max_quiz_counts: 75,
      firm_code: 'GCP',
    },

    // Existing Microsoft Azure Certifications
    {
      name: 'Microsoft Certified: Azure Solutions Architect Expert',
      exam_guide_url:
        'https://learn.microsoft.com/en-us/credentials/certifications/azure-solutions-architect/',
    },
    {
      name: 'Microsoft Certified: Azure Administrator Associate',
      exam_guide_url:
        'https://learn.microsoft.com/en-us/credentials/certifications/azure-administrator/',
    },
    {
      name: 'Microsoft Certified: Azure Developer Associate',
      exam_guide_url:
        'https://learn.microsoft.com/en-us/credentials/certifications/azure-developer/',
    },
    // Additional Microsoft Azure Certifications
    {
      name: 'Microsoft Certified: Azure Security Engineer Associate',
      exam_guide_url:
        'https://learn.microsoft.com/en-us/credentials/certifications/azure-security-engineer/',
      min_quiz_counts: 15,
      max_quiz_counts: 60,
      firm_code: 'AZURE',
    },
    {
      name: 'Microsoft Certified: Azure DevOps Engineer Expert',
      exam_guide_url:
        'https://learn.microsoft.com/en-us/credentials/certifications/devops-engineer/',
      min_quiz_counts: 20,
      max_quiz_counts: 75,
      firm_code: 'AZURE',
    },
    {
      name: 'Microsoft Certified: Azure Data Engineer Associate',
      exam_guide_url:
        'https://learn.microsoft.com/en-us/credentials/certifications/azure-data-engineer/',
      min_quiz_counts: 15,
      max_quiz_counts: 65,
      firm_code: 'AZURE',
    },
    {
      name: 'Microsoft Certified: Azure AI Engineer Associate',
      exam_guide_url:
        'https://learn.microsoft.com/en-us/credentials/certifications/azure-ai-engineer/',
      min_quiz_counts: 15,
      max_quiz_counts: 60,
      firm_code: 'AZURE',
    },

    // Existing Kubernetes Certifications
    {
      name: 'Certified Kubernetes Administrator (CKA)',
      exam_guide_url: 'https://www.cncf.io/training/certification/cka/',
    },
    {
      name: 'Certified Kubernetes Application Developer (CKAD)',
      exam_guide_url: 'https://www.cncf.io/training/certification/ckad/',
    },
    // Additional Kubernetes Certifications
    {
      name: 'Certified Kubernetes Security Specialist (CKS)',
      exam_guide_url: 'https://www.cncf.io/training/certification/cks/',
      min_quiz_counts: 20,
      max_quiz_counts: 85,
      firm_code: 'K8S',
    },

    // Cisco Certifications
    {
      name: 'Cisco Certified Network Associate (CCNA)',
      exam_guide_url:
        'https://www.cisco.com/c/en/us/training-events/training-certifications/certifications/associate/ccna.html',
      min_quiz_counts: 15,
      max_quiz_counts: 120,
      firm_code: 'CISCO',
    },
    {
      name: 'Cisco Certified Network Professional (CCNP)',
      exam_guide_url:
        'https://www.cisco.com/c/en/us/training-events/training-certifications/certifications/professional/ccnp-enterprise.html',
      min_quiz_counts: 20,
      max_quiz_counts: 150,
      firm_code: 'CISCO',
    },
    {
      name: 'Cisco Certified Internetwork Expert (CCIE)',
      exam_guide_url:
        'https://www.cisco.com/c/en/us/training-events/training-certifications/certifications/expert/ccie-enterprise-infrastructure.html',
      min_quiz_counts: 30,
      max_quiz_counts: 200,
      firm_code: 'CISCO',
    },

    // CompTIA Certifications
    {
      name: 'CompTIA Security+',
      exam_guide_url: 'https://www.comptia.org/certifications/security',
      min_quiz_counts: 15,
      max_quiz_counts: 90,
      firm_code: 'COMPTIA',
    },
    {
      name: 'CompTIA Network+',
      exam_guide_url: 'https://www.comptia.org/certifications/network',
      min_quiz_counts: 15,
      max_quiz_counts: 90,
      firm_code: 'COMPTIA',
    },
    {
      name: 'CompTIA A+',
      exam_guide_url: 'https://www.comptia.org/certifications/a',
      min_quiz_counts: 15,
      max_quiz_counts: 90,
      firm_code: 'COMPTIA',
    },
    {
      name: 'CompTIA Cloud+',
      exam_guide_url: 'https://www.comptia.org/certifications/cloud',
      min_quiz_counts: 15,
      max_quiz_counts: 100,
      firm_code: 'COMPTIA',
    },

    // Docker Certifications
    {
      name: 'Docker Certified Associate (DCA)',
      exam_guide_url:
        'https://training.mirantis.com/certification/dca-certification-exam/',
      min_quiz_counts: 12,
      max_quiz_counts: 55,
      firm_code: 'DOCKER',
    },

    // IBM Certifications
    {
      name: 'IBM Certified Solution Architect - Cloud Platform',
      exam_guide_url:
        'https://www.ibm.com/training/certification/ibm-cloud-solution-architect-c0002101',
      min_quiz_counts: 15,
      max_quiz_counts: 70,
      firm_code: 'IBM',
    },
    {
      name: 'IBM Certified Developer - Cloud Platform',
      exam_guide_url:
        'https://www.ibm.com/training/certification/ibm-cloud-application-developer-c0002105',
      min_quiz_counts: 12,
      max_quiz_counts: 60,
      firm_code: 'IBM',
    },
    {
      name: 'IBM Certified Data Engineer - Cloud Platform',
      exam_guide_url:
        'https://www.ibm.com/training/certification/ibm-cloud-data-engineer-c0002102',
      min_quiz_counts: 15,
      max_quiz_counts: 65,
      firm_code: 'IBM',
    },

    // Oracle Certifications
    {
      name: 'Oracle Cloud Infrastructure Architect Associate',
      exam_guide_url:
        'https://education.oracle.com/oracle-cloud-infrastructure-2024-architect-associate/pexam_1Z0-1072-24',
      min_quiz_counts: 15,
      max_quiz_counts: 60,
      firm_code: 'ORACLE',
    },
    {
      name: 'Oracle Cloud Infrastructure Developer Associate',
      exam_guide_url:
        'https://education.oracle.com/oracle-cloud-infrastructure-2023-developer-associate/pexam_1Z0-1084-23',
      min_quiz_counts: 12,
      max_quiz_counts: 60,
      firm_code: 'ORACLE',
    },
    {
      name: 'Oracle Database Administrator Certified Professional',
      exam_guide_url:
        'https://education.oracle.com/oracle-database-19c-administration/pexam_1Z0-082',
      min_quiz_counts: 18,
      max_quiz_counts: 85,
      firm_code: 'ORACLE',
    },

    // Salesforce Certifications
    {
      name: 'Salesforce Certified Administrator',
      exam_guide_url:
        'https://trailhead.salesforce.com/credentials/administrator',
      min_quiz_counts: 12,
      max_quiz_counts: 65,
      firm_code: 'SFDC',
    },
    {
      name: 'Salesforce Certified Platform Developer I',
      exam_guide_url:
        'https://trailhead.salesforce.com/credentials/platformdeveloper',
      min_quiz_counts: 15,
      max_quiz_counts: 60,
      firm_code: 'SFDC',
    },
    {
      name: 'Salesforce Certified Sales Cloud Consultant',
      exam_guide_url:
        'https://trailhead.salesforce.com/credentials/salescloudconsultant',
      min_quiz_counts: 15,
      max_quiz_counts: 60,
      firm_code: 'SFDC',
    },
    {
      name: 'Salesforce Certified Data Architect',
      exam_guide_url:
        'https://trailhead.salesforce.com/credentials/dataarchitect',
      min_quiz_counts: 20,
      max_quiz_counts: 75,
      firm_code: 'SFDC',
    },

    // VMware Certifications
    {
      name: 'VMware Certified Professional - Data Center Virtualization (VCP-DCV)',
      exam_guide_url:
        'https://www.vmware.com/education-services/certification/vcp-dcv.html',
      min_quiz_counts: 15,
      max_quiz_counts: 70,
      firm_code: 'VMWARE',
    },
    {
      name: 'VMware Certified Professional - Cloud Management and Automation (VCP-CMA)',
      exam_guide_url:
        'https://www.vmware.com/education-services/certification/vcp-cma.html',
      min_quiz_counts: 15,
      max_quiz_counts: 70,
      firm_code: 'VMWARE',
    },
    {
      name: 'VMware Certified Advanced Professional - Data Center Virtualization (VCAP-DCV)',
      exam_guide_url:
        'https://www.vmware.com/education-services/certification/vcap-dcv-deploy.html',
      min_quiz_counts: 25,
      max_quiz_counts: 100,
      firm_code: 'VMWARE',
    },

    // Red Hat Certifications
    {
      name: 'Red Hat Certified System Administrator (RHCSA)',
      exam_guide_url: 'https://www.redhat.com/en/services/certification/rhcsa',
      min_quiz_counts: 15,
      max_quiz_counts: 80,
      firm_code: 'REDHAT',
    },
    {
      name: 'Red Hat Certified Engineer (RHCE)',
      exam_guide_url: 'https://www.redhat.com/en/services/certification/rhce',
      min_quiz_counts: 20,
      max_quiz_counts: 100,
      firm_code: 'REDHAT',
    },
    {
      name: 'Red Hat Certified OpenShift Administrator',
      exam_guide_url:
        'https://www.redhat.com/en/services/certification/red-hat-certified-specialist-in-openshift-administration',
      min_quiz_counts: 18,
      max_quiz_counts: 85,
      firm_code: 'REDHAT',
    },

    // PMI Certifications
    {
      name: 'Project Management Professional (PMP)',
      exam_guide_url:
        'https://www.pmi.org/certifications/project-management-pmp',
      min_quiz_counts: 25,
      max_quiz_counts: 180,
      firm_code: 'PMI',
    },
    {
      name: 'Certified Associate in Project Management (CAPM)',
      exam_guide_url:
        'https://www.pmi.org/certifications/certified-associate-capm',
      min_quiz_counts: 20,
      max_quiz_counts: 150,
      firm_code: 'PMI',
    },
    {
      name: 'PMI Agile Certified Practitioner (PMI-ACP)',
      exam_guide_url: 'https://www.pmi.org/certifications/agile-acp',
      min_quiz_counts: 20,
      max_quiz_counts: 120,
      firm_code: 'PMI',
    },

    // ITIL Certifications
    {
      name: 'ITIL 4 Foundation',
      exam_guide_url:
        'https://www.axelos.com/certifications/itil-service-management/itil-4-foundation',
      min_quiz_counts: 10,
      max_quiz_counts: 40,
      firm_code: 'ITIL',
    },
    {
      name: 'ITIL 4 Managing Professional',
      exam_guide_url:
        'https://www.axelos.com/certifications/itil-service-management/itil-4-managing-professional',
      min_quiz_counts: 15,
      max_quiz_counts: 60,
      firm_code: 'ITIL',
    },

    // TOGAF Certifications
    {
      name: 'TOGAF 9 Foundation',
      exam_guide_url: 'https://www.opengroup.org/certifications/togaf',
      min_quiz_counts: 15,
      max_quiz_counts: 40,
      firm_code: 'TOGAF',
    },
    {
      name: 'TOGAF 9 Certified',
      exam_guide_url: 'https://www.opengroup.org/certifications/togaf',
      min_quiz_counts: 20,
      max_quiz_counts: 60,
      firm_code: 'TOGAF',
    },

    // Existing Security Certification
    {
      name: 'Certified Information Systems Security Professional (CISSP)',
      exam_guide_url: 'https://www.isc2.org/certifications/cissp',
    },
  ];

  let updatedCount = 0;
  let notFoundCount = 0;
  let unchangedCount = 0;
  let createdCount = 0;

  for (const update of certificationUrlUpdates) {
    try {
      // Find the certification by name
      const existingCert = await prismaInstance.certification.findFirst({
        where: {
          name: update.name,
        },
        select: {
          cert_id: true,
          name: true,
          exam_guide_url: true,
        },
      });

      if (existingCert) {
        // Check if URL needs updating
        if (existingCert.exam_guide_url !== update.exam_guide_url) {
          // Update the certification with new exam guide URL
          await prismaInstance.certification.update({
            where: {
              cert_id: existingCert.cert_id,
            },
            data: {
              exam_guide_url: update.exam_guide_url,
            },
          });

          console.log(`✅ Updated "${update.name}"`);
          console.log(`   Old: ${existingCert.exam_guide_url || 'null'}`);
          console.log(`   New: ${update.exam_guide_url}`);
          console.log('');
          updatedCount++;
        } else {
          console.log(`➡️  No change needed for "${update.name}"`);
          unchangedCount++;
        }
      } else if (
        'firm_code' in update &&
        'min_quiz_counts' in update &&
        'max_quiz_counts' in update
      ) {
        // This is a new certification to be created
        // Find the firm
        const firm = await prismaInstance.firm.findUnique({
          where: { code: update.firm_code },
        });

        if (!firm) {
          console.error(
            `❌ Firm with code ${update.firm_code} not found for certification: ${update.name}`,
          );
          notFoundCount++;
          continue;
        }

        // Create the new certification
        await prismaInstance.certification.create({
          data: {
            name: update.name,
            exam_guide_url: update.exam_guide_url,
            min_quiz_counts: update.min_quiz_counts!,
            max_quiz_counts: update.max_quiz_counts!,
            pass_score: 75.0,
            firm_id: firm.firm_id,
          },
        });

        console.log(`🆕 Created "${update.name}" for firm ${update.firm_code}`);
        console.log(`   URL: ${update.exam_guide_url}`);
        console.log(
          `   Questions: ${update.min_quiz_counts}-${update.max_quiz_counts}`,
        );
        console.log('');
        createdCount++;
      } else {
        console.log(`❌ Certification not found: "${update.name}"`);
        notFoundCount++;
      }
    } catch (error) {
      console.error(`Error processing certification "${update.name}":`, error);
    }
  }

  console.log('\n📊 Update Summary:');
  console.log(`✅ Successfully updated: ${updatedCount} certifications`);
  console.log(`🆕 Successfully created: ${createdCount} certifications`);
  console.log(`➡️  No changes needed: ${unchangedCount} certifications`);
  console.log(`❌ Not found/errors: ${notFoundCount} certifications`);
  console.log(
    `📈 Total processed: ${certificationUrlUpdates.length} certifications`,
  );

  // Show current state of all certification URLs
  console.log('\n📋 Current certification exam guide URLs:');
  const allCerts = await prismaInstance.certification.findMany({
    select: {
      name: true,
      exam_guide_url: true,
    },
    orderBy: {
      name: 'asc',
    },
  });

  allCerts.forEach((cert) => {
    console.log(`  ${cert.name}:`);
    console.log(`    ${cert.exam_guide_url || 'No URL set'}`);
    console.log('');
  });
}

async function seedCertifications() {
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
      // cert_category_id: 1, // Cloud Computing
      pass_score: 75.0,
    },
    {
      name: 'Google Cloud Professional Cloud Developer',
      exam_guide_url:
        'https://cloud.google.com/learn/certification/guides/cloud-developer',
      min_quiz_counts: 10,
      max_quiz_counts: 60,
      // cert_category_id: 2, // Data Engineering
      pass_score: 75.0,
    },
    {
      name: 'Google Cloud Professional Data Engineer',
      exam_guide_url: 'https://cloud.google.com/certification/data-engineer',
      min_quiz_counts: 10,
      max_quiz_counts: 60,
      // cert_category_id: 2, // Data Engineering
      pass_score: 75.0,
    },
    {
      name: 'Microsoft Certified: Azure Solutions Architect Expert',
      exam_guide_url:
        'https://learn.microsoft.com/en-us/certifications/azure-solutions-architect/',
      min_quiz_counts: 10,
      max_quiz_counts: 70,
      // cert_category_id: 3, // Cybersecurity
      pass_score: 75.0,
    },
    {
      name: 'AWS Certified SysOps Administrator',
      exam_guide_url:
        'https://aws.amazon.com/certification/certified-sysops-administrator-associate/',
      min_quiz_counts: 10,
      max_quiz_counts: 40,
      // cert_category_id: 1, // Cloud Computing
      pass_score: 75.0,
    },
    {
      name: 'Google Cloud Associate Cloud Engineer',
      exam_guide_url: 'https://cloud.google.com/certification/cloud-engineer',
      min_quiz_counts: 10,
      max_quiz_counts: 50,
      // cert_category_id: 2, // Data Engineering
      pass_score: 75.0,
    },
    {
      name: 'Google Cloud Professional Cloud Architect',
      exam_guide_url: 'https://cloud.google.com/certification/cloud-architect',
      min_quiz_counts: 10,
      max_quiz_counts: 60,
      // cert_category_id: 2, // Data Engineering
      pass_score: 75.0,
    },
    {
      name: 'Microsoft Certified: Azure Administrator Associate',
      exam_guide_url:
        'https://learn.microsoft.com/en-us/certifications/azure-administrator/',
      min_quiz_counts: 10,
      max_quiz_counts: 50,
      // cert_category_id: 3, // Cybersecurity
      pass_score: 75.0,
    },
    {
      name: 'Microsoft Certified: Azure Developer Associate',
      exam_guide_url:
        'https://learn.microsoft.com/en-us/certifications/azure-developer/',
      min_quiz_counts: 10,
      max_quiz_counts: 50,
      // cert_category_id: 3, // Cybersecurity
      pass_score: 75.0,
    },
    {
      name: 'Certified Kubernetes Administrator (CKA)',
      exam_guide_url:
        'https://training.linuxfoundation.org/certification/certified-kubernetes-administrator-cka/',
      min_quiz_counts: 10,
      max_quiz_counts: 60,
      // cert_category_id: 5, // DevOps
      pass_score: 75.0,
    },
    {
      name: 'Certified Kubernetes Application Developer (CKAD)',
      exam_guide_url:
        'https://training.linuxfoundation.org/certification/certified-kubernetes-application-developer-ckad/',
      min_quiz_counts: 10,
      max_quiz_counts: 60,
      // cert_category_id: 5, // DevOps
      pass_score: 75.0,
    },
    {
      name: 'Certified Information Systems Security Professional (CISSP)',
      exam_guide_url: 'https://www.isc2.org/Certifications/CISSP',
      min_quiz_counts: 10,
      max_quiz_counts: 70,
      // cert_category_id: 6, // Cybersecurity
      pass_score: 75.0,
    },
    {
      name: 'AWS Certified Machine Learning – Specialty',
      exam_guide_url:
        'https://aws.amazon.com/certification/certified-machine-learning-specialty/',
      min_quiz_counts: 10,
      max_quiz_counts: 60,
      // cert_category_id: 1, // Cloud Computing
      pass_score: 75.0,
    },
    {
      name: 'Google Cloud Professional Machine Learning Engineer',
      exam_guide_url:
        'https://cloud.google.com/certification/machine-learning-engineer',
      min_quiz_counts: 10,
      max_quiz_counts: 60,
      // cert_category_id: 2, // Data Engineering
      pass_score: 75.0,
    },
  ];

  for (const cert of certifications) {
    // Get firm_id based on certification name
    let firmCode = 'GENERIC'; // Default fallback

    if (
      cert.name.toLowerCase().includes('aws') ||
      cert.name.toLowerCase().includes('amazon')
    ) {
      firmCode = 'AWS';
    } else if (
      cert.name.toLowerCase().includes('google') ||
      cert.name.toLowerCase().includes('gcp')
    ) {
      firmCode = 'GCP';
    } else if (
      cert.name.toLowerCase().includes('azure') ||
      cert.name.toLowerCase().includes('microsoft')
    ) {
      firmCode = 'AZURE';
    } else if (cert.name.toLowerCase().includes('ibm')) {
      firmCode = 'IBM';
    } else if (cert.name.toLowerCase().includes('oracle')) {
      firmCode = 'ORACLE';
    } else if (cert.name.toLowerCase().includes('salesforce')) {
      firmCode = 'SFDC';
    } else if (cert.name.toLowerCase().includes('vmware')) {
      firmCode = 'VMWARE';
    } else if (cert.name.toLowerCase().includes('cisco')) {
      firmCode = 'CISCO';
    } else if (cert.name.toLowerCase().includes('red hat')) {
      firmCode = 'REDHAT';
    } else if (cert.name.toLowerCase().includes('docker')) {
      firmCode = 'DOCKER';
    } else if (
      cert.name.toLowerCase().includes('kubernetes') ||
      cert.name.toLowerCase().includes('k8s')
    ) {
      firmCode = 'K8S';
    } else if (cert.name.toLowerCase().includes('comptia')) {
      firmCode = 'COMPTIA';
    } else if (
      cert.name.toLowerCase().includes('pmp') ||
      cert.name.toLowerCase().includes('project management')
    ) {
      firmCode = 'PMI';
    } else if (cert.name.toLowerCase().includes('itil')) {
      firmCode = 'ITIL';
    } else if (cert.name.toLowerCase().includes('togaf')) {
      firmCode = 'TOGAF';
    }

    // Find the firm
    const firm = await prismaInstance.firm.findUnique({
      where: { code: firmCode },
    });

    if (!firm) {
      console.error(
        `Firm with code ${firmCode} not found for certification: ${cert.name}`,
      );
      continue;
    }

    await prismaInstance.certification.create({
      data: {
        name: cert.name,
        exam_guide_url: cert.exam_guide_url,
        min_quiz_counts: cert.min_quiz_counts,
        max_quiz_counts: cert.max_quiz_counts,
        pass_score: 75.0,
        firm_id: firm.firm_id,
        // cert_category_id: cert.cert_category_id,
      },
    });
  }

  console.log('Certifications linked with CertCategories seeded successfully.');
}

async function main() {
  const args = process.argv.slice(2);
  const operation = args[0];

  switch (operation) {
    case 'update-question-counts':
      await updateCertificationQuestionCounts();
      break;
    case 'update-urls':
      await updateCertificationUrls();
      break;
    case 'seed':
    default:
      await seedCertifications();
      break;
  }
}

main()
  .catch((e: any) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prismaInstance.$disconnect();
  });
