import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  Prisma,
  OrderStatus,
  ReceiptStatus,
  MovementType,
  MovementSourceType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  CreateSalesOrderDto,
  CreateDODto,
  ReverseDto,
} from './dto/sales-order.dto';
import { paginate } from '../common/dto/pagination.dto';

interface SOQuery {
  status?: string;
  customerId?: string;
  page?: number;
  limit?: number;
}

interface InventoryBalanceRow {
  productId: string;
  balance: number;
}

@Injectable()
export class SalesOrdersService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async findAll(query: SOQuery) {
    const { status, customerId, page = 1, limit = 20 } = query;
    const where: Prisma.SalesOrderWhereInput = {
      ...(status ? { status: status as OrderStatus } : {}),
      ...(customerId ? { customerId } : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.salesOrder.findMany({
        where,
        include: {
          customer: true,
          warehouse: true,
          currency: true,
          creator: { select: { id: true, name: true, email: true } },
        },
        ...paginate(page, limit),
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.salesOrder.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async findOne(id: string) {
    const so = await this.prisma.salesOrder.findUnique({
      where: { id },
      include: {
        customer: true,
        warehouse: true,
        currency: true,
        creator: { select: { id: true, name: true, email: true } },
        approver: { select: { id: true, name: true, email: true } },
        lines: {
          include: { product: true },
        },
        deliveryOrders: {
          include: { lines: true },
        },
      },
    });
    if (!so) throw new NotFoundException('Sales order not found');
    return so;
  }

  async create(dto: CreateSalesOrderDto, userId: string) {
    const currency = await this.prisma.currency.findUnique({
      where: { id: dto.currencyId },
    });
    if (!currency) throw new NotFoundException('Currency not found');

    let exchangeRate: Prisma.Decimal;
    if (currency.code === 'VND') {
      exchangeRate = new Prisma.Decimal(1);
    } else {
      const latestRate = await this.prisma.exchangeRate.findFirst({
        where: { currencyId: dto.currencyId },
        orderBy: { effectiveDate: 'desc' },
      });
      if (!latestRate)
        throw new BadRequestException(
          `No exchange rate found for currency ${currency.code}`,
        );
      exchangeRate = latestRate.rate;
    }

    const so = await this.prisma.$transaction(async (tx) => {
      const seq = await tx.documentSequence.upsert({
        where: { prefix: 'SO' },
        update: { lastValue: { increment: 1 } },
        create: { prefix: 'SO', lastValue: 1 },
        select: { lastValue: true },
      });
      const code = `SO-${String(seq.lastValue).padStart(4, '0')}`;

      return tx.salesOrder.create({
        data: {
          code,
          customerId: dto.customerId,
          warehouseId: dto.warehouseId,
          currencyId: dto.currencyId,
          exchangeRate,
          status: OrderStatus.DRAFT,
          orderDate: new Date(dto.orderDate),
          expectedDate: dto.expectedDate ? new Date(dto.expectedDate) : null,
          contractNo: dto.contractNo,
          notes: dto.notes,
          createdBy: userId,
          lines: {
            create: dto.lines.map((l) => {
              const orderedQty = new Prisma.Decimal(l.orderedQty);
              const unitPrice = new Prisma.Decimal(l.unitPrice);
              const lineTotal = orderedQty.mul(unitPrice);
              const unitPriceVnd = unitPrice.mul(exchangeRate);
              const lineTotalVnd = lineTotal.mul(exchangeRate);
              return {
                productId: l.productId,
                orderedQty,
                unitPrice,
                unitPriceVnd,
                lineTotal,
                lineTotalVnd,
              };
            }),
          },
        },
        include: {
          customer: true,
          warehouse: true,
          currency: true,
          lines: { include: { product: true } },
        },
      });
    });

    await this.audit.log({
      userId,
      action: 'CREATE_SO',
      entityType: 'SalesOrder',
      entityId: so.id,
      newValue: so,
    });
    return so;
  }

  async submit(id: string, userId: string) {
    const so = await this.findOne(id);
    if (so.status !== OrderStatus.DRAFT) {
      throw new BadRequestException(`Cannot submit SO in status ${so.status}`);
    }
    const updated = await this.prisma.salesOrder.update({
      where: { id },
      data: { status: OrderStatus.PENDING_APPROVAL },
    });
    await this.audit.log({
      userId,
      action: 'SUBMIT_SO',
      entityType: 'SalesOrder',
      entityId: id,
      oldValue: { status: so.status },
      newValue: { status: updated.status },
    });
    return updated;
  }

  async approve(id: string, userId: string) {
    const so = await this.findOne(id);
    if (so.status !== OrderStatus.PENDING_APPROVAL) {
      throw new BadRequestException(`Cannot approve SO in status ${so.status}`);
    }
    if (so.createdBy === userId) {
      throw new BadRequestException(
        'Segregation of duties: creator cannot approve the same SO',
      );
    }
    const updated = await this.prisma.salesOrder.update({
      where: { id },
      data: {
        status: OrderStatus.APPROVED,
        approvedBy: userId,
        approvedAt: new Date(),
      },
    });
    await this.audit.log({
      userId,
      action: 'APPROVE_SO',
      entityType: 'SalesOrder',
      entityId: id,
      oldValue: { status: so.status },
      newValue: { status: updated.status },
    });
    return updated;
  }

  async cancel(id: string, userId: string) {
    const so = await this.findOne(id);
    if (
      so.status === OrderStatus.COMPLETED ||
      so.status === OrderStatus.CANCELLED
    ) {
      throw new BadRequestException(`Cannot cancel SO in status ${so.status}`);
    }
    const updated = await this.prisma.salesOrder.update({
      where: { id },
      data: { status: OrderStatus.CANCELLED },
    });
    await this.audit.log({
      userId,
      action: 'CANCEL_SO',
      entityType: 'SalesOrder',
      entityId: id,
      oldValue: { status: so.status },
      newValue: { status: updated.status },
    });
    return updated;
  }

  async createDO(soId: string, dto: CreateDODto, userId: string) {
    const so = await this.findOne(soId);
    if (
      so.status !== OrderStatus.APPROVED &&
      so.status !== OrderStatus.PARTIAL
    ) {
      throw new BadRequestException(
        `Cannot create DO for SO in status ${so.status}`,
      );
    }

    const doOrder = await this.prisma.$transaction(async (tx) => {
      const seq = await tx.documentSequence.upsert({
        where: { prefix: 'DO' },
        update: { lastValue: { increment: 1 } },
        create: { prefix: 'DO', lastValue: 1 },
        select: { lastValue: true },
      });
      const code = `DO-${String(seq.lastValue).padStart(4, '0')}`;

      for (const line of dto.lines) {
        const soLine = so.lines.find((l) => l.id === line.salesOrderLineId);
        if (!soLine) {
          throw new NotFoundException(
            `SO line ${line.salesOrderLineId} not found`,
          );
        }
        const remaining = new Prisma.Decimal(soLine.orderedQty).sub(
          new Prisma.Decimal(soLine.shippedQty),
        );
        if (new Prisma.Decimal(line.shippedQty).greaterThan(remaining)) {
          throw new BadRequestException(
            `Shipped qty ${line.shippedQty} exceeds remaining qty ${remaining.toString()} for line ${line.salesOrderLineId}`,
          );
        }
      }

      return tx.deliveryOrder.create({
        data: {
          code,
          salesOrderId: soId,
          warehouseId: so.warehouseId,
          deliveryDate: new Date(dto.deliveryDate),
          status: ReceiptStatus.DRAFT,
          notes: dto.notes,
          createdBy: userId,
          lines: {
            create: dto.lines.map((l) => {
              const soLine = so.lines.find(
                (sl) => sl.id === l.salesOrderLineId,
              )!;
              return {
                salesOrderLineId: l.salesOrderLineId,
                productId: soLine.productId,
                shippedQty: new Prisma.Decimal(l.shippedQty),
              };
            }),
          },
        },
        include: { lines: true },
      });
    });

    await this.audit.log({
      userId,
      action: 'CREATE_DO',
      entityType: 'DeliveryOrder',
      entityId: doOrder.id,
      newValue: doOrder,
    });
    return doOrder;
  }

  async confirmDO(doId: string, userId: string) {
    const doOrder = await this.prisma.deliveryOrder.findUnique({
      where: { id: doId },
      include: {
        lines: { include: { salesOrderLine: true } },
        salesOrder: { include: { lines: true } },
      },
    });
    if (!doOrder) throw new NotFoundException('Delivery order not found');
    if (doOrder.status !== ReceiptStatus.DRAFT) {
      throw new BadRequestException(
        `Cannot confirm DO in status ${doOrder.status}`,
      );
    }

    const productIds = doOrder.lines.map((l) => l.productId);
    const warehouseId = doOrder.warehouseId;

    const balances = await this.prisma.$queryRaw<InventoryBalanceRow[]>`
      SELECT product_id as "productId",
        SUM(CASE WHEN movement_type = 'RECEIPT' THEN qty
                 WHEN movement_type = 'ISSUE' THEN -qty
                 WHEN movement_type = 'REVERSAL_RECEIPT' THEN -qty
                 WHEN movement_type = 'REVERSAL_ISSUE' THEN qty
            END) as balance
      FROM inventory_movements
      WHERE warehouse_id = ${warehouseId}::uuid
        AND product_id = ANY(${productIds}::uuid[])
      GROUP BY product_id
    `;

    const balanceMap = new Map<string, number>(
      balances.map((b) => [b.productId, Number(b.balance)]),
    );

    const insufficient: string[] = [];
    for (const line of doOrder.lines) {
      const available = balanceMap.get(line.productId) ?? 0;
      if (new Prisma.Decimal(line.shippedQty).greaterThan(available)) {
        insufficient.push(
          `Product ${line.productId}: available ${available}, requested ${line.shippedQty.toString()}`,
        );
      }
    }
    if (insufficient.length > 0) {
      throw new BadRequestException(
        `Insufficient inventory: ${insufficient.join('; ')}`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.deliveryOrder.update({
        where: { id: doId },
        data: {
          status: ReceiptStatus.CONFIRMED,
          confirmedBy: userId,
          confirmedAt: new Date(),
        },
      });

      for (const line of doOrder.lines) {
        const idempotencyKey = `DO-${doId}-LINE-${line.id}`;
        const existing = await tx.inventoryMovement.findUnique({
          where: { idempotencyKey },
        });
        if (!existing) {
          await tx.inventoryMovement.create({
            data: {
              movementType: MovementType.ISSUE,
              productId: line.productId,
              warehouseId: doOrder.warehouseId,
              qty: line.shippedQty,
              movementDate: doOrder.deliveryDate,
              sourceType: MovementSourceType.DELIVERY_ORDER,
              sourceId: doId,
              sourceLineId: line.id,
              referenceCode: doOrder.code,
              idempotencyKey,
              createdBy: userId,
            },
          });
        }

        await tx.salesOrderLine.update({
          where: { id: line.salesOrderLineId },
          data: {
            shippedQty: {
              increment: line.shippedQty,
            },
          },
        });
      }

      const soLines = await tx.salesOrderLine.findMany({
        where: { salesOrderId: doOrder.salesOrderId },
      });
      const allCompleted = soLines.every((l) =>
        new Prisma.Decimal(l.shippedQty).greaterThanOrEqualTo(
          new Prisma.Decimal(l.orderedQty),
        ),
      );
      const anyShipped = soLines.some((l) =>
        new Prisma.Decimal(l.shippedQty).greaterThan(0),
      );
      const newStatus = allCompleted
        ? OrderStatus.COMPLETED
        : anyShipped
          ? OrderStatus.PARTIAL
          : OrderStatus.APPROVED;

      await tx.salesOrder.update({
        where: { id: doOrder.salesOrderId },
        data: { status: newStatus },
      });
    });

    await this.audit.log({
      userId,
      action: 'CONFIRM_DO',
      entityType: 'DeliveryOrder',
      entityId: doId,
      oldValue: { status: doOrder.status },
      newValue: { status: ReceiptStatus.CONFIRMED },
    });
    return this.prisma.deliveryOrder.findUnique({
      where: { id: doId },
      include: { lines: true },
    });
  }

  async reverseDO(doId: string, dto: ReverseDto, userId: string) {
    const doOrder = await this.prisma.deliveryOrder.findUnique({
      where: { id: doId },
      include: {
        lines: { include: { salesOrderLine: true } },
        salesOrder: { include: { lines: true } },
      },
    });
    if (!doOrder) throw new NotFoundException('Delivery order not found');
    if (doOrder.status !== ReceiptStatus.CONFIRMED) {
      throw new BadRequestException(
        `Cannot reverse DO in status ${doOrder.status}`,
      );
    }

    const reversalDO = await this.prisma.$transaction(async (tx) => {
      const seq = await tx.documentSequence.upsert({
        where: { prefix: 'DO' },
        update: { lastValue: { increment: 1 } },
        create: { prefix: 'DO', lastValue: 1 },
        select: { lastValue: true },
      });
      const code = `DO-${String(seq.lastValue).padStart(4, '0')}`;

      const reversal = await tx.deliveryOrder.create({
        data: {
          code,
          salesOrderId: doOrder.salesOrderId,
          warehouseId: doOrder.warehouseId,
          deliveryDate: new Date(),
          status: ReceiptStatus.REVERSED,
          reversalOf: doId,
          reversalReason: dto.reason,
          createdBy: userId,
          confirmedBy: userId,
          confirmedAt: new Date(),
          lines: {
            create: doOrder.lines.map((l) => ({
              salesOrderLineId: l.salesOrderLineId,
              productId: l.productId,
              shippedQty: l.shippedQty,
            })),
          },
        },
        include: { lines: true },
      });

      for (const line of reversal.lines) {
        const origLine = doOrder.lines.find(
          (l) => l.salesOrderLineId === line.salesOrderLineId,
        )!;
        const idempotencyKey = `DO-REVERSAL-${doId}-LINE-${origLine.id}`;
        const existing = await tx.inventoryMovement.findUnique({
          where: { idempotencyKey },
        });
        if (!existing) {
          await tx.inventoryMovement.create({
            data: {
              movementType: MovementType.REVERSAL_ISSUE,
              productId: line.productId,
              warehouseId: doOrder.warehouseId,
              qty: line.shippedQty,
              movementDate: new Date(),
              sourceType: MovementSourceType.DELIVERY_ORDER,
              sourceId: reversal.id,
              sourceLineId: line.id,
              referenceCode: reversal.code,
              idempotencyKey,
              createdBy: userId,
            },
          });
        }

        await tx.salesOrderLine.update({
          where: { id: line.salesOrderLineId },
          data: {
            shippedQty: {
              decrement: line.shippedQty,
            },
          },
        });
      }

      const soLines = await tx.salesOrderLine.findMany({
        where: { salesOrderId: doOrder.salesOrderId },
      });
      const anyShipped = soLines.some((l) =>
        new Prisma.Decimal(l.shippedQty).greaterThan(0),
      );
      const newStatus = anyShipped ? OrderStatus.PARTIAL : OrderStatus.APPROVED;

      await tx.salesOrder.update({
        where: { id: doOrder.salesOrderId },
        data: { status: newStatus },
      });

      return reversal;
    });

    await this.audit.log({
      userId,
      action: 'REVERSE_DO',
      entityType: 'DeliveryOrder',
      entityId: doId,
      oldValue: { status: doOrder.status },
      newValue: { reversalId: reversalDO.id, reason: dto.reason },
    });
    return reversalDO;
  }
}
