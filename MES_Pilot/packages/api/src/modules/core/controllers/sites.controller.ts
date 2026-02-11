import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { SitesService } from '../services/sites.service.js';
import { CreateSiteDto } from '../dto/create-site.dto.js';
import { UpdateSiteDto } from '../dto/update-site.dto.js';
import { RequirePermission } from '../../auth/decorators/require-permission.decorator.js';
import { PermissionGuard } from '../../auth/guards/permission.guard.js';

@Controller('api/sites')
@UseGuards(PermissionGuard)
export class SitesController {
  constructor(private sitesService: SitesService) {}

  @Get()
  @RequirePermission('config:view')
  findAll() {
    return this.sitesService.findAll();
  }

  @Get(':id')
  @RequirePermission('config:view')
  findOne(@Param('id') id: string) {
    return this.sitesService.findOne(id);
  }

  @Post()
  @RequirePermission('config:edit')
  create(@Body() dto: CreateSiteDto) {
    return this.sitesService.create(dto);
  }

  @Patch(':id')
  @RequirePermission('config:edit')
  update(@Param('id') id: string, @Body() dto: UpdateSiteDto) {
    return this.sitesService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('config:edit')
  remove(@Param('id') id: string) {
    return this.sitesService.remove(id);
  }
}
