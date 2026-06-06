import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class CreateProductDto {
  @ApiProperty({ example: 'SP-001' })
  @IsString()
  code: string;

  @ApiProperty({ example: 'Gạo ST25' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'KG' })
  @IsString()
  unit: string;
}

export class UpdateProductDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class QueryProductDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ImportProductsDto {
  @ApiProperty({ type: [CreateProductDto] })
  items: CreateProductDto[];
}
