import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export enum PartnerType {
  SUPPLIER = 'SUPPLIER',
  CUSTOMER = 'CUSTOMER',
  BOTH = 'BOTH',
}

export class CreatePartnerDto {
  @ApiProperty({ example: 'NCC-001' })
  @IsString()
  code: string;

  @ApiProperty({ example: 'Công ty TNHH ABC' })
  @IsString()
  name: string;

  @ApiProperty({ enum: PartnerType })
  @IsEnum(PartnerType)
  type: PartnerType;

  @ApiPropertyOptional({ example: '0123456789' })
  @IsOptional()
  @IsString()
  taxCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;
}

export class UpdatePartnerDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ enum: PartnerType })
  @IsOptional()
  @IsEnum(PartnerType)
  type?: PartnerType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  taxCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class QueryPartnerDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: PartnerType })
  @IsOptional()
  @IsEnum(PartnerType)
  type?: PartnerType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ImportPartnersDto {
  @ApiProperty({ type: [CreatePartnerDto] })
  items: CreatePartnerDto[];
}
