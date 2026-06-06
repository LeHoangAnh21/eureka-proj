import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
  app.enableCors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
    credentials: true,
  });
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new AllExceptionsFilter());

  const config = new DocumentBuilder()
    .setTitle('Eureka — Thương mại & Xuất nhập khẩu')
    .setDescription(
      'API nội bộ cho hệ thống quản lý đơn nhập, đơn xuất, tồn kho và phân quyền.\n\n' +
        '**Cách dùng Swagger:** Login qua `POST /api/auth/login`, copy `token` từ response, click **Authorize** và paste vào Bearer token.',
    )
    .setVersion('1.0')
    .addCookieAuth('access_token')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'bearer',
    )
    .addTag('Auth', 'Đăng nhập / Đăng xuất')
    .addTag('Users', 'Quản lý người dùng (Admin)')
    .addTag('Warehouses', 'Quản lý kho hàng')
    .addTag('Partners', 'Quản lý đối tác (NCC / Khách hàng)')
    .addTag('Products', 'Quản lý sản phẩm (SKU)')
    .addTag('Currencies', 'Tiền tệ')
    .addTag('Exchange Rates', 'Tỷ giá ngoại tệ')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  await app.listen(process.env.PORT ?? 3001);
}
void bootstrap();
