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
import { PartnersService } from './partners.service';
import {
  CreatePartnerDto,
  UpdatePartnerDto,
  QueryPartnerDto,
  ImportPartnersDto,
} from './dto/partner.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../common/enums/role.enum';

@ApiTags('Partners')
@ApiCookieAuth()
@Controller('partners')
export class PartnersController {
  constructor(private svc: PartnersService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách đối tác (tất cả role)' })
  findAll(@Query() query: QueryPartnerDto) {
    return this.svc.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết đối tác' })
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Tạo đối tác (Admin)' })
  create(@Body() dto: CreatePartnerDto, @CurrentUser() actor: { id: string }) {
    return this.svc.create(dto, actor.id);
  }

  @Post('import')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Import nhiều đối tác (Admin)' })
  importMany(
    @Body() dto: ImportPartnersDto,
    @CurrentUser() actor: { id: string },
  ) {
    return this.svc.importMany(dto.items, actor.id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Cập nhật đối tác (Admin)' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePartnerDto,
    @CurrentUser() actor: { id: string },
  ) {
    return this.svc.update(id, dto, actor.id);
  }
}
