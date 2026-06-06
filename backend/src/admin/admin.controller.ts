import { Controller, Post, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/role.enum';
import { AdminService } from './admin.service';

@ApiTags('Admin')
@ApiBearerAuth('bearer')
@Controller('admin')
export class AdminController {
  constructor(private svc: AdminService) {}

  @Post('seed-demo')
  @HttpCode(200)
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Import mock data: kho, đối tác, sản phẩm, tiền tệ',
  })
  seedDemo() {
    return this.svc.seedDemoData();
  }
}
