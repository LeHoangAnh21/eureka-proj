import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, Matches } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class CreateWarehouseDto {
  @ApiProperty({ example: 'WH-01' })
  @IsString()
  @Matches(/^[A-Z0-9_-]+$/, { message: 'code must be uppercase alphanumeric' })
  code: string;

  @ApiProperty({ example: 'Kho Hà Nội' })
  @IsString()
  name: string;
}

export class UpdateWarehouseDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class QueryWarehouseDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ImportWarehousesDto {
  @ApiProperty({ type: [CreateWarehouseDto] })
  items: CreateWarehouseDto[];
}
