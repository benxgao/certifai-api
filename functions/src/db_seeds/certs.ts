import prismaInstance from '../services/prisma';

// Consolidated certification seeding and update script
//
// Usage:
// - Seed all (firms + certifications): npx ts-node src/db_seeds/certs.ts
// - Seed firms only: npx ts-node src/db_seeds/certs.ts seed-firms
// - Seed certifications only: npx ts-node src/db_seeds/certs.ts seed-certs
// - Update question counts: npx ts-node src/db_seeds/certs.ts update-question-counts
// - Update URLs: npx ts-node src/db_seeds/certs.ts update-urls
// - Update slugs: npx ts-node src/db_seeds/certs.ts update-slugs
//
// Recent Updates (August 2025):
// - Enhanced Ansible certification coverage with 5 comprehensive Red Hat certifications
// - Added Red Hat Certified Engineer in Ansible Automation (EX447)
// - Added Red Hat Certified Architect in Infrastructure
// - Added Advanced Automation Best Practices and Event-Driven Automation specializations
// - Removed broken VMware VCP-CMA certification (404 error)
// - Updated VMware URLs to use Broadcom domain (post-acquisition)
// - Removed outdated IBM certifications returning 404 errors
// - Added current IBM Cloud certifications (Advocate, Technical Advocate, Advanced Architect, SRE, Developer)
// - Added IBM watsonx Generative AI Engineer Associate certification
// - Added 25+ new high-demand certifications including HashiCorp, Linux, DevOps, and Security
// - Added latest AI/ML certifications from AWS, GCP, Azure, and other providers
// - Added HashiCorp, LPI, and Databricks as new certification providers
// - Verified all existing URLs are still valid

