import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  CreateCurrencyDto,
  CreateExchangeRateDto,
  QueryExchangeRateDto,
} from './dto/currency.dto';
import { paginate } from '../common/dto/pagination.dto';

@Injectable()
export class CurrenciesService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async createCurrency(dto: CreateCurrencyDto, actorId: string) {
    const exists = await this.prisma.currency.findUnique({
      where: { code: dto.code },
    });
    if (exists)
      throw new ConflictException(`Currency '${dto.code}' already exists`);
    const c = await this.prisma.currency.create({ data: dto });
    await this.audit.log({
      userId: actorId,
      action: 'CURRENCY_CREATED',
      entityType: 'Currency',
      entityId: c.id,
      newValue: c,
    });
    return c;
  }

  async findAllCurrencies() {
    return this.prisma.currency.findMany({ orderBy: { code: 'asc' } });
  }

  async findOneCurrency(id: string) {
    const c = await this.prisma.currency.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Currency not found');
    return c;
  }

  async createExchangeRate(dto: CreateExchangeRateDto, actorId: string) {
    await this.findOneCurrency(dto.currencyId);
    const rate = await this.prisma.exchangeRate.create({
      data: {
        currencyId: dto.currencyId,
        rate: new Prisma.Decimal(dto.rate),
        effectiveDate: new Date(dto.effectiveDate),
        createdBy: actorId,
      },
      include: { currency: true },
    });
    await this.audit.log({
      userId: actorId,
      action: 'EXCHANGE_RATE_CREATED',
      entityType: 'ExchangeRate',
      entityId: rate.id,
      newValue: rate,
    });
    return rate;
  }

  async findExchangeRates(query: QueryExchangeRateDto) {
    const { page, limit, currencyId } = query;
    const where = { ...(currencyId ? { currencyId } : {}) };
    const [data, total] = await Promise.all([
      this.prisma.exchangeRate.findMany({
        where,
        include: { currency: true },
        ...paginate(page, limit),
        orderBy: { effectiveDate: 'desc' },
      }),
      this.prisma.exchangeRate.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async findLatestRates() {
    const currencies = await this.prisma.currency.findMany();
    const result = await Promise.all(
      currencies.map(async (c) => {
        const rate = await this.prisma.exchangeRate.findFirst({
          where: { currencyId: c.id },
          orderBy: { effectiveDate: 'desc' },
        });
        return { currency: c, latestRate: rate };
      }),
    );
    return result;
  }
}
