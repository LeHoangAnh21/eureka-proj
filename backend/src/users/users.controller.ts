import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiCookieAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto, ImportUsersDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { QueryUserDto } from './dto/query-user.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../common/enums/role.enum';

@ApiTags('Users')
@ApiCookieAuth()
@Roles(UserRole.ADMIN)
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách user (Admin)' })
  findAll(@Query() query: QueryUserDto) {
    return this.usersService.findAll(query);
  }

  @Post()
  @ApiOperation({ summary: 'Tạo user mới (Admin)' })
  @ApiResponse({ status: 201, description: 'User created' })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  create(@Body() dto: CreateUserDto, @CurrentUser() actor: { id: string }) {
    return this.usersService.create(dto, actor.id);
  }

  @Post('import')
  @ApiOperation({ summary: 'Import nhiều user cùng lúc (Admin)' })
  importMany(
    @Body() dto: ImportUsersDto,
    @CurrentUser() actor: { id: string },
  ) {
    return this.usersService.importMany(dto.users, actor.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết user (Admin)' })
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật user (Admin)' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() actor: { id: string },
  ) {
    return this.usersService.update(id, dto, actor.id);
  }

  @Patch(':id/deactivate')
  @ApiOperation({ summary: 'Vô hiệu hóa user (Admin)' })
  deactivate(@Param('id') id: string, @CurrentUser() actor: { id: string }) {
    return this.usersService.deactivate(id, actor.id);
  }

  @Patch(':id/activate')
  @ApiOperation({ summary: 'Kích hoạt lại user (Admin)' })
  activate(@Param('id') id: string, @CurrentUser() actor: { id: string }) {
    return this.usersService.activate(id, actor.id);
  }
}
