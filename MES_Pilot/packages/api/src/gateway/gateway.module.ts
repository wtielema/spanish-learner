import { Module } from '@nestjs/common';
import { MesGateway } from './mes.gateway.js';

@Module({
  providers: [MesGateway],
  exports: [MesGateway],
})
export class GatewayModule {}
