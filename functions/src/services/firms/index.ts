import prismaInstance from '../prisma';
import { Firm, Certification } from '../../generated/prisma';

export interface CreateFirmData {
  name: string;
  code: string;
  description?: string;
  website_url?: string;
  logo_url?: string;
}

export interface UpdateFirmData {
  name?: string;
  code?: string;
  description?: string;
  website_url?: string;
  logo_url?: string;
}

export class FirmService {
  /**
   * Create a new firm
   */
  async createFirm(data: CreateFirmData): Promise<Firm> {
    return await prismaInstance.firm.create({
      data: {
        ...data,
        updated_at: new Date(),
      },
    });
  }

  /**
   * Get all firms
   */
  async getAllFirms(): Promise<Firm[]> {
    return await prismaInstance.firm.findMany({
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Get a firm by ID
   */
  async getFirmById(firm_id: number): Promise<Firm | null> {
    return await prismaInstance.firm.findUnique({
      where: { firm_id },
    });
  }

  /**
   * Get a firm by code
   */
  async getFirmByCode(code: string): Promise<Firm | null> {
    return await prismaInstance.firm.findUnique({
      where: { code },
    });
  }

  /**
   * Update a firm
   */
  async updateFirm(firm_id: number, data: UpdateFirmData): Promise<Firm> {
    return await prismaInstance.firm.update({
      where: { firm_id },
      data: {
        ...data,
        updated_at: new Date(),
      },
    });
  }

  /**
   * Delete a firm
   */
  async deleteFirm(firm_id: number): Promise<Firm> {
    return await prismaInstance.firm.delete({
      where: { firm_id },
    });
  }

  /**
   * Get firms with certification counts
   */
  async getFirmsWithCertificationCounts(): Promise<
    (Firm & { _count: { certifications: number } })[]
  > {
    return await prismaInstance.firm.findMany({
      include: {
        _count: {
          select: {
            certifications: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Get firm with its certifications
   */
  async getFirmWithCertifications(
    firm_id: number,
  ): Promise<(Firm & { certifications: Certification[] }) | null> {
    return await prismaInstance.firm.findUnique({
      where: { firm_id },
      include: {
        certifications: {
          orderBy: { name: 'asc' },
        },
      },
    });
  }

  /**
   * Search firms by name or code
   */
  async searchFirms(query: string): Promise<Firm[]> {
    return await prismaInstance.firm.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { code: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
        ],
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Get certification count by firm
   */
  async getCertificationCountByFirm(): Promise<
    { firm: Firm; count: number }[]
  > {
    const firms = await prismaInstance.firm.findMany({
      include: {
        _count: {
          select: {
            certifications: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return firms.map((firm) => ({
      firm: {
        firm_id: firm.firm_id,
        name: firm.name,
        code: firm.code,
        description: firm.description,
        website_url: firm.website_url,
        logo_url: firm.logo_url,
        created_at: firm.created_at,
        updated_at: firm.updated_at,
      },
      count: firm._count.certifications,
    }));
  }

  /**
   * Get certifications by firm ID
   */
  async getCertificationsByFirmId(firm_id: number): Promise<Certification[]> {
    return await prismaInstance.certification.findMany({
      where: { firm_id },
      orderBy: { name: 'asc' },
    });
  }
}

export default new FirmService();
