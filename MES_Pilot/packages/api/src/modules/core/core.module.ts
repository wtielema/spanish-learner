import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Site } from './entities/site.entity.js';
import { Area } from './entities/area.entity.js';
import { WorkCenter } from './entities/work-center.entity.js';
import { WorkUnit } from './entities/work-unit.entity.js';
import { AuditLog } from '../audit/entities/audit-log.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Site, Area, WorkCenter, WorkUnit, AuditLog]),
  ],
  exports: [TypeOrmModule],
})
export class CoreModule {}
