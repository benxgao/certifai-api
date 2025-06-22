-- Manual migration script to add Firm support and update existing data
-- This script should be reviewed and executed manually after the Prisma migration

-- First, let's see what certifications we have
-- SELECT cert_id, name FROM "Certification";

-- Insert common cloud providers
INSERT INTO "Firm" (name, code, description, website_url) VALUES
('Amazon Web Services', 'AWS', 'Amazon Web Services cloud computing platform', 'https://aws.amazon.com'),
('Google Cloud Platform', 'GCP', 'Google Cloud Platform services', 'https://cloud.google.com'),
('Microsoft Azure', 'AZURE', 'Microsoft Azure cloud services', 'https://azure.microsoft.com'),
('IBM Cloud', 'IBM', 'IBM Cloud and cognitive services', 'https://www.ibm.com/cloud'),
('Oracle Cloud', 'ORACLE', 'Oracle Cloud Infrastructure', 'https://www.oracle.com/cloud'),
('Salesforce', 'SFDC', 'Salesforce CRM and cloud platform', 'https://www.salesforce.com'),
('VMware', 'VMWARE', 'VMware virtualization and cloud infrastructure', 'https://www.vmware.com'),
('Cisco', 'CISCO', 'Cisco networking and security', 'https://www.cisco.com'),
('Red Hat', 'REDHAT', 'Red Hat enterprise software', 'https://www.redhat.com'),
('Docker', 'DOCKER', 'Docker containerization platform', 'https://www.docker.com'),
('Kubernetes', 'K8S', 'Kubernetes container orchestration', 'https://kubernetes.io'),
('CompTIA', 'COMPTIA', 'Computing Technology Industry Association', 'https://www.comptia.org'),
('PMI', 'PMI', 'Project Management Institute', 'https://www.pmi.org'),
('ITIL', 'ITIL', 'Information Technology Infrastructure Library', 'https://www.axelos.com/best-practice-solutions/itil'),
('TOGAF', 'TOGAF', 'The Open Group Architecture Framework', 'https://www.opengroup.org/togaf');

-- Update existing certifications based on naming patterns
-- You may need to adjust these queries based on your actual certification names

-- AWS certifications
UPDATE "Certification"
SET firm_id = (SELECT firm_id FROM "Firm" WHERE code = 'AWS')
WHERE LOWER(name) LIKE '%aws%' OR LOWER(name) LIKE '%amazon%';

-- Google Cloud certifications
UPDATE "Certification"
SET firm_id = (SELECT firm_id FROM "Firm" WHERE code = 'GCP')
WHERE LOWER(name) LIKE '%google%' OR LOWER(name) LIKE '%gcp%' OR LOWER(name) LIKE '%cloud platform%';

-- Azure certifications
UPDATE "Certification"
SET firm_id = (SELECT firm_id FROM "Firm" WHERE code = 'AZURE')
WHERE LOWER(name) LIKE '%azure%' OR LOWER(name) LIKE '%microsoft%';

-- IBM certifications
UPDATE "Certification"
SET firm_id = (SELECT firm_id FROM "Firm" WHERE code = 'IBM')
WHERE LOWER(name) LIKE '%ibm%';

-- Oracle certifications
UPDATE "Certification"
SET firm_id = (SELECT firm_id FROM "Firm" WHERE code = 'ORACLE')
WHERE LOWER(name) LIKE '%oracle%';

-- Salesforce certifications
UPDATE "Certification"
SET firm_id = (SELECT firm_id FROM "Firm" WHERE code = 'SFDC')
WHERE LOWER(name) LIKE '%salesforce%';

-- VMware certifications
UPDATE "Certification"
SET firm_id = (SELECT firm_id FROM "Firm" WHERE code = 'VMWARE')
WHERE LOWER(name) LIKE '%vmware%';

-- Cisco certifications
UPDATE "Certification"
SET firm_id = (SELECT firm_id FROM "Firm" WHERE code = 'CISCO')
WHERE LOWER(name) LIKE '%cisco%' OR LOWER(name) LIKE '%ccna%' OR LOWER(name) LIKE '%ccnp%' OR LOWER(name) LIKE '%ccie%';

-- Red Hat certifications
UPDATE "Certification"
SET firm_id = (SELECT firm_id FROM "Firm" WHERE code = 'REDHAT')
WHERE LOWER(name) LIKE '%red hat%' OR LOWER(name) LIKE '%rhce%' OR LOWER(name) LIKE '%rhcsa%';

-- Docker certifications
UPDATE "Certification"
SET firm_id = (SELECT firm_id FROM "Firm" WHERE code = 'DOCKER')
WHERE LOWER(name) LIKE '%docker%';

-- Kubernetes certifications
UPDATE "Certification"
SET firm_id = (SELECT firm_id FROM "Firm" WHERE code = 'K8S')
WHERE LOWER(name) LIKE '%kubernetes%' OR LOWER(name) LIKE '%k8s%' OR LOWER(name) LIKE '%cka%' OR LOWER(name) LIKE '%ckad%' OR LOWER(name) LIKE '%cks%';

-- CompTIA certifications
UPDATE "Certification"
SET firm_id = (SELECT firm_id FROM "Firm" WHERE code = 'COMPTIA')
WHERE LOWER(name) LIKE '%comptia%' OR LOWER(name) LIKE '%security+%' OR LOWER(name) LIKE '%network+%' OR LOWER(name) LIKE '%a+%';

-- PMI certifications
UPDATE "Certification"
SET firm_id = (SELECT firm_id FROM "Firm" WHERE code = 'PMI')
WHERE LOWER(name) LIKE '%pmp%' OR LOWER(name) LIKE '%project management%' OR LOWER(name) LIKE '%pmi%';

-- ITIL certifications
UPDATE "Certification"
SET firm_id = (SELECT firm_id FROM "Firm" WHERE code = 'ITIL')
WHERE LOWER(name) LIKE '%itil%';

-- TOGAF certifications
UPDATE "Certification"
SET firm_id = (SELECT firm_id FROM "Firm" WHERE code = 'TOGAF')
WHERE LOWER(name) LIKE '%togaf%';

-- For any remaining certifications without a firm_id, you may want to create a generic firm
-- or manually assign them based on your specific data

-- Check which certifications still don't have a firm assigned
-- SELECT cert_id, name FROM "Certification" WHERE firm_id IS NULL;
