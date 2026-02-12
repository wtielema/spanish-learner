import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { QualityService } from './quality.service.js';
import { CreateQcTemplateDto } from './dto/create-qc-template.dto.js';
import { CreateQcTemplateParamDto } from './dto/create-qc-template-param.dto.js';
import { CompleteCheckDto } from './dto/complete-check.dto.js';
import { CreateDeviationDto } from './dto/create-deviation.dto.js';
import { PlaceHoldDto } from './dto/place-hold.dto.js';
import { ReleaseHoldDto } from './dto/release-hold.dto.js';
import { RequirePermission } from '../auth/decorators/require-permission.decorator.js';
import { PermissionGuard } from '../auth/guards/permission.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { User } from '../users/entities/user.entity.js';

@Controller('api')
@UseGuards(PermissionGuard)
export class QualityController {
  constructor(private qualityService: QualityService) {}

  // ── QC Templates ───────────────────────────────────────

  @Post('qc-templates')
  @RequirePermission('config:edit')
  createTemplate(@Body() dto: CreateQcTemplateDto) {
    return this.qualityService.createTemplate(dto);
  }

  @Get('qc-templates')
  @RequirePermission('config:view')
  findAllTemplates(
    @Query('areaId') areaId?: string,
    @Query('productId') productId?: string,
  ) {
    return this.qualityService.findAllTemplates({ areaId, productId });
  }

  @Get('qc-templates/:id')
  @RequirePermission('config:view')
  findOneTemplate(@Param('id') id: string) {
    return this.qualityService.findOneTemplate(id);
  }

  @Post('qc-templates/:id/params')
  @RequirePermission('config:edit')
  addTemplateParam(
    @Param('id') id: string,
    @Body() dto: CreateQcTemplateParamDto,
  ) {
    return this.qualityService.addTemplateParam(id, dto);
  }

  @Post('qc-templates/:id/assign')
  @RequirePermission('config:edit')
  assignToWorkCenters(
    @Param('id') id: string,
    @Body('workCenterIds') workCenterIds: string[],
  ) {
    return this.qualityService.assignToWorkCenters(id, workCenterIds);
  }

  // ── QC Checks ──────────────────────────────────────────

  @Get('qc-checks/history')
  @RequirePermission('qc:view')
  findHistory(
    @Query('templateId') templateId?: string,
    @Query('status') status?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.qualityService.findHistory({
      templateId,
      status,
      dateFrom,
      dateTo,
    });
  }

  @Get('work-orders/:workOrderId/qc-checks')
  @RequirePermission('qc:view')
  getDueChecks(@Param('workOrderId') workOrderId: string) {
    return this.qualityService.getDueChecks(workOrderId);
  }

  @Post('qc-checks/:id/complete')
  @RequirePermission('qc:inspect')
  completeCheck(
    @Param('id') id: string,
    @Body() dto: CompleteCheckDto,
    @CurrentUser() user: User,
  ) {
    return this.qualityService.completeCheck(id, dto, user.id);
  }

  // ── QC Deviations ─────────────────────────────────────

  @Post('qc-deviations')
  @RequirePermission('qc:deviate')
  createDeviation(
    @Body() dto: CreateDeviationDto,
    @CurrentUser() user: User,
  ) {
    return this.qualityService.createDeviation(dto, user.id);
  }

  @Get('qc-deviations')
  @RequirePermission('qc:view')
  findDeviations(@Query('workOrderId') workOrderId?: string) {
    return this.qualityService.findDeviations({ workOrderId });
  }

  // ── QC Holds ───────────────────────────────────────────

  @Post('qc-holds')
  @RequirePermission('qc:hold')
  placeHold(@Body() dto: PlaceHoldDto, @CurrentUser() user: User) {
    return this.qualityService.placeHold(dto, user.id);
  }

  @Post('qc-holds/:id/release')
  @RequirePermission('qc:release')
  releaseHold(
    @Param('id') id: string,
    @Body() dto: ReleaseHoldDto,
    @CurrentUser() user: User,
  ) {
    return this.qualityService.releaseHold(id, dto, user.id);
  }

  @Get('qc-holds')
  @RequirePermission('qc:view')
  findHolds(
    @Query('workOrderId') workOrderId?: string,
    @Query('active') active?: string,
  ) {
    const activeFilter =
      active === 'true' ? true : active === 'false' ? false : undefined;
    return this.qualityService.findHolds({
      workOrderId,
      active: activeFilter,
    });
  }
}
