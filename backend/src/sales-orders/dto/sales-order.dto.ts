import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

export class CreateSOLineDto {
  @ApiProperty()
  @IsUUID()
  productId: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  orderedQty: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  unitPrice: number;
}

export class CreateSalesOrderDto {
  @ApiProperty()
  @IsUUID()
  customerId: string;

  @ApiProperty()
  @IsUUID()
  warehouseId: string;

  @ApiProperty()
  @IsUUID()
  currencyId: string;

  @ApiProperty()
  @IsDateString()
  orderDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expectedDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contractNo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ type: [CreateSOLineDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSOLineDto)
  lines: CreateSOLineDto[];
}

export class DOLineDto {
  @ApiProperty()
  @IsUUID()
  salesOrderLineId: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  shippedQty: number;
}

export class CreateDODto {
  @ApiProperty()
  @IsDateString()
  deliveryDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ type: [DOLineDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DOLineDto)
  lines: DOLineDto[];
}

export class ReverseDto {
  @ApiProperty()
  @IsString()
  reason: string;
}
