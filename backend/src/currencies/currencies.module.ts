import { Module } from '@nestjs/common';
import { CurrenciesService } from './currencies.service';
import {
  CurrenciesController,
  ExchangeRatesController,
} from './currencies.controller';

@Module({
  providers: [CurrenciesService],
  controllers: [CurrenciesController, ExchangeRatesController],
})
export class CurrenciesModule {}
