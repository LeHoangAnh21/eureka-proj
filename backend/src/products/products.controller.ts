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
import { ProductsService } from './products.service';
import {
  CreateProductDto,
  UpdateProductDto,
  QueryProductDto,
  ImportProductsDto,
} from './dto/product.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../common/enums/role.enum';

@ApiTags('Products')
@ApiCookieAuth()
@Controller('products')
export class ProductsController {
  constructor(private svc: ProductsService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách sản phẩm (tất cả role)' })
  findAll(@Query() query: QueryProductDto) {
    return this.svc.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết sản phẩm' })
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Tạo sản phẩm (Admin)' })
  create(@Body() dto: CreateProductDto, @CurrentUser() actor: { id: string }) {
    return this.svc.create(dto, actor.id);
  }

  @Post('import')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Import nhiều sản phẩm (Admin)' })
  importMany(
    @Body() dto: ImportProductsDto,
    @CurrentUser() actor: { id: string },
  ) {
    return this.svc.importMany(dto.items, actor.id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Cập nhật sản phẩm (Admin)' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @CurrentUser() actor: { id: string },
  ) {
    return this.svc.update(id, dto, actor.id);
  }
}
