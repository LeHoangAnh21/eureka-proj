import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const hash = await bcrypt.hash('Admin@123', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@eureka.local' },
    update: {},
    create: {
      email: 'admin@eureka.local',
      passwordHash: hash,
      name: 'System Admin',
      role: 'ADMIN',
    },
  });
  console.log('✅ Admin user:', admin.email);

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
