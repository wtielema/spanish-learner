import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Site } from './entities/site.entity.js';
import { Area } from './entities/area.entity.js';
import { WorkCenter } from './entities/work-center.entity.js';
import { WorkUnit } from './entities/work-unit.entity.js';
import { AuditLog } from '../audit/entities/audit-log.entity.js';
import { SitesService } from './services/sites.service.js';
import { AreasService } from './services/areas.service.js';
import { WorkCentersService } from './services/work-centers.service.js';
import { WorkUnitsService } from './services/work-units.service.js';
import { SitesController } from './controllers/sites.controller.js';
import { AreasController } from './controllers/areas.controller.js';
import { WorkCentersController } from './controllers/work-centers.controller.js';
import { WorkUnitsController } from './controllers/work-units.controller.js';
import { UserArea } from '../users/entities/user-area.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Site, Area, WorkCenter, WorkUnit, AuditLog, UserArea]),
  ],
  controllers: [SitesController, AreasController, WorkCentersController, WorkUnitsController],
  providers: [SitesService, AreasService, WorkCentersService, WorkUnitsService],
  exports: [TypeOrmModule, SitesService, AreasService, WorkCentersService, WorkUnitsService],
})
export class CoreModule {}
