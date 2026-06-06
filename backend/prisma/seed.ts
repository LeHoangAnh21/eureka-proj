import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const adminHash = await bcrypt.hash('Admin@123', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@eureka.local' },
    update: {},
    create: {
      email: 'admin@eureka.local',
      passwordHash: adminHash,
      name: 'System Admin',
      role: 'ADMIN',
    },
  });
  console.log('✅ Admin user:', admin.email);

  const demoHash = await bcrypt.hash('Demo@123', 12);
  const demoUsers = [
    { email: 'manager@eureka.local', name: 'Quản lý Kho', role: 'MANAGER' as const },
    { email: 'staff@eureka.local', name: 'Nhân viên Kinh doanh', role: 'STAFF' as const },
    {
      email: 'warehouse@eureka.local',
      name: 'Thủ kho',
      role: 'WAREHOUSE' as const,
    },
  ];
  for (const u of demoUsers) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        email: u.email,
        passwordHash: demoHash,
        name: u.name,
        role: u.role,
      },
    });
  }
  console.log('✅ Demo users seeded (manager, staff, warehouse)');

  // Seed VND currency
  await prisma.currency.upsert({
    where: { code: 'VND' },
    update: {},
    create: { code: 'VND', name: 'Vietnamese Dong' },
  });
  await prisma.currency.upsert({
    where: { code: 'USD' },
    update: {},
    create: { code: 'USD', name: 'US Dollar' },
  });
  console.log('✅ Currencies seeded');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
