import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { QueryUserDto } from './dto/query-user.dto';
import { paginate } from '../common/dto/pagination.dto';

const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
};

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async create(dto: CreateUserDto, actorId: string) {
    const exists = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (exists) throw new ConflictException('Email already exists');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: { email: dto.email, name: dto.name, passwordHash, role: dto.role },
      select: USER_SELECT,
    });

    await this.audit.log({
      userId: actorId,
      action: 'USER_CREATED',
      entityType: 'User',
      entityId: user.id,
      newValue: user,
    });
    return user;
  }

  async importMany(users: CreateUserDto[], actorId: string) {
    const results: Record<string, string>[] = [];
    for (const dto of users) {
      const existing = await this.prisma.user.findUnique({
        where: { email: dto.email },
      });
      if (existing) {
        results.push({ email: dto.email, status: 'skipped', reason: 'exists' });
        continue;
      }
      const passwordHash = await bcrypt.hash(dto.password, 12);
      const user = await this.prisma.user.create({
        data: {
          email: dto.email,
          name: dto.name,
          passwordHash,
          role: dto.role,
        },
        select: USER_SELECT,
      });
      await this.audit.log({
        userId: actorId,
        action: 'USER_IMPORTED',
        entityType: 'User',
        entityId: user.id,
        newValue: user,
      });
      results.push({ email: dto.email, status: 'created', id: user.id });
    }
    return results;
  }

  async findAll(query: QueryUserDto) {
    const { page, limit, search, role, isActive } = query;
    const where = {
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { email: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
      ...(role ? { role } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: USER_SELECT,
        ...paginate(page, limit),
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: USER_SELECT,
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async update(id: string, dto: UpdateUserDto, actorId: string) {
    const user = await this.findOne(id);
    const data: Record<string, unknown> = {};
    if (dto.name) data.name = dto.name;
    if (dto.role) data.role = dto.role;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.password) data.passwordHash = await bcrypt.hash(dto.password, 12);

    const updated = await this.prisma.user.update({
      where: { id },
      data,
      select: USER_SELECT,
    });
    await this.audit.log({
      userId: actorId,
      action: 'USER_UPDATED',
      entityType: 'User',
      entityId: id,
      oldValue: user,
      newValue: updated,
    });
    return updated;
  }

  async deactivate(id: string, actorId: string) {
    await this.findOne(id);
    const updated = await this.prisma.user.update({
      where: { id },
      data: { isActive: false },
      select: USER_SELECT,
    });
    await this.audit.log({
      userId: actorId,
      action: 'USER_DEACTIVATED',
      entityType: 'User',
      entityId: id,
    });
    return updated;
  }

  async activate(id: string, actorId: string) {
    await this.findOne(id);
    const updated = await this.prisma.user.update({
      where: { id },
      data: { isActive: true },
      select: USER_SELECT,
    });
    await this.audit.log({
      userId: actorId,
      action: 'USER_ACTIVATED',
      entityType: 'User',
      entityId: id,
    });
    return updated;
  }
}
