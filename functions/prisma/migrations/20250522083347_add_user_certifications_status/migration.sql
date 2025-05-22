-- CreateEnum
CREATE TYPE "CertificationStatus" AS ENUM ('PASSED', 'IN_PROGRESS', 'INTERESTED');

-- CreateTable
CREATE TABLE "UserCertification" (
    "user_id" INTEGER NOT NULL,
    "cert_id" INTEGER NOT NULL,
    "status" "CertificationStatus" NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserCertification_pkey" PRIMARY KEY ("user_id","cert_id")
);

-- AddForeignKey
ALTER TABLE "UserCertification" ADD CONSTRAINT "UserCertification_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "Users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCertification" ADD CONSTRAINT "UserCertification_cert_id_fkey" FOREIGN KEY ("cert_id") REFERENCES "Certifications"("cert_id") ON DELETE RESTRICT ON UPDATE CASCADE;
