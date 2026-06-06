import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { paginate } from '../common/dto/pagination.dto';
import { Prisma } from '@prisma/client';

interface StockQuery {
  warehouseId?: string;
  productId?: string;
}

interface MovementsQuery {
  warehouseId?: string;
  productId?: string;
  page?: number;
  limit?: number;
}

interface CurrentStockRow {
  productId: string;
  warehouseId: string;
  productCode: string;
  productName: string;
  productUnit: string;
  warehouseCode: string;
  warehouseName: string;
  balance: string;
}

@Injectable()
export class InventoryService {
  constructor(private prisma: PrismaService) {}

  async getCurrentStock(query: StockQuery) {
    const { warehouseId, productId } = query;

    const warehouseFilter = warehouseId
      ? Prisma.sql`AND im.warehouse_id = ${warehouseId}::uuid`
      : Prisma.empty;
    const productFilter = productId
      ? Prisma.sql`AND im.product_id = ${productId}::uuid`
      : Prisma.empty;

    const balanceExpr = Prisma.sql`
      SUM(CASE
        WHEN im.movement_type = 'RECEIPT' THEN im.qty
        WHEN im.movement_type = 'ISSUE' THEN -im.qty
        WHEN im.movement_type = 'REVERSAL_RECEIPT' THEN -im.qty
        WHEN im.movement_type = 'REVERSAL_ISSUE' THEN im.qty
        ELSE 0
      END)
    `;

    const rows = await this.prisma.$queryRaw<CurrentStockRow[]>`
      SELECT
        im.product_id   AS "productId",
        im.warehouse_id AS "warehouseId",
        p.code          AS "productCode",
        p.name          AS "productName",
        p.unit          AS "productUnit",
        w.code          AS "warehouseCode",
        w.name          AS "warehouseName",
        ${balanceExpr}  AS balance
      FROM inventory_movements im
      JOIN products  p ON p.id = im.product_id
      JOIN warehouses w ON w.id = im.warehouse_id
      WHERE 1=1
        ${warehouseFilter}
        ${productFilter}
      GROUP BY im.product_id, im.warehouse_id, p.code, p.name, p.unit, w.code, w.name
      HAVING ${balanceExpr} > 0
      ORDER BY w.name, p.name
    `;

    return rows.map((r) => ({
      productId: r.productId,
      warehouseId: r.warehouseId,
      productCode: r.productCode,
      productName: r.productName,
      productUnit: r.productUnit,
      warehouseCode: r.warehouseCode,
      warehouseName: r.warehouseName,
      balance: Number(r.balance),
    }));
  }

  async getMovements(query: MovementsQuery) {
    const { warehouseId, productId, page = 1, limit = 20 } = query;
    const where: Prisma.InventoryMovementWhereInput = {
      ...(warehouseId ? { warehouseId } : {}),
      ...(productId ? { productId } : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.inventoryMovement.findMany({
        where,
        include: {
          product: true,
          warehouse: true,
          creator: { select: { id: true, name: true, email: true } },
        },
        ...paginate(page, limit),
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.inventoryMovement.count({ where }),
    ]);
    return { data, total, page, limit };
  }
}
