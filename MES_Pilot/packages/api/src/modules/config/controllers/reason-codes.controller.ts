import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ReasonCodesService } from '../reason-codes.service.js';
import { CreateReasonCodeDto } from '../dto/create-reason-code.dto.js';
import { UpdateReasonCodeDto } from '../dto/update-reason-code.dto.js';
import { RequirePermission } from '../../auth/decorators/require-permission.decorator.js';
import { PermissionGuard } from '../../auth/guards/permission.guard.js';

@Controller('api')
@UseGuards(PermissionGuard)
export class ReasonCodesController {
  constructor(private reasonCodesService: ReasonCodesService) {}

  @Get('reason-codes')
  @RequirePermission('config:view')
  findAll() {
    return this.reasonCodesService.findAll();
  }

  @Get('reason-codes/:id')
  @RequirePermission('config:view')
  findOne(@Param('id') id: string) {
    return this.reasonCodesService.findOne(id);
  }

  @Post('reason-codes')
  @RequirePermission('config:edit')
  create(@Body() dto: CreateReasonCodeDto) {
    return this.reasonCodesService.create(dto);
  }

  @Patch('reason-codes/:id')
  @RequirePermission('config:edit')
  update(@Param('id') id: string, @Body() dto: UpdateReasonCodeDto) {
    return this.reasonCodesService.update(id, dto);
  }

  @Delete('reason-codes/:id')
  @RequirePermission('config:edit')
  remove(@Param('id') id: string) {
    return this.reasonCodesService.remove(id);
  }

  @Get('areas/:areaId/reason-codes')
  @RequirePermission('config:view')
  findByArea(@Param('areaId') areaId: string) {
    return this.reasonCodesService.findByArea(areaId);
  }
}
