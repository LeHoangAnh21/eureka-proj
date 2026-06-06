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
  CreatePurchaseOrderDto,
  CreateGRNDto,
  ReverseDto,
} from './dto/purchase-order.dto';
import { paginate } from '../common/dto/pagination.dto';

interface POQuery {
  status?: string;
  supplierId?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class PurchaseOrdersService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async findAll(query: POQuery) {
    const { status, supplierId, page = 1, limit = 20 } = query;
    const where: Prisma.PurchaseOrderWhereInput = {
      ...(status ? { status: status as OrderStatus } : {}),
      ...(supplierId ? { supplierId } : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.purchaseOrder.findMany({
        where,
        include: {
          supplier: true,
          warehouse: true,
          currency: true,
          creator: { select: { id: true, name: true, email: true } },
        },
        ...paginate(page, limit),
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.purchaseOrder.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async findOne(id: string) {
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        supplier: true,
        warehouse: true,
        currency: true,
        creator: { select: { id: true, name: true, email: true } },
        approver: { select: { id: true, name: true, email: true } },
        lines: {
          include: { product: true },
        },
        goodsReceipts: {
          include: { lines: true },
        },
      },
    });
    if (!po) throw new NotFoundException('Purchase order not found');
    return po;
  }

  async create(dto: CreatePurchaseOrderDto, userId: string) {
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

    const po = await this.prisma.$transaction(async (tx) => {
      const seq = await tx.documentSequence.upsert({
        where: { prefix: 'PO' },
        update: { lastValue: { increment: 1 } },
        create: { prefix: 'PO', lastValue: 1 },
        select: { lastValue: true },
      });
      const code = `PO-${String(seq.lastValue).padStart(4, '0')}`;

      return tx.purchaseOrder.create({
        data: {
          code,
          supplierId: dto.supplierId,
          warehouseId: dto.warehouseId,
          currencyId: dto.currencyId,
          exchangeRate,
          status: OrderStatus.DRAFT,
          orderDate: new Date(dto.orderDate),
          expectedDate: dto.expectedDate ? new Date(dto.expectedDate) : null,
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
          supplier: true,
          warehouse: true,
          currency: true,
          lines: { include: { product: true } },
        },
      });
    });

    await this.audit.log({
      userId,
      action: 'CREATE_PO',
      entityType: 'PurchaseOrder',
      entityId: po.id,
      newValue: po,
    });
    return po;
  }

  async submit(id: string, userId: string) {
    const po = await this.findOne(id);
    if (po.status !== OrderStatus.DRAFT) {
      throw new BadRequestException(`Cannot submit PO in status ${po.status}`);
    }
    const updated = await this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: OrderStatus.PENDING_APPROVAL },
    });
    await this.audit.log({
      userId,
      action: 'SUBMIT_PO',
      entityType: 'PurchaseOrder',
      entityId: id,
      oldValue: { status: po.status },
      newValue: { status: updated.status },
    });
    return updated;
  }

  async approve(id: string, userId: string) {
    const po = await this.findOne(id);
    if (po.status !== OrderStatus.PENDING_APPROVAL) {
      throw new BadRequestException(`Cannot approve PO in status ${po.status}`);
    }
    if (po.createdBy === userId) {
      throw new BadRequestException(
        'Segregation of duties: creator cannot approve the same PO',
      );
    }
    const updated = await this.prisma.purchaseOrder.update({
      where: { id },
      data: {
        status: OrderStatus.APPROVED,
        approvedBy: userId,
        approvedAt: new Date(),
      },
    });
    await this.audit.log({
      userId,
      action: 'APPROVE_PO',
      entityType: 'PurchaseOrder',
      entityId: id,
      oldValue: { status: po.status },
      newValue: { status: updated.status },
    });
    return updated;
  }

  async cancel(id: string, userId: string) {
    const po = await this.findOne(id);
    if (
      po.status === OrderStatus.COMPLETED ||
      po.status === OrderStatus.CANCELLED
    ) {
      throw new BadRequestException(`Cannot cancel PO in status ${po.status}`);
    }
    const updated = await this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: OrderStatus.CANCELLED },
    });
    await this.audit.log({
      userId,
      action: 'CANCEL_PO',
      entityType: 'PurchaseOrder',
      entityId: id,
      oldValue: { status: po.status },
      newValue: { status: updated.status },
    });
    return updated;
  }

  async createGRN(poId: string, dto: CreateGRNDto, userId: string) {
    const po = await this.findOne(poId);
    if (
      po.status !== OrderStatus.APPROVED &&
      po.status !== OrderStatus.PARTIAL
    ) {
      throw new BadRequestException(
        `Cannot create GRN for PO in status ${po.status}`,
      );
    }

    const grn = await this.prisma.$transaction(async (tx) => {
      const seq = await tx.documentSequence.upsert({
        where: { prefix: 'GRN' },
        update: { lastValue: { increment: 1 } },
        create: { prefix: 'GRN', lastValue: 1 },
        select: { lastValue: true },
      });
      const code = `GRN-${String(seq.lastValue).padStart(4, '0')}`;

      for (const line of dto.lines) {
        const poLine = po.lines.find((l) => l.id === line.purchaseOrderLineId);
        if (!poLine) {
          throw new NotFoundException(
            `PO line ${line.purchaseOrderLineId} not found`,
          );
        }
        const remaining = new Prisma.Decimal(poLine.orderedQty).sub(
          new Prisma.Decimal(poLine.receivedQty),
        );
        if (new Prisma.Decimal(line.receivedQty).greaterThan(remaining)) {
          throw new BadRequestException(
            `Received qty ${line.receivedQty} exceeds remaining qty ${remaining.toString()} for line ${line.purchaseOrderLineId}`,
          );
        }
      }

      return tx.goodsReceipt.create({
        data: {
          code,
          purchaseOrderId: poId,
          warehouseId: po.warehouseId,
          receiptDate: new Date(dto.receiptDate),
          status: ReceiptStatus.DRAFT,
          notes: dto.notes,
          createdBy: userId,
          lines: {
            create: dto.lines.map((l) => {
              const poLine = po.lines.find(
                (pl) => pl.id === l.purchaseOrderLineId,
              )!;
              return {
                purchaseOrderLineId: l.purchaseOrderLineId,
                productId: poLine.productId,
                receivedQty: new Prisma.Decimal(l.receivedQty),
              };
            }),
          },
        },
        include: { lines: true },
      });
    });

    await this.audit.log({
      userId,
      action: 'CREATE_GRN',
      entityType: 'GoodsReceipt',
      entityId: grn.id,
      newValue: grn,
    });
    return grn;
  }

  async confirmGRN(grnId: string, userId: string) {
    const grn = await this.prisma.goodsReceipt.findUnique({
      where: { id: grnId },
      include: {
        lines: { include: { purchaseOrderLine: true } },
        purchaseOrder: { include: { lines: true } },
      },
    });
    if (!grn) throw new NotFoundException('GRN not found');
    if (grn.status !== ReceiptStatus.DRAFT) {
      throw new BadRequestException(
        `Cannot confirm GRN in status ${grn.status}`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.goodsReceipt.update({
        where: { id: grnId },
        data: {
          status: ReceiptStatus.CONFIRMED,
          confirmedBy: userId,
          confirmedAt: new Date(),
        },
      });

      for (const line of grn.lines) {
        const idempotencyKey = `GRN-${grnId}-LINE-${line.id}`;
        const existing = await tx.inventoryMovement.findUnique({
          where: { idempotencyKey },
        });
        if (!existing) {
          await tx.inventoryMovement.create({
            data: {
              movementType: MovementType.RECEIPT,
              productId: line.productId,
              warehouseId: grn.warehouseId,
              qty: line.receivedQty,
              movementDate: grn.receiptDate,
              sourceType: MovementSourceType.GOODS_RECEIPT,
              sourceId: grnId,
              sourceLineId: line.id,
              referenceCode: grn.code,
              idempotencyKey,
              createdBy: userId,
            },
          });
        }

        await tx.purchaseOrderLine.update({
          where: { id: line.purchaseOrderLineId },
          data: {
            receivedQty: {
              increment: line.receivedQty,
            },
          },
        });
      }

      const poLines = await tx.purchaseOrderLine.findMany({
        where: { purchaseOrderId: grn.purchaseOrderId },
      });
      const allCompleted = poLines.every((l) =>
        new Prisma.Decimal(l.receivedQty).greaterThanOrEqualTo(
          new Prisma.Decimal(l.orderedQty),
        ),
      );
      const anyReceived = poLines.some((l) =>
        new Prisma.Decimal(l.receivedQty).greaterThan(0),
      );
      const newStatus = allCompleted
        ? OrderStatus.COMPLETED
        : anyReceived
          ? OrderStatus.PARTIAL
          : OrderStatus.APPROVED;

      await tx.purchaseOrder.update({
        where: { id: grn.purchaseOrderId },
        data: { status: newStatus },
      });
    });

    await this.audit.log({
      userId,
      action: 'CONFIRM_GRN',
      entityType: 'GoodsReceipt',
      entityId: grnId,
      oldValue: { status: grn.status },
      newValue: { status: ReceiptStatus.CONFIRMED },
    });
    return this.prisma.goodsReceipt.findUnique({
      where: { id: grnId },
      include: { lines: true },
    });
  }

  async reverseGRN(grnId: string, dto: ReverseDto, userId: string) {
    const grn = await this.prisma.goodsReceipt.findUnique({
      where: { id: grnId },
      include: {
        lines: { include: { purchaseOrderLine: true } },
        purchaseOrder: { include: { lines: true } },
      },
    });
    if (!grn) throw new NotFoundException('GRN not found');
    if (grn.status !== ReceiptStatus.CONFIRMED) {
      throw new BadRequestException(
        `Cannot reverse GRN in status ${grn.status}`,
      );
    }

    const reversalGRN = await this.prisma.$transaction(async (tx) => {
      const seq = await tx.documentSequence.upsert({
        where: { prefix: 'GRN' },
        update: { lastValue: { increment: 1 } },
        create: { prefix: 'GRN', lastValue: 1 },
        select: { lastValue: true },
      });
      const code = `GRN-${String(seq.lastValue).padStart(4, '0')}`;

      const reversal = await tx.goodsReceipt.create({
        data: {
          code,
          purchaseOrderId: grn.purchaseOrderId,
          warehouseId: grn.warehouseId,
          receiptDate: new Date(),
          status: ReceiptStatus.REVERSED,
          reversalOf: grnId,
          reversalReason: dto.reason,
          createdBy: userId,
          confirmedBy: userId,
          confirmedAt: new Date(),
          lines: {
            create: grn.lines.map((l) => ({
              purchaseOrderLineId: l.purchaseOrderLineId,
              productId: l.productId,
              receivedQty: l.receivedQty,
            })),
          },
        },
        include: { lines: true },
      });

      for (const line of reversal.lines) {
        const origLine = grn.lines.find(
          (l) => l.purchaseOrderLineId === line.purchaseOrderLineId,
        )!;
        const idempotencyKey = `GRN-REVERSAL-${grnId}-LINE-${origLine.id}`;
        const existing = await tx.inventoryMovement.findUnique({
          where: { idempotencyKey },
        });
        if (!existing) {
          await tx.inventoryMovement.create({
            data: {
              movementType: MovementType.REVERSAL_RECEIPT,
              productId: line.productId,
              warehouseId: grn.warehouseId,
              qty: line.receivedQty,
              movementDate: new Date(),
              sourceType: MovementSourceType.GOODS_RECEIPT,
              sourceId: reversal.id,
              sourceLineId: line.id,
              referenceCode: reversal.code,
              idempotencyKey,
              createdBy: userId,
            },
          });
        }

        await tx.purchaseOrderLine.update({
          where: { id: line.purchaseOrderLineId },
          data: {
            receivedQty: {
              decrement: line.receivedQty,
            },
          },
        });
      }

      const poLines = await tx.purchaseOrderLine.findMany({
        where: { purchaseOrderId: grn.purchaseOrderId },
      });
      const anyReceived = poLines.some((l) =>
        new Prisma.Decimal(l.receivedQty).greaterThan(0),
      );
      const newStatus = anyReceived
        ? OrderStatus.PARTIAL
        : OrderStatus.APPROVED;

      await tx.purchaseOrder.update({
        where: { id: grn.purchaseOrderId },
        data: { status: newStatus },
      });

      return reversal;
    });

    await this.audit.log({
      userId,
      action: 'REVERSE_GRN',
      entityType: 'GoodsReceipt',
      entityId: grnId,
      oldValue: { status: grn.status },
      newValue: { reversalId: reversalGRN.id, reason: dto.reason },
    });
    return reversalGRN;
  }
}
