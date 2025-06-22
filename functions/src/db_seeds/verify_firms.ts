import prismaInstance from '../services/prisma';

async function main() {
  // Check current firms
  console.log('Current firms in the database:');
  const firms = await prismaInstance.firm.findMany({
    orderBy: { name: 'asc' },
  });

  console.table(
    firms.map((f: any) => ({
      id: f.firm_id,
      name: f.name,
      code: f.code,
      description: f.description,
    })),
  );

  // Check certifications and their assigned firms
  console.log('\nCertifications and their firms:');
  const certifications = await prismaInstance.certification.findMany({
    include: {
      firm: true,
    },
    orderBy: { name: 'asc' },
  });

  console.table(
    certifications.map((c: any) => ({
      id: c.cert_id,
      name: c.name,
      firm: c.firm.name,
      firm_code: c.firm.code,
    })),
  );

  // Count certifications by firm
  console.log('\nCertifications count by firm:');
  const firmCounts = await prismaInstance.firm.findMany({
    select: {
      name: true,
      code: true,
      _count: {
        select: {
          certifications: true,
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  console.table(
    firmCounts.map((f: any) => ({
      firm: f.name,
      code: f.code,
      certifications_count: f._count.certifications,
    })),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prismaInstance.$disconnect();
  });
