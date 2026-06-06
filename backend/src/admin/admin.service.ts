import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const DEMO_WAREHOUSES = [
  { code: 'WH-HN', name: 'Kho Hà Nội' },
  { code: 'WH-HCM', name: 'Kho Hồ Chí Minh' },
  { code: 'WH-DN', name: 'Kho Đà Nẵng' },
];

const DEMO_PARTNERS = [
  {
    code: 'NCC-001',
    name: 'Công ty TNHH Điện tử ABC',
    type: 'SUPPLIER' as const,
    taxCode: '0101234567',
  },
  {
    code: 'NCC-002',
    name: 'Công ty CP Phụ kiện XYZ',
    type: 'SUPPLIER' as const,
    taxCode: '0107654321',
  },
  { code: 'NCC-003', name: 'Nhà máy Thiết bị DEF', type: 'SUPPLIER' as const },
  {
    code: 'KH-001',
    name: 'Công ty CP Thương mại GHI',
    type: 'CUSTOMER' as const,
    taxCode: '0109988776',
  },
  { code: 'KH-002', name: 'Siêu thị Điện máy JKL', type: 'CUSTOMER' as const },
  { code: 'KH-003', name: 'Tập đoàn Bán lẻ MNO', type: 'CUSTOMER' as const },
  {
    code: 'DT-001',
    name: 'Tập đoàn Công nghệ PQR',
    type: 'BOTH' as const,
    taxCode: '0201122334',
  },
];

const DEMO_PRODUCTS = [
  { code: 'SP-001', name: 'Bàn phím cơ RGB', unit: 'cái' },
  { code: 'SP-002', name: 'Chuột gaming không dây', unit: 'cái' },
  { code: 'SP-003', name: 'Tai nghe Bluetooth ANC', unit: 'cái' },
  { code: 'SP-004', name: 'Màn hình 24 inch Full HD', unit: 'cái' },
  { code: 'SP-005', name: 'Cáp HDMI 2.0 2m', unit: 'sợi' },
  { code: 'SP-006', name: 'Ổ cứng SSD 500GB', unit: 'cái' },
  { code: 'SP-007', name: 'RAM DDR4 16GB', unit: 'thanh' },
  { code: 'SP-008', name: 'Card đồ họa RTX 3060', unit: 'cái' },
  { code: 'SP-009', name: 'Bộ nguồn 650W', unit: 'cái' },
  { code: 'SP-010', name: 'Vỏ case ATX', unit: 'cái' },
];

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async seedDemoData() {
    const results: Record<string, number> = {
      warehouses: 0,
      partners: 0,
      products: 0,
      currencies: 0,
      exchangeRates: 0,
    };

    // Warehouses
    for (const w of DEMO_WAREHOUSES) {
      const existing = await this.prisma.warehouse.findUnique({
        where: { code: w.code },
      });
      if (!existing) {
        await this.prisma.warehouse.create({ data: w });
        results.warehouses++;
      }
    }

    // Partners
    for (const p of DEMO_PARTNERS) {
      const existing = await this.prisma.partner.findUnique({
        where: { code: p.code },
      });
      if (!existing) {
        await this.prisma.partner.create({ data: p });
        results.partners++;
      }
    }

    // Products
    for (const p of DEMO_PRODUCTS) {
      const existing = await this.prisma.product.findUnique({
        where: { code: p.code },
      });
      if (!existing) {
        await this.prisma.product.create({ data: p });
        results.products++;
      }
    }

    // Currencies: USD, EUR, CNY
    const demoCurrencies = [
      { code: 'USD', name: 'Đô la Mỹ', rate: 25400 },
      { code: 'EUR', name: 'Euro', rate: 27500 },
      { code: 'CNY', name: 'Nhân dân tệ', rate: 3500 },
    ];

    const admin = await this.prisma.user.findFirst({
      where: { role: 'ADMIN' },
    });
    const adminId = admin!.id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const c of demoCurrencies) {
      let currency = await this.prisma.currency.findUnique({
        where: { code: c.code },
      });
      if (!currency) {
        currency = await this.prisma.currency.create({
          data: { code: c.code, name: c.name },
        });
        results.currencies++;
      }
      const existingRate = await this.prisma.exchangeRate.findFirst({
        where: { currencyId: currency.id, effectiveDate: today },
      });
      if (!existingRate) {
        await this.prisma.exchangeRate.create({
          data: {
            currencyId: currency.id,
            rate: c.rate,
            effectiveDate: today,
            createdBy: adminId,
          },
        });
        results.exchangeRates++;
      }
    }

    return results;
  }
}
