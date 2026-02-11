import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkOrder } from './entities/work-order.entity.js';
import { WorkOrderStep } from './entities/work-order-step.entity.js';
import { ProductionLog } from './entities/production-log.entity.js';
import { RecipesModule } from '../recipes/recipes.module.js';
import { JobsService } from './jobs.service.js';
import { JobsController } from './jobs.controller.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([WorkOrder, WorkOrderStep, ProductionLog]),
    RecipesModule,
  ],
  controllers: [JobsController],
  providers: [JobsService],
  exports: [JobsService],
})
export class JobsModule {}
