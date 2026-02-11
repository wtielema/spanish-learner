import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReasonCode } from './entities/reason-code.entity.js';
import { ConfigOverride } from './entities/config-override.entity.js';
import { WorkCenter } from '../core/entities/work-center.entity.js';
import { MesConfigService } from './config.service.js';
import { ReasonCodesService } from './reason-codes.service.js';
import { ConfigController } from './controllers/config.controller.js';
import { ReasonCodesController } from './controllers/reason-codes.controller.js';
import { CoreModule } from '../core/core.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([ReasonCode, ConfigOverride, WorkCenter]),
    CoreModule,
  ],
  controllers: [ConfigController, ReasonCodesController],
  providers: [MesConfigService, ReasonCodesService],
  exports: [MesConfigService, ReasonCodesService],
})
export class MesConfigModule {}
