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

export class CreatePOLineDto {
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

export class CreatePurchaseOrderDto {
  @ApiProperty()
  @IsUUID()
  supplierId: string;

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
  notes?: string;

  @ApiProperty({ type: [CreatePOLineDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePOLineDto)
  lines: CreatePOLineDto[];
}

export class GRNLineDto {
  @ApiProperty()
  @IsUUID()
  purchaseOrderLineId: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  receivedQty: number;
}

export class CreateGRNDto {
  @ApiProperty()
  @IsDateString()
  receiptDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ type: [GRNLineDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GRNLineDto)
  lines: GRNLineDto[];
}

export class ReverseDto {
  @ApiProperty()
  @IsString()
  reason: string;
}
