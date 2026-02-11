import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JobsService } from './jobs.service.js';
import { CreateWorkOrderDto } from './dto/create-work-order.dto.js';
import { UpdateWorkOrderDto } from './dto/update-work-order.dto.js';
import { LogProductionDto } from './dto/log-production.dto.js';
import { RequirePermission } from '../auth/decorators/require-permission.decorator.js';
import { PermissionGuard } from '../auth/guards/permission.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { User } from '../users/entities/user.entity.js';

@Controller('api/work-orders')
@UseGuards(PermissionGuard)
export class JobsController {
  constructor(private jobsService: JobsService) {}

  @Get()
  @RequirePermission('job:view')
  findAll(
    @Query('areaId') areaId?: string,
    @Query('status') status?: string,
    @Query('workCenterId') workCenterId?: string,
  ) {
    return this.jobsService.findAll({ areaId, status, workCenterId });
  }

  @Post()
  @RequirePermission('job:create')
  create(@Body() dto: CreateWorkOrderDto, @CurrentUser() user: User) {
    return this.jobsService.create(dto, user.id);
  }

  @Get(':id')
  @RequirePermission('job:view')
  findOne(@Param('id') id: string) {
    return this.jobsService.findOne(id);
  }

  @Patch(':id')
  @RequirePermission('job:create')
  update(@Param('id') id: string, @Body() dto: UpdateWorkOrderDto) {
    return this.jobsService.update(id, dto);
  }

  @Post(':id/release')
  @RequirePermission('job:create')
  release(@Param('id') id: string) {
    return this.jobsService.release(id);
  }

  @Post(':id/start')
  @RequirePermission('job:start')
  start(@Param('id') id: string, @CurrentUser() user: User) {
    return this.jobsService.start(id, user.id);
  }

  @Post(':id/complete')
  @RequirePermission('job:complete')
  complete(@Param('id') id: string, @CurrentUser() user: User) {
    return this.jobsService.complete(id, user.id);
  }

  @Post(':id/hold')
  @RequirePermission('job:hold')
  hold(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @CurrentUser() user: User,
  ) {
    return this.jobsService.hold(id, reason, user.id);
  }

  @Post(':id/resume')
  @RequirePermission('job:hold')
  resume(@Param('id') id: string, @CurrentUser() user: User) {
    return this.jobsService.resume(id, user.id);
  }

  @Post(':id/logs')
  @RequirePermission('job:start')
  logProduction(
    @Param('id') id: string,
    @Body() dto: LogProductionDto,
    @CurrentUser() user: User,
  ) {
    return this.jobsService.logProduction(id, dto, user.id);
  }

  @Get(':id/logs')
  @RequirePermission('job:view')
  getProductionLogs(@Param('id') id: string) {
    return this.jobsService.getProductionLogs(id);
  }
}
