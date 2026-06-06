import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { SalesOrdersService } from './sales-orders.service';
import {
  CreateSalesOrderDto,
  CreateDODto,
  ReverseDto,
} from './dto/sales-order.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../common/enums/role.enum';

@ApiTags('Sales Orders')
@ApiBearerAuth('bearer')
@Controller('sales-orders')
export class SalesOrdersController {
  constructor(private svc: SalesOrdersService) {}

  @Get()
  @ApiOperation({ summary: 'List sales orders' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'customerId', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findAll(
    @Query('status') status?: string,
    @Query('customerId') customerId?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.svc.findAll({ status, customerId, page, limit });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get sales order detail' })
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({ summary: 'Create sales order' })
  create(
    @Body() dto: CreateSalesOrderDto,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.svc.create(dto, user.id);
  }

  @Post(':id/submit')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({ summary: 'Submit sales order for approval' })
  submit(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.svc.submit(id, user.id);
  }

  @Post(':id/approve')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Approve sales order' })
  approve(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.svc.approve(id, user.id);
  }

  @Post(':id/cancel')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Cancel sales order' })
  cancel(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.svc.cancel(id, user.id);
  }

  @Post(':id/delivery-orders')
  @Roles(UserRole.ADMIN, UserRole.WAREHOUSE)
  @ApiOperation({ summary: 'Create delivery order (DO) for SO' })
  createDO(
    @Param('id') soId: string,
    @Body() dto: CreateDODto,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.svc.createDO(soId, dto, user.id);
  }

  @Post('delivery-orders/:doId/confirm')
  @Roles(UserRole.ADMIN, UserRole.WAREHOUSE)
  @ApiOperation({ summary: 'Confirm DO and create inventory movements' })
  confirmDO(
    @Param('doId') doId: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.svc.confirmDO(doId, user.id);
  }

  @Post('delivery-orders/:doId/reverse')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Reverse a confirmed DO' })
  reverseDO(
    @Param('doId') doId: string,
    @Body() dto: ReverseDto,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.svc.reverseDO(doId, dto, user.id);
  }
}
