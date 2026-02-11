import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { WorkCentersService } from '../services/work-centers.service.js';
import { CreateWorkCenterDto } from '../dto/create-work-center.dto.js';
import { UpdateWorkCenterDto } from '../dto/update-work-center.dto.js';
import { RequirePermission } from '../../auth/decorators/require-permission.decorator.js';
import { PermissionGuard } from '../../auth/guards/permission.guard.js';

@Controller('api/work-centers')
@UseGuards(PermissionGuard)
export class WorkCentersController {
  constructor(private workCentersService: WorkCentersService) {}

  @Get()
  @RequirePermission('config:view')
  findAll() {
    return this.workCentersService.findAll();
  }

  @Get(':id')
  @RequirePermission('config:view')
  findOne(@Param('id') id: string) {
    return this.workCentersService.findOne(id);
  }

  @Post()
  @RequirePermission('config:edit')
  create(@Body() dto: CreateWorkCenterDto) {
    return this.workCentersService.create(dto);
  }

  @Post(':id/clone')
  @RequirePermission('config:edit')
  clone(@Param('id') id: string) {
    return this.workCentersService.clone(id);
  }

  @Patch(':id')
  @RequirePermission('config:edit')
  update(@Param('id') id: string, @Body() dto: UpdateWorkCenterDto) {
    return this.workCentersService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('config:edit')
  remove(@Param('id') id: string) {
    return this.workCentersService.remove(id);
  }
}
