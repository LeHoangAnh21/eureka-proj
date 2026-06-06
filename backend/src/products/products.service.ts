import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  CreateProductDto,
  UpdateProductDto,
  QueryProductDto,
} from './dto/product.dto';
import { paginate } from '../common/dto/pagination.dto';

@Injectable()
export class ProductsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async create(dto: CreateProductDto, actorId: string) {
    const exists = await this.prisma.product.findUnique({
      where: { code: dto.code },
    });
    if (exists)
      throw new ConflictException(`Product code '${dto.code}' already exists`);
    const p = await this.prisma.product.create({ data: dto });
    await this.audit.log({
      userId: actorId,
      action: 'PRODUCT_CREATED',
      entityType: 'Product',
      entityId: p.id,
      newValue: p,
    });
    return p;
  }

  async importMany(items: CreateProductDto[], actorId: string) {
    const results: Record<string, string>[] = [];
    for (const dto of items) {
      const exists = await this.prisma.product.findUnique({
        where: { code: dto.code },
      });
      if (exists) {
        results.push({ code: dto.code, status: 'skipped' });
        continue;
      }
      const p = await this.prisma.product.create({ data: dto });
      await this.audit.log({
        userId: actorId,
        action: 'PRODUCT_IMPORTED',
        entityType: 'Product',
        entityId: p.id,
        newValue: p,
      });
      results.push({ code: dto.code, status: 'created', id: p.id });
    }
    return results;
  }

  async findAll(query: QueryProductDto) {
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
      this.prisma.product.findMany({
        where,
        ...paginate(page, limit),
        orderBy: { code: 'asc' },
      }),
      this.prisma.product.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async findOne(id: string) {
    const p = await this.prisma.product.findUnique({ where: { id } });
    if (!p) throw new NotFoundException('Product not found');
    return p;
  }

  async update(id: string, dto: UpdateProductDto, actorId: string) {
    const old = await this.findOne(id);
    const updated = await this.prisma.product.update({
      where: { id },
      data: dto,
    });
    await this.audit.log({
      userId: actorId,
      action: 'PRODUCT_UPDATED',
      entityType: 'Product',
      entityId: id,
      oldValue: old,
      newValue: updated,
    });
    return updated;
  }
}