// Function to seed firms
async function seedFirms() {
  console.log('Starting firm seeding...');

  const firms = [
    {
      code: 'AWS',
      name: 'Amazon Web Services',
      description:
        'Amazon Web Services (AWS) is a comprehensive cloud computing platform provided by Amazon.',
      website_url: 'https://aws.amazon.com',
      logo_url: 'https://aws.amazon.com/favicon.ico',
    },
    {
      code: 'GCP',
      name: 'Google Cloud Platform',
      description:
        'Google Cloud Platform is a suite of cloud computing services provided by Google.',
      website_url: 'https://cloud.google.com',
      logo_url: 'https://cloud.google.com/favicon.ico',
    },
    {
      code: 'AZURE',
      name: 'Microsoft Azure',
      description:
        'Microsoft Azure is a cloud computing platform and infrastructure created by Microsoft.',
      website_url: 'https://azure.microsoft.com',
      logo_url: 'https://azure.microsoft.com/favicon.ico',
    },
    {
      code: 'K8S',
      name: 'Kubernetes',
      description:
        'Kubernetes is an open-source container orchestration platform.',
      website_url: 'https://kubernetes.io',
      logo_url: 'https://kubernetes.io/favicon.ico',
    },
    {
      code: 'CISCO',
      name: 'Cisco Systems',
      description:
        'Cisco Systems is a multinational technology conglomerate specializing in networking hardware.',
      website_url: 'https://www.cisco.com',
      logo_url: 'https://www.cisco.com/favicon.ico',
    },
    {
      code: 'COMPTIA',
      name: 'CompTIA',
      description:
        'CompTIA is a non-profit trade association that issues professional certifications for the IT industry.',
      website_url: 'https://www.comptia.org',
      logo_url: 'https://www.comptia.org/favicon.ico',
    },
    {
      code: 'DOCKER',
      name: 'Docker',
      description:
        'Docker is a platform designed to help developers build, share, and run modern applications.',
      website_url: 'https://www.docker.com',
      logo_url: 'https://www.docker.com/favicon.ico',
    },
    {
      code: 'IBM',
      name: 'IBM',
      description:
        'International Business Machines Corporation is a multinational technology corporation.',
      website_url: 'https://www.ibm.com',
      logo_url: 'https://www.ibm.com/favicon.ico',
    },
    {
      code: 'ORACLE',
      name: 'Oracle',
      description:
        'Oracle Corporation is a multinational computer technology corporation specializing in database software.',
      website_url: 'https://www.oracle.com',
      logo_url: 'https://www.oracle.com/favicon.ico',
    },
    {
      code: 'SFDC',
      name: 'Salesforce',
      description:
        'Salesforce is a cloud-based software company specializing in customer relationship management.',
      website_url: 'https://www.salesforce.com',
      logo_url: 'https://www.salesforce.com/favicon.ico',
    },
    {
      code: 'VMWARE',
      name: 'VMware',
      description:
        'VMware is a cloud computing and virtualization technology company.',
      website_url: 'https://www.vmware.com',
      logo_url: 'https://www.vmware.com/favicon.ico',
    },
    {
      code: 'REDHAT',
      name: 'Red Hat',
      description:
        'Red Hat is an American multinational software company that provides open source software products.',
      website_url: 'https://www.redhat.com',
      logo_url: 'https://www.redhat.com/favicon.ico',
    },
    {
      code: 'PMI',
      name: 'Project Management Institute',
      description:
        'PMI is a global professional organization for project management.',
      website_url: 'https://www.pmi.org',
      logo_url: 'https://www.pmi.org/favicon.ico',
    },
    {
      code: 'ITIL',
      name: 'ITIL',
      description:
        'ITIL is a set of detailed practices for IT service management.',
      website_url: 'https://www.axelos.com',
      logo_url: 'https://www.axelos.com/favicon.ico',
    },
    {
      code: 'TOGAF',
      name: 'The Open Group Architecture Framework',
      description:
        'TOGAF is an enterprise architecture methodology and framework.',
      website_url: 'https://www.opengroup.org',
      logo_url: 'https://www.opengroup.org/favicon.ico',
    },
    {
      code: 'ISC2',
      name: '(ISC)²',
      description:
        'International Information System Security Certification Consortium.',
      website_url: 'https://www.isc2.org',
      logo_url: 'https://www.isc2.org/favicon.ico',
    },
    {
      code: 'GENERIC',
      name: 'Generic',
      description:
        'Generic firm for certifications without specific providers.',
      website_url: '',
      logo_url: '',
    },
    {
      code: 'HASHICORP',
      name: 'HashiCorp',
      description:
        'HashiCorp provides infrastructure automation software and services.',
      website_url: 'https://www.hashicorp.com',
      logo_url: 'https://www.hashicorp.com/favicon.ico',
    },
    {
      code: 'LPI',
      name: 'Linux Professional Institute',
      description:
        'Linux Professional Institute is a non-profit organization that provides Linux certification programs.',
      website_url: 'https://www.lpi.org',
      logo_url: 'https://www.lpi.org/favicon.ico',
    },
    {
      code: 'DATABRICKS',
      name: 'Databricks',
      description:
        'Databricks is a unified analytics platform for big data and machine learning.',
      website_url: 'https://www.databricks.com',
      logo_url: 'https://www.databricks.com/favicon.ico',
    },
    {
      code: 'SCRUMALLIANCE',
      name: 'Scrum Alliance',
      description:
        'Scrum Alliance is a nonprofit organization that promotes Scrum and provides Scrum training and certification.',
      website_url: 'https://www.scrumalliance.org',
      logo_url: 'https://www.scrumalliance.org/favicon.ico',
    },
    {
      code: 'SCRUMORG',
      name: 'Scrum.org',
      description:
        'Scrum.org is the home of Scrum, providing training, assessments and certifications.',
      website_url: 'https://www.scrum.org',
      logo_url: 'https://www.scrum.org/favicon.ico',
    },
    {
      code: 'SAI',
      name: 'Scaled Agile',
      description:
        'Scaled Agile provides SAFe (Scaled Agile Framework) training and certification.',
      website_url: 'https://www.scaledagile.com',
      logo_url: 'https://www.scaledagile.com/favicon.ico',
    },
  ];

  let createdCount = 0;
  let existingCount = 0;

  for (const firmData of firms) {
    try {
      // Check if firm already exists
      const existingFirm = await prismaInstance.firm.findUnique({
        where: { code: firmData.code },
      });

      if (existingFirm) {
        console.log(
          `➡️  Firm "${firmData.name}" (${firmData.code}) already exists`,
        );
        existingCount++;
      } else {
        // Create the firm
        await prismaInstance.firm.create({
          data: firmData,
        });
        console.log(`✅ Created firm "${firmData.name}" (${firmData.code})`);
        createdCount++;
      }
    } catch (error) {
      console.error(`Error creating firm "${firmData.name}":`, error);
    }
  }

  console.log('\n📊 Firm Seeding Summary:');
  console.log(`✅ Successfully created: ${createdCount} firms`);
  console.log(`➡️  Already existed: ${existingCount} firms`);
  console.log(`📈 Total processed: ${firms.length} firms`);
}

