import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class CreateCurrencyDto {
  @ApiProperty({ example: 'USD' })
  @IsString()
  @Matches(/^[A-Z]{3}$/, {
    message: 'code must be 3 uppercase letters (ISO 4217)',
  })
  code: string;

  @ApiProperty({ example: 'US Dollar' })
  @IsString()
  name: string;
}

export class CreateExchangeRateDto {
  @ApiProperty({ example: 'clxxxxxxxx' })
  @IsString()
  currencyId: string;

  @ApiProperty({ example: 25400, description: '1 ngoại tệ = rate VND' })
  @Type(() => Number)
  @IsNumber()
  @Min(0.000001)
  rate: number;

  @ApiProperty({ example: '2026-06-06' })
  @IsDateString()
  effectiveDate: string;
}

export class QueryExchangeRateDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  currencyId?: string;
}
