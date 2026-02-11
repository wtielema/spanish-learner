import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { AreasService } from '../services/areas.service.js';
import { CreateAreaDto } from '../dto/create-area.dto.js';
import { UpdateAreaDto } from '../dto/update-area.dto.js';
import { RequirePermission } from '../../auth/decorators/require-permission.decorator.js';
import { PermissionGuard } from '../../auth/guards/permission.guard.js';

@Controller('api/areas')
@UseGuards(PermissionGuard)
export class AreasController {
  constructor(private areasService: AreasService) {}

  @Get()
  @RequirePermission('config:view')
  findAll() {
    return this.areasService.findAll();
  }

  @Get(':id')
  @RequirePermission('config:view')
  findOne(@Param('id') id: string) {
    return this.areasService.findOne(id);
  }

  @Post()
  @RequirePermission('config:edit')
  create(@Body() dto: CreateAreaDto) {
    return this.areasService.create(dto);
  }

  @Patch(':id')
  @RequirePermission('config:edit')
  update(@Param('id') id: string, @Body() dto: UpdateAreaDto) {
    return this.areasService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('config:edit')
  remove(@Param('id') id: string) {
    return this.areasService.remove(id);
  }
}
