import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCookieAuth } from '@nestjs/swagger';
import { WarehousesService } from './warehouses.service';
import {
  CreateWarehouseDto,
  UpdateWarehouseDto,
  QueryWarehouseDto,
  ImportWarehousesDto,
} from './dto/warehouse.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../common/enums/role.enum';

@ApiTags('Warehouses')
@ApiCookieAuth()
@Controller('warehouses')
export class WarehousesController {
  constructor(private svc: WarehousesService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách kho (tất cả role)' })
  findAll(@Query() query: QueryWarehouseDto) {
    return this.svc.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết kho' })
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Tạo kho (Admin)' })
  create(
    @Body() dto: CreateWarehouseDto,
    @CurrentUser() actor: { id: string },
  ) {
    return this.svc.create(dto, actor.id);
  }

  @Post('import')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Import nhiều kho (Admin)' })
  importMany(
    @Body() dto: ImportWarehousesDto,
    @CurrentUser() actor: { id: string },
  ) {
    return this.svc.importMany(dto.items, actor.id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Cập nhật kho (Admin)' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateWarehouseDto,
    @CurrentUser() actor: { id: string },
  ) {
    return this.svc.update(id, dto, actor.id);
  }
}
