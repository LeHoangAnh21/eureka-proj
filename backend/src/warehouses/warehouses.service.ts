import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  CreateWarehouseDto,
  UpdateWarehouseDto,
  QueryWarehouseDto,
} from './dto/warehouse.dto';
import { paginate } from '../common/dto/pagination.dto';

@Injectable()
export class WarehousesService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async create(dto: CreateWarehouseDto, actorId: string) {
    const exists = await this.prisma.warehouse.findUnique({
      where: { code: dto.code },
    });
    if (exists)
      throw new ConflictException(
        `Warehouse code '${dto.code}' already exists`,
      );
    const w = await this.prisma.warehouse.create({ data: dto });
    await this.audit.log({
      userId: actorId,
      action: 'WAREHOUSE_CREATED',
      entityType: 'Warehouse',
      entityId: w.id,
      newValue: w,
    });
    return w;
  }

  async importMany(items: CreateWarehouseDto[], actorId: string) {
    const results: Record<string, string>[] = [];
    for (const dto of items) {
      const exists = await this.prisma.warehouse.findUnique({
        where: { code: dto.code },
      });
      if (exists) {
        results.push({ code: dto.code, status: 'skipped' });
        continue;
      }
      const w = await this.prisma.warehouse.create({ data: dto });
      await this.audit.log({
        userId: actorId,
        action: 'WAREHOUSE_IMPORTED',
        entityType: 'Warehouse',
        entityId: w.id,
        newValue: w,
      });
      results.push({ code: dto.code, status: 'created', id: w.id });
    }
    return results;
  }

  async findAll(query: QueryWarehouseDto) {
    const { page, limit, search, isActive } = query;
    const where = {
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { code: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
      ...(isActive !== undefined ? { isActive } : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.warehouse.findMany({
        where,
        ...paginate(page, limit),
        orderBy: { code: 'asc' },
      }),
      this.prisma.warehouse.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async findOne(id: string) {
    const w = await this.prisma.warehouse.findUnique({ where: { id } });
    if (!w) throw new NotFoundException('Warehouse not found');
    return w;
  }

  async update(id: string, dto: UpdateWarehouseDto, actorId: string) {
    const old = await this.findOne(id);
    const updated = await this.prisma.warehouse.update({
      where: { id },
      data: dto,
    });
    await this.audit.log({
      userId: actorId,
      action: 'WAREHOUSE_UPDATED',
      entityType: 'Warehouse',
      entityId: id,
      oldValue: old,
      newValue: updated,
    });
    return updated;
  }
}
