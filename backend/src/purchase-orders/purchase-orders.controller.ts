import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { PurchaseOrdersService } from './purchase-orders.service';
import {
  CreatePurchaseOrderDto,
  CreateGRNDto,
  ReverseDto,
} from './dto/purchase-order.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../common/enums/role.enum';

@ApiTags('Purchase Orders')
@ApiBearerAuth('bearer')
@Controller('purchase-orders')
export class PurchaseOrdersController {
  constructor(private svc: PurchaseOrdersService) {}

  @Get()
  @ApiOperation({ summary: 'List purchase orders' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'supplierId', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findAll(
    @Query('status') status?: string,
    @Query('supplierId') supplierId?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.svc.findAll({ status, supplierId, page, limit });
  }

  @Get('goods-receipts/:grnId/confirm')
  @ApiOperation({ summary: 'Get GRN (placeholder for route ordering)' })
  getGRNConfirmPlaceholder() {
    return null;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get purchase order detail' })
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({ summary: 'Create purchase order' })
  create(
    @Body() dto: CreatePurchaseOrderDto,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.svc.create(dto, user.id);
  }

  @Post(':id/submit')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({ summary: 'Submit purchase order for approval' })
  submit(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.svc.submit(id, user.id);
  }

  @Post(':id/approve')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Approve purchase order' })
  approve(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.svc.approve(id, user.id);
  }

  @Post(':id/cancel')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Cancel purchase order' })
  cancel(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.svc.cancel(id, user.id);
  }

  @Post(':id/goods-receipts')
  @Roles(UserRole.ADMIN, UserRole.WAREHOUSE)
  @ApiOperation({ summary: 'Create goods receipt note (GRN) for PO' })
  createGRN(
    @Param('id') poId: string,
    @Body() dto: CreateGRNDto,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.svc.createGRN(poId, dto, user.id);
  }

  @Post('goods-receipts/:grnId/confirm')
  @Roles(UserRole.ADMIN, UserRole.WAREHOUSE)
  @ApiOperation({ summary: 'Confirm GRN and create inventory movements' })
  confirmGRN(
    @Param('grnId') grnId: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.svc.confirmGRN(grnId, user.id);
  }

  @Post('goods-receipts/:grnId/reverse')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Reverse a confirmed GRN' })
  reverseGRN(
    @Param('grnId') grnId: string,
    @Body() dto: ReverseDto,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.svc.reverseGRN(grnId, dto, user.id);
  }
}
