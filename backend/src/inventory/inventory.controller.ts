import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { InventoryService } from './inventory.service';

@ApiTags('Inventory')
@ApiBearerAuth('bearer')
@Controller('inventory')
export class InventoryController {
  constructor(private svc: InventoryService) {}

  @Get('stock')
  @ApiOperation({ summary: 'Get current stock balances' })
  @ApiQuery({ name: 'warehouseId', required: false })
  @ApiQuery({ name: 'productId', required: false })
  getCurrentStock(
    @Query('warehouseId') warehouseId?: string,
    @Query('productId') productId?: string,
  ) {
    return this.svc.getCurrentStock({ warehouseId, productId });
  }

  @Get('movements')
  @ApiOperation({ summary: 'Get inventory movements' })
  @ApiQuery({ name: 'warehouseId', required: false })
  @ApiQuery({ name: 'productId', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getMovements(
    @Query('warehouseId') warehouseId?: string,
    @Query('productId') productId?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.svc.getMovements({ warehouseId, productId, page, limit });
  }
}
