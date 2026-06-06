import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { WarehousesModule } from './warehouses/warehouses.module';
import { PartnersModule } from './partners/partners.module';
import { ProductsModule } from './products/products.module';
import { CurrenciesModule } from './currencies/currencies.module';
import { AdminModule } from './admin/admin.module';
import { PurchaseOrdersModule } from './purchase-orders/purchase-orders.module';
import { SalesOrdersModule } from './sales-orders/sales-orders.module';
import { InventoryModule } from './inventory/inventory.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuditModule,
    AuthModule,
    UsersModule,
    WarehousesModule,
    PartnersModule,
    ProductsModule,
    CurrenciesModule,
    PurchaseOrdersModule,
    SalesOrdersModule,
    InventoryModule,
    AdminModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
