import {
  Controller,
  Get,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { MesConfigService } from '../config.service.js';
import { SetOverrideDto } from '../dto/set-override.dto.js';
import { RequirePermission } from '../../auth/decorators/require-permission.decorator.js';
import { PermissionGuard } from '../../auth/guards/permission.guard.js';

@Controller('api/config')
@UseGuards(PermissionGuard)
export class ConfigController {
  constructor(private configService: MesConfigService) {}

  @Get('work-centers/:id')
  @RequirePermission('config:view')
  getResolvedConfig(@Param('id') id: string) {
    return this.configService.getResolvedConfig(id);
  }

  @Put('overrides')
  @RequirePermission('config:edit')
  setOverride(@Body() dto: SetOverrideDto) {
    return this.configService.setOverride(dto);
  }

  @Delete('overrides/:id')
  @RequirePermission('config:edit')
  removeOverride(@Param('id') id: string) {
    return this.configService.removeOverride(id);
  }
}
