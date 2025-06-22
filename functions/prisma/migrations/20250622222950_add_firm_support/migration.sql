/*
  Warnings:

  - Added the required column `firm_id` to the `Certification` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "Firm" (
    "firm_id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "website_url" TEXT,
    "logo_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Firm_pkey" PRIMARY KEY ("firm_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Firm_name_key" ON "Firm"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Firm_code_key" ON "Firm"("code");

-- CreateIndex
CREATE INDEX "Firm_code_idx" ON "Firm"("code");

-- Insert common cloud providers and certification bodies
INSERT INTO "Firm" (name, code, description, website_url, updated_at) VALUES
('Amazon Web Services', 'AWS', 'Amazon Web Services cloud computing platform', 'https://aws.amazon.com', CURRENT_TIMESTAMP),
('Google Cloud Platform', 'GCP', 'Google Cloud Platform services', 'https://cloud.google.com', CURRENT_TIMESTAMP),
('Microsoft Azure', 'AZURE', 'Microsoft Azure cloud services', 'https://azure.microsoft.com', CURRENT_TIMESTAMP),
('IBM Cloud', 'IBM', 'IBM Cloud and cognitive services', 'https://www.ibm.com/cloud', CURRENT_TIMESTAMP),
('Oracle Cloud', 'ORACLE', 'Oracle Cloud Infrastructure', 'https://www.oracle.com/cloud', CURRENT_TIMESTAMP),
('Salesforce', 'SFDC', 'Salesforce CRM and cloud platform', 'https://www.salesforce.com', CURRENT_TIMESTAMP),
('VMware', 'VMWARE', 'VMware virtualization and cloud infrastructure', 'https://www.vmware.com', CURRENT_TIMESTAMP),
('Cisco', 'CISCO', 'Cisco networking and security', 'https://www.cisco.com', CURRENT_TIMESTAMP),
('Red Hat', 'REDHAT', 'Red Hat enterprise software', 'https://www.redhat.com', CURRENT_TIMESTAMP),
('Docker', 'DOCKER', 'Docker containerization platform', 'https://www.docker.com', CURRENT_TIMESTAMP),
('Kubernetes', 'K8S', 'Kubernetes container orchestration', 'https://kubernetes.io', CURRENT_TIMESTAMP),
('CompTIA', 'COMPTIA', 'Computing Technology Industry Association', 'https://www.comptia.org', CURRENT_TIMESTAMP),
('PMI', 'PMI', 'Project Management Institute', 'https://www.pmi.org', CURRENT_TIMESTAMP),
('ITIL', 'ITIL', 'Information Technology Infrastructure Library', 'https://www.axelos.com/best-practice-solutions/itil', CURRENT_TIMESTAMP),
('TOGAF', 'TOGAF', 'The Open Group Architecture Framework', 'https://www.opengroup.org/togaf', CURRENT_TIMESTAMP),
('Generic', 'GENERIC', 'Generic certification provider', NULL, CURRENT_TIMESTAMP);

-- Add firm_id column as nullable first
ALTER TABLE "Certification" ADD COLUMN "firm_id" INTEGER;

-- Update existing certifications based on naming patterns
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

-- For any remaining certifications without a firm_id, assign them to Generic
UPDATE "Certification"
SET firm_id = (SELECT firm_id FROM "Firm" WHERE code = 'GENERIC')
WHERE firm_id IS NULL;

-- Now make firm_id NOT NULL
ALTER TABLE "Certification" ALTER COLUMN "firm_id" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Certification_firm_id_idx" ON "Certification"("firm_id");

-- AddForeignKey
ALTER TABLE "Certification" ADD CONSTRAINT "Certification_firm_id_fkey" FOREIGN KEY ("firm_id") REFERENCES "Firm"("firm_id") ON DELETE CASCADE ON UPDATE CASCADE;
