import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { WorkUnitsService } from '../services/work-units.service.js';
import { CreateWorkUnitDto } from '../dto/create-work-unit.dto.js';
import { UpdateWorkUnitDto } from '../dto/update-work-unit.dto.js';
import { RequirePermission } from '../../auth/decorators/require-permission.decorator.js';
import { PermissionGuard } from '../../auth/guards/permission.guard.js';

@Controller('api/work-units')
@UseGuards(PermissionGuard)
export class WorkUnitsController {
  constructor(private workUnitsService: WorkUnitsService) {}

  @Get()
  @RequirePermission('config:view')
  findAll() {
    return this.workUnitsService.findAll();
  }

  @Get(':id')
  @RequirePermission('config:view')
  findOne(@Param('id') id: string) {
    return this.workUnitsService.findOne(id);
  }

  @Post()
  @RequirePermission('config:edit')
  create(@Body() dto: CreateWorkUnitDto) {
    return this.workUnitsService.create(dto);
  }

  @Patch(':id')
  @RequirePermission('config:edit')
  update(@Param('id') id: string, @Body() dto: UpdateWorkUnitDto) {
    return this.workUnitsService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('config:edit')
  remove(@Param('id') id: string) {
    return this.workUnitsService.remove(id);
  }
}
