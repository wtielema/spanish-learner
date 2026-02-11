import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QcTemplate } from './entities/qc-template.entity.js';
import { QcTemplateParam } from './entities/qc-template-param.entity.js';
import { QcCheck } from './entities/qc-check.entity.js';
import { QcResult } from './entities/qc-result.entity.js';
import { QcDeviation } from './entities/qc-deviation.entity.js';
import { QcHold } from './entities/qc-hold.entity.js';
import { UserArea } from '../users/entities/user-area.entity.js';
import { QualityService } from './quality.service.js';
import { QualityController } from './quality.controller.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      QcTemplate,
      QcTemplateParam,
      QcCheck,
      QcResult,
      QcDeviation,
      QcHold,
      UserArea,
    ]),
  ],
  controllers: [QualityController],
  providers: [QualityService],
  exports: [QualityService],
})
export class QualityModule {}
