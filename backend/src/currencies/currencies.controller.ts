import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCookieAuth } from '@nestjs/swagger';
import { CurrenciesService } from './currencies.service';
import {
  CreateCurrencyDto,
  CreateExchangeRateDto,
  QueryExchangeRateDto,
} from './dto/currency.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../common/enums/role.enum';

@ApiTags('Currencies')
@ApiCookieAuth()
@Controller('currencies')
export class CurrenciesController {
  constructor(private svc: CurrenciesService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách tiền tệ (tất cả role)' })
  findAll() {
    return this.svc.findAllCurrencies();
  }

  @Get('rates/latest')
  @ApiOperation({ summary: 'Tỷ giá mới nhất mỗi currency' })
  latestRates() {
    return this.svc.findLatestRates();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết tiền tệ' })
  findOne(@Param('id') id: string) {
    return this.svc.findOneCurrency(id);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Tạo loại tiền tệ (Admin)' })
  createCurrency(
    @Body() dto: CreateCurrencyDto,
    @CurrentUser() actor: { id: string },
  ) {
    return this.svc.createCurrency(dto, actor.id);
  }
}

@ApiTags('Exchange Rates')
@ApiCookieAuth()
@Controller('exchange-rates')
export class ExchangeRatesController {
  constructor(private svc: CurrenciesService) {}

  @Get()
  @ApiOperation({ summary: 'Lịch sử tỷ giá (tất cả role)' })
  findAll(@Query() query: QueryExchangeRateDto) {
    return this.svc.findExchangeRates(query);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Thêm tỷ giá mới (Admin)' })
  create(
    @Body() dto: CreateExchangeRateDto,
    @CurrentUser() actor: { id: string },
  ) {
    return this.svc.createExchangeRate(dto, actor.id);
  }
}