// Comprehensive certification data with current exam guide URLs - moved to module level for reuse
const certificationUrlUpdates: Array<{
  name: string;
  slug?: string;
  exam_guide_url: string;
  min_quiz_counts?: number;
  max_quiz_counts?: number;
  firm_code?: string;
}> = [
  // Existing AWS Certifications
  {
    name: 'AWS Certified Solutions Architect',
    slug: 'aws-solutions-architect', // Custom slug example
    exam_guide_url:
      'https://aws.amazon.com/certification/certified-solutions-architect-associate/',
  },
  {
    name: 'AWS Certified SysOps Administrator',
    // No slug provided - will be auto-generated as 'aws-certified-sysops-administrator'
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

  // IBM Certifications (Updated to current valid certifications)
  {
    name: 'IBM Certified Advocate - Cloud v2',
    exam_guide_url:
      'https://www.ibm.com/training/certification/ibm-certified-advocate-cloud-v2-C9003700',
    min_quiz_counts: 10,
    max_quiz_counts: 50,
    firm_code: 'IBM',
  },
  {
    name: 'IBM Certified Technical Advocate - Cloud v5',
    exam_guide_url:
      'https://www.ibm.com/training/certification/ibm-certified-technical-advocate-cloud-v5-C9005600',
    min_quiz_counts: 12,
    max_quiz_counts: 60,
    firm_code: 'IBM',
  },
  {
    name: 'IBM Certified Advanced Architect - Cloud v2',
    exam_guide_url:
      'https://www.ibm.com/training/certification/ibm-certified-advanced-architect-cloud-v2-C9006300',
    min_quiz_counts: 18,
    max_quiz_counts: 75,
    firm_code: 'IBM',
  },
  {
    name: 'IBM Certified Associate SRE - Cloud v2',
    exam_guide_url:
      'https://www.ibm.com/training/certification/ibm-certified-associate-sre-cloud-v2-C9005500',
    min_quiz_counts: 12,
    max_quiz_counts: 65,
    firm_code: 'IBM',
  },
  {
    name: 'IBM Certified Developer - Cloud Native Java with IBM Liberty 2023',
    exam_guide_url:
      'https://www.ibm.com/training/certification/ibm-certified-developer-cloud-native-java-ibm-liberty-2023-C9004800',
    min_quiz_counts: 15,
    max_quiz_counts: 70,
    firm_code: 'IBM',
  },

  // Latest IBM AI Certification (2024-2025)
  {
    name: 'IBM Certified watsonx Generative AI Engineer - Associate',
    exam_guide_url:
      'https://www.ibm.com/training/certification/ibm-certified-watsonx-generative-ai-engineer-associate-C9007000',
    min_quiz_counts: 12,
    max_quiz_counts: 60,
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

  // VMware Certifications (Updated URLs - VMware acquired by Broadcom)
  {
    name: 'VMware Certified Professional - Data Center Virtualization (VCP-DCV)',
    exam_guide_url:
      'https://www.broadcom.com/support/education/vmware/certification/vcp-dcv',
    min_quiz_counts: 15,
    max_quiz_counts: 70,
    firm_code: 'VMWARE',
  },
  // Note: VCP-CMA certification removed as the URL returns 404 - certification may be discontinued

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
    exam_guide_url: 'https://www.pmi.org/certifications/project-management-pmp',
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
  {
    name: 'PMI Disciplined Agile Scrum Master (DASM)',
    exam_guide_url:
      'https://www.pmi.org/certifications/disciplined-agile-scrum-master-dasm',
    min_quiz_counts: 15,
    max_quiz_counts: 50,
    firm_code: 'PMI',
  },
  {
    name: 'PMI Disciplined Agile Senior Scrum Master (DASSM)',
    exam_guide_url:
      'https://www.pmi.org/certifications/disciplined-agile-senior-scrum-master-dassm',
    min_quiz_counts: 18,
    max_quiz_counts: 60,
    firm_code: 'PMI',
  },
  {
    name: 'PMI Construction Professional (PMI-CP)',
    exam_guide_url: 'https://www.pmi.org/certifications/construction-pmi-cp',
    min_quiz_counts: 20,
    max_quiz_counts: 170,
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

  // Additional High-Demand Certifications

  // Terraform Certifications
  {
    name: 'HashiCorp Certified: Terraform Associate',
    exam_guide_url:
      'https://www.hashicorp.com/certification/terraform-associate',
    min_quiz_counts: 15,
    max_quiz_counts: 57,
    firm_code: 'HASHICORP',
  },

  // Ansible Certifications (Enhanced)
  {
    name: 'Red Hat Certified Specialist in Developing Automation with Ansible Automation Platform',
    exam_guide_url:
      'https://www.redhat.com/en/services/training/red-hat-certified-specialist-developing-automation-ansible-automation-platform-exam?section=objectives',
    min_quiz_counts: 20,
    max_quiz_counts: 90,
    firm_code: 'REDHAT',
  },
  {
    name: 'Red Hat Certified Architect in Infrastructure',
    exam_guide_url:
      'https://www.redhat.com/en/services/certification/rhca?pfe-u086w679o=exams',
    min_quiz_counts: 25,
    max_quiz_counts: 100,
    firm_code: 'REDHAT',
  },
  {
    name: 'Red Hat Certified Specialist in Advanced Automation: Ansible Best Practices',
    exam_guide_url:
      'https://www.redhat.com/en/services/training/ex447-red-hat-certified-specialist-advanced-automation-ansible-best-practices-exam?section=objectives',
    min_quiz_counts: 18,
    max_quiz_counts: 85,
    firm_code: 'REDHAT',
  },
  {
    name: 'Red Hat Certified Specialist in Event-Driven Automation',
    exam_guide_url:
      'https://www.redhat.com/en/services/training/red-hat-certified-specialist-event-driven-application-development-exam?section=objectives',
    min_quiz_counts: 15,
    max_quiz_counts: 75,
    firm_code: 'REDHAT',
  },

  // Jenkins Certifications
  {
    name: 'Certified Jenkins Engineer (CJE)',
    exam_guide_url: 'https://www.cloudbees.com/jenkins/certification',
    min_quiz_counts: 12,
    max_quiz_counts: 60,
    firm_code: 'GENERIC',
  },

  // Linux Certifications
  {
    name: 'Linux Professional Institute Certification Level 1 (LPIC-1)',
    exam_guide_url: 'https://www.lpi.org/our-certifications/lpic-1-overview',
    min_quiz_counts: 15,
    max_quiz_counts: 120,
    firm_code: 'LPI',
  },

  {
    name: 'Linux Professional Institute Certification Level 2 (LPIC-2)',
    exam_guide_url: 'https://www.lpi.org/our-certifications/lpic-2-overview',
    min_quiz_counts: 18,
    max_quiz_counts: 120,
    firm_code: 'LPI',
  },

  // Scrum/Agile Certifications
  {
    name: 'Certified Scrum Master (CSM)',
    exam_guide_url:
      'https://www.scrumalliance.org/get-certified/scrum-master-track/certified-scrummaster',
    min_quiz_counts: 10,
    max_quiz_counts: 50,
    firm_code: 'SCRUMALLIANCE',
  },

  {
    name: 'Professional Scrum Master I (PSM I)',
    exam_guide_url:
      'https://www.scrum.org/professional-scrum-master-i-certification',
    min_quiz_counts: 15,
    max_quiz_counts: 80,
    firm_code: 'SCRUMORG',
  },

  {
    name: 'Professional Scrum Master II (PSM II)',
    exam_guide_url:
      'https://www.scrum.org/professional-scrum-master-ii-certification',
    min_quiz_counts: 20,
    max_quiz_counts: 90,
    firm_code: 'SCRUMORG',
  },

  {
    name: 'Professional Scrum Product Owner I (PSPO I)',
    exam_guide_url:
      'https://www.scrum.org/professional-scrum-product-owner-i-certification',
    min_quiz_counts: 15,
    max_quiz_counts: 80,
    firm_code: 'SCRUMORG',
  },

  {
    name: 'Professional Scrum Product Owner II (PSPO II)',
    exam_guide_url:
      'https://www.scrum.org/professional-scrum-product-owner-ii-certification',
    min_quiz_counts: 18,
    max_quiz_counts: 90,
    firm_code: 'SCRUMORG',
  },

  // Additional AWS Certifications
  {
    name: 'AWS Certified Advanced Networking - Specialty',
    exam_guide_url:
      'https://aws.amazon.com/certification/certified-advanced-networking-specialty/',
    min_quiz_counts: 15,
    max_quiz_counts: 65,
    firm_code: 'AWS',
  },

  {
    name: 'AWS Certified Data Analytics - Specialty',
    exam_guide_url:
      'https://aws.amazon.com/certification/certified-data-analytics-specialty/',
    min_quiz_counts: 15,
    max_quiz_counts: 65,
    firm_code: 'AWS',
  },

  // Latest AWS AI/ML Certifications (2024-2025)
  {
    name: 'AWS Certified AI Practitioner',
    exam_guide_url:
      'https://aws.amazon.com/certification/certified-ai-practitioner/',
    min_quiz_counts: 15,
    max_quiz_counts: 65,
    firm_code: 'AWS',
  },

  {
    name: 'AWS Certified Machine Learning Engineer - Associate',
    exam_guide_url:
      'https://aws.amazon.com/certification/certified-machine-learning-engineer-associate/',
    min_quiz_counts: 15,
    max_quiz_counts: 85,
    firm_code: 'AWS',
  },

  {
    name: 'AWS Certified Data Engineer - Associate',
    exam_guide_url:
      'https://aws.amazon.com/certification/certified-data-engineer-associate/',
    min_quiz_counts: 15,
    max_quiz_counts: 75,
    firm_code: 'AWS',
  },

  // Azure Data Certifications
  {
    name: 'Microsoft Certified: Azure Data Scientist Associate',
    exam_guide_url:
      'https://learn.microsoft.com/en-us/credentials/certifications/azure-data-scientist/',
    min_quiz_counts: 15,
    max_quiz_counts: 60,
    firm_code: 'AZURE',
  },

  {
    name: 'Microsoft Certified: Azure Database Administrator Associate',
    exam_guide_url:
      'https://learn.microsoft.com/en-us/credentials/certifications/azure-database-administrator-associate/',
    min_quiz_counts: 15,
    max_quiz_counts: 65,
    firm_code: 'AZURE',
  },

  // Google Cloud Security Certifications
  {
    name: 'Google Cloud Professional Cloud Security Engineer',
    exam_guide_url:
      'https://cloud.google.com/learn/certification/cloud-security-engineer',
    min_quiz_counts: 15,
    max_quiz_counts: 70,
    firm_code: 'GCP',
  },

  // Latest Google Cloud AI/ML Certifications (2024-2025)
  {
    name: 'Google Cloud Professional Machine Learning Engineer',
    exam_guide_url:
      'https://cloud.google.com/learn/certification/machine-learning-engineer',
    min_quiz_counts: 18,
    max_quiz_counts: 75,
    firm_code: 'GCP',
  },

  {
    name: 'Google Cloud Professional Data Engineer',
    exam_guide_url:
      'https://cloud.google.com/learn/certification/data-engineer',
    min_quiz_counts: 15,
    max_quiz_counts: 70,
    firm_code: 'GCP',
  },

  {
    name: 'Google Cloud Digital Leader',
    exam_guide_url:
      'https://cloud.google.com/learn/certification/cloud-digital-leader',
    min_quiz_counts: 10,
    max_quiz_counts: 50,
    firm_code: 'GCP',
  },

  {
    name: 'Google Cloud Professional Cloud Database Engineer',
    exam_guide_url:
      'https://cloud.google.com/learn/certification/cloud-database-engineer',
    min_quiz_counts: 15,
    max_quiz_counts: 60,
    firm_code: 'GCP',
  },

  // Python Certifications
  {
    name: 'Python Institute Certified Associate in Python Programming (PCAP)',
    exam_guide_url: 'https://pythoninstitute.org/pcap',
    min_quiz_counts: 10,
    max_quiz_counts: 40,
    firm_code: 'GENERIC',
  },

  // Additional AI/ML and Data Science Certifications
  {
    name: 'Microsoft Certified: Azure AI Fundamentals',
    exam_guide_url:
      'https://learn.microsoft.com/en-us/credentials/certifications/azure-ai-fundamentals/',
    min_quiz_counts: 10,
    max_quiz_counts: 40,
    firm_code: 'AZURE',
  },

  {
    name: 'Microsoft Certified: Azure Data Fundamentals',
    exam_guide_url:
      'https://learn.microsoft.com/en-us/credentials/certifications/azure-data-fundamentals/',
    min_quiz_counts: 10,
    max_quiz_counts: 40,
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

  {
    name: 'TensorFlow Developer Certificate',
    exam_guide_url: 'https://www.tensorflow.org/certificate',
    min_quiz_counts: 12,
    max_quiz_counts: 50,
    firm_code: 'GENERIC',
  },

  {
    name: 'Databricks Certified Machine Learning Associate',
    exam_guide_url:
      'https://www.databricks.com/learn/certification/machine-learning-associate',
    min_quiz_counts: 15,
    max_quiz_counts: 72,
    firm_code: 'DATABRICKS',
  },

  {
    name: 'Databricks Certified Data Engineer Associate',
    exam_guide_url:
      'https://www.databricks.com/learn/certification/data-engineer-associate',
    min_quiz_counts: 15,
    max_quiz_counts: 72,
    firm_code: 'DATABRICKS',
  },

  {
    name: 'NVIDIA Certified Associate - Generative AI with LLMs',
    exam_guide_url:
      'https://www.nvidia.com/en-us/training/instructor-led-workshops/generative-ai/',
    min_quiz_counts: 12,
    max_quiz_counts: 60,
    firm_code: 'GENERIC',
  },

  // Additional Security Certifications
  {
    name: 'Certified Ethical Hacker (CEH)',
    exam_guide_url:
      'https://www.eccouncil.org/train-certify/certified-ethical-hacker-ceh/',
    min_quiz_counts: 20,
    max_quiz_counts: 125,
    firm_code: 'GENERIC',
  },

  {
    name: 'CompTIA CySA+ (Cybersecurity Analyst)',
    exam_guide_url:
      'https://www.comptia.org/certifications/cybersecurity-analyst',
    min_quiz_counts: 15,
    max_quiz_counts: 85,
    firm_code: 'COMPTIA',
  },

  {
    name: 'CompTIA PenTest+ (Penetration Testing)',
    exam_guide_url: 'https://www.comptia.org/certifications/pentest',
    min_quiz_counts: 15,
    max_quiz_counts: 85,
    firm_code: 'COMPTIA',
  },

  // Additional Project Management & Agile Certifications (Multiple Choice Format)
  {
    name: 'Certified Scrum Product Owner (CSPO)',
    exam_guide_url:
      'https://www.scrumalliance.org/get-certified/product-owner-track/certified-scrum-product-owner',
    min_quiz_counts: 10,
    max_quiz_counts: 50,
    firm_code: 'SCRUMALLIANCE',
  },
  {
    name: 'Certified Scrum Developer (CSD)',
    exam_guide_url:
      'https://www.scrumalliance.org/get-certified/developer-track/certified-scrum-developer',
    min_quiz_counts: 12,
    max_quiz_counts: 60,
    firm_code: 'SCRUMALLIANCE',
  },
  {
    name: 'Advanced Certified Scrum Master (A-CSM)',
    exam_guide_url:
      'https://www.scrumalliance.org/get-certified/scrum-master-track/advanced-certified-scrummaster',
    min_quiz_counts: 15,
    max_quiz_counts: 65,
    firm_code: 'SCRUMALLIANCE',
  },
  {
    name: 'Professional Scrum Product Owner I (PSPO I)',
    exam_guide_url:
      'https://www.scrum.org/professional-scrum-product-owner-i-certification',
    min_quiz_counts: 15,
    max_quiz_counts: 80,
    firm_code: 'SCRUMORG',
  },
  {
    name: 'Professional Scrum Master II (PSM II)',
    exam_guide_url:
      'https://www.scrum.org/professional-scrum-master-ii-certification',
    min_quiz_counts: 20,
    max_quiz_counts: 90,
    firm_code: 'SCRUMORG',
  },
  {
    name: 'Professional Scrum Developer I (PSD I)',
    exam_guide_url:
      'https://www.scrum.org/professional-scrum-developer-certification',
    min_quiz_counts: 15,
    max_quiz_counts: 80,
    firm_code: 'SCRUMORG',
  },
  {
    name: 'SAFe 6 Agilist Certification (SA)',
    exam_guide_url: 'https://www.scaledagile.com/certification/safe-agilist/',
    min_quiz_counts: 20,
    max_quiz_counts: 45,
    firm_code: 'SAI',
  },
  {
    name: 'SAFe 6 Scrum Master Certification (SSM)',
    exam_guide_url:
      'https://www.scaledagile.com/certification/safe-scrum-master/',
    min_quiz_counts: 18,
    max_quiz_counts: 45,
    firm_code: 'SAI',
  },
  {
    name: 'SAFe 6 Product Owner/Product Manager (POPM)',
    exam_guide_url:
      'https://www.scaledagile.com/certification/safe-product-owner-product-manager/',
    min_quiz_counts: 18,
    max_quiz_counts: 45,
    firm_code: 'SAI',
  },
  {
    name: 'PMI Risk Management Professional (PMI-RMP)',
    exam_guide_url: 'https://www.pmi.org/certifications/risk-management-rmp',
    min_quiz_counts: 20,
    max_quiz_counts: 170,
    firm_code: 'PMI',
  },
  {
    name: 'PMI Scheduling Professional (PMI-SP)',
    exam_guide_url: 'https://www.pmi.org/certifications/scheduling-pmi-sp',
    min_quiz_counts: 20,
    max_quiz_counts: 170,
    firm_code: 'PMI',
  },
  {
    name: 'Program Management Professional (PgMP)',
    exam_guide_url:
      'https://www.pmi.org/certifications/program-management-pgmp',
    min_quiz_counts: 25,
    max_quiz_counts: 170,
    firm_code: 'PMI',
  },
  {
    name: 'Portfolio Management Professional (PfMP)',
    exam_guide_url:
      'https://www.pmi.org/certifications/portfolio-management-pfmp',
    min_quiz_counts: 25,
    max_quiz_counts: 170,
    firm_code: 'PMI',
  },

  // Additional Scrum Alliance Certifications
  {
    name: 'Certified ScrumMaster (CSM)',
    exam_guide_url:
      'https://www.scrumalliance.org/get-certified/scrum-master-track/certified-scrummaster',
    min_quiz_counts: 10,
    max_quiz_counts: 50,
    firm_code: 'SCRUMALLIANCE',
  },
  {
    name: 'Certified Scrum Professional - ScrumMaster (CSP-SM)',
    exam_guide_url:
      'https://www.scrumalliance.org/get-certified/scrum-master-track/certified-scrum-professional-scrummaster',
    min_quiz_counts: 15,
    max_quiz_counts: 60,
    firm_code: 'SCRUMALLIANCE',
  },
  {
    name: 'Certified Scrum Professional - Product Owner (CSP-PO)',
    exam_guide_url:
      'https://www.scrumalliance.org/get-certified/product-owner-track/certified-scrum-professional-product-owner',
    min_quiz_counts: 15,
    max_quiz_counts: 60,
    firm_code: 'SCRUMALLIANCE',
  },
  {
    name: 'Certified Agile Leadership I (CAL-I)',
    exam_guide_url:
      'https://www.scrumalliance.org/get-certified/leadership-track/cal-1',
    min_quiz_counts: 12,
    max_quiz_counts: 55,
    firm_code: 'SCRUMALLIANCE',
  },

  // Additional Scrum.org Certifications
  {
    name: 'Professional Scrum Product Owner II (PSPO II)',
    exam_guide_url:
      'https://www.scrum.org/professional-scrum-product-owner-ii-certification',
    min_quiz_counts: 18,
    max_quiz_counts: 90,
    firm_code: 'SCRUMORG',
  },
  {
    name: 'Professional Scrum Master III (PSM III)',
    exam_guide_url:
      'https://www.scrum.org/professional-scrum-master-iii-certification',
    min_quiz_counts: 25,
    max_quiz_counts: 100,
    firm_code: 'SCRUMORG',
  },
  {
    name: 'Professional Scrum Product Owner III (PSPO III)',
    exam_guide_url:
      'https://www.scrum.org/professional-scrum-product-owner-iii-certification',
    min_quiz_counts: 25,
    max_quiz_counts: 100,
    firm_code: 'SCRUMORG',
  },
  {
    name: 'Scaled Professional Scrum (SPS)',
    exam_guide_url:
      'https://www.scrum.org/scaled-professional-scrum-certification',
    min_quiz_counts: 20,
    max_quiz_counts: 85,
    firm_code: 'SCRUMORG',
  },

  // Additional SAFe Certifications
  {
    name: 'SAFe 6 DevOps Practitioner (SDP)',
    exam_guide_url: 'https://www.scaledagile.com/certification/safe-devops/',
    min_quiz_counts: 18,
    max_quiz_counts: 45,
    firm_code: 'SAI',
  },
  {
    name: 'SAFe 6 Release Train Engineer (RTE)',
    exam_guide_url:
      'https://www.scaledagile.com/certification/safe-release-train-engineer/',
    min_quiz_counts: 20,
    max_quiz_counts: 45,
    firm_code: 'SAI',
  },
  {
    name: 'SAFe 6 Lean Portfolio Manager (LPM)',
    exam_guide_url:
      'https://www.scaledagile.com/certification/safe-lean-portfolio-manager/',
    min_quiz_counts: 20,
    max_quiz_counts: 45,
    firm_code: 'SAI',
  },
  {
    name: 'SAFe 6 Advanced Scrum Master (ASM)',
    exam_guide_url:
      'https://www.scaledagile.com/certification/safe-advanced-scrum-master/',
    min_quiz_counts: 20,
    max_quiz_counts: 45,
    firm_code: 'SAI',
  },
];

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
            slug: generateSlug(update.name),
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

// Function to generate slug from certification name
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters except spaces and hyphens
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .trim(); // Remove leading/trailing whitespace
}

// Helper function to determine firm code based on certification name
function getFirmCodeFromCertificationName(
  certName: string,
  providedFirmCode?: string,
): string {
  // If firm code is explicitly provided, use it
  if (providedFirmCode) {
    return providedFirmCode;
  }

  const name = certName.toLowerCase();

  // AWS certifications
  if (name.includes('aws') || name.includes('amazon')) {
    return 'AWS';
  }

  // Google Cloud certifications
  if (name.includes('google') || name.includes('gcp')) {
    return 'GCP';
  }

  // Microsoft Azure certifications
  if (name.includes('azure') || name.includes('microsoft')) {
    return 'AZURE';
  }

  // IBM certifications
  if (name.includes('ibm') || name.includes('watsonx')) {
    return 'IBM';
  }

  // Oracle certifications
  if (name.includes('oracle')) {
    return 'ORACLE';
  }

  // Salesforce certifications
  if (name.includes('salesforce')) {
    return 'SFDC';
  }

  // VMware certifications
  if (name.includes('vmware')) {
    return 'VMWARE';
  }

  // Cisco certifications
  if (
    name.includes('cisco') ||
    name.includes('ccna') ||
    name.includes('ccnp') ||
    name.includes('ccie')
  ) {
    return 'CISCO';
  }

  // Red Hat certifications
  if (
    name.includes('red hat') ||
    name.includes('rhcsa') ||
    name.includes('rhce') ||
    name.includes('openshift') ||
    name.includes('ansible')
  ) {
    return 'REDHAT';
  }

  // Docker certifications
  if (name.includes('docker')) {
    return 'DOCKER';
  }

  // Kubernetes certifications
  if (
    name.includes('kubernetes') ||
    name.includes('k8s') ||
    name.includes('cka') ||
    name.includes('ckad') ||
    name.includes('cks')
  ) {
    return 'K8S';
  }

  // CompTIA certifications
  if (name.includes('comptia')) {
    return 'COMPTIA';
  }

  // PMI certifications
  if (
    name.includes('pmp') ||
    name.includes('project management') ||
    name.includes('capm') ||
    name.includes('pmi') ||
    name.includes('disciplined agile') ||
    name.includes('dasm') ||
    name.includes('dassm') ||
    name.includes('construction professional')
  ) {
    return 'PMI';
  }

  // ITIL certifications
  if (name.includes('itil')) {
    return 'ITIL';
  }

  // TOGAF certifications
  if (name.includes('togaf')) {
    return 'TOGAF';
  }

  // ISC2 certifications
  if (name.includes('cissp') || name.includes('isc2')) {
    return 'ISC2';
  }

  // HashiCorp certifications
  if (name.includes('hashicorp') || name.includes('terraform')) {
    return 'HASHICORP';
  }

  // Linux Professional Institute certifications
  if (name.includes('linux professional institute') || name.includes('lpic')) {
    return 'LPI';
  }

  // Databricks certifications
  if (name.includes('databricks')) {
    return 'DATABRICKS';
  }

  // Scrum Alliance certifications
  if (
    name.includes('certified scrum') ||
    name.includes('csm') ||
    name.includes('cspo') ||
    name.includes('csd') ||
    name.includes('a-csm') ||
    name.includes('csp-sm') ||
    name.includes('csp-po') ||
    name.includes('cal-i') ||
    name.includes('certified agile leadership')
  ) {
    return 'SCRUMALLIANCE';
  }

  // Scrum.org certifications
  if (
    name.includes('professional scrum') ||
    name.includes('psm') ||
    name.includes('pspo') ||
    name.includes('psd') ||
    name.includes('scaled professional scrum') ||
    name.includes('sps')
  ) {
    return 'SCRUMORG';
  }

  // Scaled Agile (SAFe) certifications
  if (
    name.includes('safe') ||
    name.includes('scaled agile') ||
    name.includes('sdp') ||
    name.includes('rte') ||
    name.includes('lpm') ||
    name.includes('asm') ||
    name.includes('devops practitioner') ||
    name.includes('release train engineer') ||
    name.includes('lean portfolio manager') ||
    name.includes('advanced scrum master')
  ) {
    return 'SAI';
  }

  // Default fallback
  return 'GENERIC';
}

async function seedCertifications() {
  console.log('Starting certification seeding...');
  console.log(
    '🔄 Using comprehensive certification list with 80+ certifications\n',
  );

  // Use the comprehensive certification list from certificationUrlUpdates
  // Convert the URL update format to the seeding format
  const certifications = certificationUrlUpdates.map(
    (cert: {
      name: string;
      slug?: string;
      exam_guide_url: string;
      min_quiz_counts?: number;
      max_quiz_counts?: number;
      firm_code?: string;
    }) => ({
      name: cert.name,
      slug: cert.slug || generateSlug(cert.name), // Use provided slug or generate one
      exam_guide_url: cert.exam_guide_url,
      min_quiz_counts: cert.min_quiz_counts || 10, // Default values if not specified
      max_quiz_counts: cert.max_quiz_counts || 50,
      pass_score: 75.0,
      firm_code: cert.firm_code,
    }),
  );

  let createdCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  console.log(`📋 Processing ${certifications.length} certifications...\n`);

  for (const cert of certifications) {
    try {
      // Get firm_id based on certification name or provided firm_code
      const firmCode = getFirmCodeFromCertificationName(
        cert.name,
        cert.firm_code,
      );

      // Find the firm
      const firm = await prismaInstance.firm.findUnique({
        where: { code: firmCode },
      });

      if (!firm) {
        console.log(
          `⚠️  Firm "${firmCode}" not found for certification "${cert.name}"`,
        );
        skippedCount++;
        continue;
      }

      // Check if certification already exists
      const existingCert = await prismaInstance.certification.findFirst({
        where: { name: cert.name },
      });

      if (existingCert) {
        console.log(`➡️  Certification "${cert.name}" already exists`);
        skippedCount++;
        continue;
      }

      await prismaInstance.certification.create({
        data: {
          name: cert.name,
          slug: cert.slug,
          exam_guide_url: cert.exam_guide_url,
          min_quiz_counts: cert.min_quiz_counts,
          max_quiz_counts: cert.max_quiz_counts,
          pass_score: cert.pass_score,
          firm_id: firm.firm_id,
          // cert_category_id: cert.cert_category_id,
        },
      });

      console.log(
        `✅ Created certification "${cert.name}" for firm ${firmCode}`,
      );
      createdCount++;
    } catch (error) {
      console.error(`❌ Error creating certification "${cert.name}":`, error);
      errorCount++;
    }
  }

  console.log('\n📊 Certification Seeding Summary:');
  console.log(`✅ Successfully created: ${createdCount} certifications`);
  console.log(`➡️  Skipped (existing/errors): ${skippedCount} certifications`);
  if (errorCount > 0) {
    console.log(`❌ Errors encountered: ${errorCount} certifications`);
  }
  console.log(`📈 Total processed: ${certifications.length} certifications`);
  console.log('✅ Certifications seeding completed successfully.');
}

// Function to update existing certifications with slugs
async function updateCertificationSlugs() {
  console.log('Starting slug update for existing certifications...');

  try {
    // Get all certifications that don't have slugs (empty or null-like values)
    const certificationsWithoutSlugs =
      await prismaInstance.certification.findMany({
        where: {
          OR: [
            { slug: '' },
            { slug: { startsWith: 'temp-' } }, // In case we have temporary slugs
          ],
        },
      });

    console.log(
      `Found ${certificationsWithoutSlugs.length} certifications without slugs`,
    );

    let updatedCount = 0;
    let errorCount = 0;

    for (const cert of certificationsWithoutSlugs) {
      try {
        const slug = generateSlug(cert.name);

        // Check if this slug already exists
        const existingSlug = await prismaInstance.certification.findUnique({
          where: { slug },
        });

        let finalSlug = slug;
        if (existingSlug && existingSlug.cert_id !== cert.cert_id) {
          // If slug exists, append cert_id to make it unique
          finalSlug = `${slug}-${cert.cert_id}`;
        }

        await prismaInstance.certification.update({
          where: { cert_id: cert.cert_id },
          data: { slug: finalSlug },
        });

        console.log(`✅ Updated "${cert.name}" with slug: ${finalSlug}`);
        updatedCount++;
      } catch (error) {
        console.error(`❌ Error updating slug for "${cert.name}":`, error);
        errorCount++;
      }
    }

    console.log('\n📊 Slug Update Summary:');
    console.log(`✅ Successfully updated: ${updatedCount} certifications`);
    if (errorCount > 0) {
      console.log(`❌ Errors encountered: ${errorCount} certifications`);
    }
  } catch (error) {
    console.error('❌ Error in updateCertificationSlugs:', error);
  }
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
    case 'update-slugs':
      await updateCertificationSlugs();
      break;
    case 'seed-firms':
      await seedFirms();
      break;
    case 'seed-certs':
      await seedCertifications();
      break;
    case 'seed':
    default:
      // Seed both firms and certifications
      console.log(
        '🚀 Starting comprehensive seeding (firms + certifications)...\n',
      );
      await seedFirms();
      console.log('\n' + '='.repeat(60) + '\n');
      await seedCertifications();
      console.log('\n✅ Comprehensive seeding completed successfully!');
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
