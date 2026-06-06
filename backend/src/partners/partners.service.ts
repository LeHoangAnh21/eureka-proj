import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  CreatePartnerDto,
  UpdatePartnerDto,
  QueryPartnerDto,
} from './dto/partner.dto';
import { paginate } from '../common/dto/pagination.dto';

@Injectable()
export class PartnersService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async create(dto: CreatePartnerDto, actorId: string) {
    const exists = await this.prisma.partner.findUnique({
      where: { code: dto.code },
    });
    if (exists)
      throw new ConflictException(`Partner code '${dto.code}' already exists`);
    const p = await this.prisma.partner.create({
      data: {
        code: dto.code,
        name: dto.name,
        type: dto.type as never,
        taxCode: dto.taxCode,
        address: dto.address,
      },
    });
    await this.audit.log({
      userId: actorId,
      action: 'PARTNER_CREATED',
      entityType: 'Partner',
      entityId: p.id,
      newValue: p,
    });
    return p;
  }

  async importMany(items: CreatePartnerDto[], actorId: string) {
    const results: Record<string, string>[] = [];
    for (const dto of items) {
      const exists = await this.prisma.partner.findUnique({
        where: { code: dto.code },
      });
      if (exists) {
        results.push({ code: dto.code, status: 'skipped' });
        continue;
      }
      const p = await this.prisma.partner.create({
        data: {
          code: dto.code,
          name: dto.name,
          type: dto.type as never,
          taxCode: dto.taxCode,
          address: dto.address,
        },
      });
      await this.audit.log({
        userId: actorId,
        action: 'PARTNER_IMPORTED',
        entityType: 'Partner',
        entityId: p.id,
        newValue: p,
      });
      results.push({ code: dto.code, status: 'created', id: p.id });
    }
    return results;
  }

  async findAll(query: QueryPartnerDto) {
    const { page, limit, search, type, isActive } = query;
    const where = {
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { code: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
      ...(type ? { type: type as never } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.partner.findMany({
        where,
        ...paginate(page, limit),
        orderBy: { code: 'asc' },
      }),
      this.prisma.partner.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async findOne(id: string) {
    const p = await this.prisma.partner.findUnique({ where: { id } });
    if (!p) throw new NotFoundException('Partner not found');
    return p;
  }

  async update(id: string, dto: UpdatePartnerDto, actorId: string) {
    const old = await this.findOne(id);
    const updated = await this.prisma.partner.update({
      where: { id },
      data: dto as never,
    });
    await this.audit.log({
      userId: actorId,
      action: 'PARTNER_UPDATED',
      entityType: 'Partner',
      entityId: id,
      oldValue: old,
      newValue: updated,
    });
    return updated;
  }
}
