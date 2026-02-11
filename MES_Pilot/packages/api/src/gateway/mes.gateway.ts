import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { OnEvent } from '@nestjs/event-emitter';
import { Logger } from '@nestjs/common';

@WebSocketGateway({ cors: { origin: '*' } })
export class MesGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(MesGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join-area')
  handleJoinArea(client: Socket, areaId: string) {
    client.join(`area:${areaId}`);
    this.logger.debug(`Client ${client.id} joined area:${areaId}`);
  }

  @SubscribeMessage('leave-area')
  handleLeaveArea(client: Socket, areaId: string) {
    client.leave(`area:${areaId}`);
  }

  @SubscribeMessage('join-work-center')
  handleJoinWorkCenter(client: Socket, workCenterId: string) {
    client.join(`work-center:${workCenterId}`);
    this.logger.debug(`Client ${client.id} joined work-center:${workCenterId}`);
  }

  @SubscribeMessage('leave-work-center')
  handleLeaveWorkCenter(client: Socket, workCenterId: string) {
    client.leave(`work-center:${workCenterId}`);
  }

  // ── Domain event handlers ──────────────────────────────

  @OnEvent('work-order.status-changed')
  handleWorkOrderStatusChanged(payload: {
    workOrderId: string;
    status: string;
    workCenterId: string;
    areaId: string;
  }) {
    this.server.to(`area:${payload.areaId}`).emit('work-order:status-changed', payload);
    this.server.to(`work-center:${payload.workCenterId}`).emit('work-order:status-changed', payload);
  }

  @OnEvent('work-order.started')
  handleWorkOrderStarted(payload: {
    workOrderId: string;
    areaId: string;
    workCenterId: string;
  }) {
    this.server.to(`area:${payload.areaId}`).emit('work-order:started', payload);
    this.server.to(`work-center:${payload.workCenterId}`).emit('work-order:started', payload);
  }

  @OnEvent('production.count-updated')
  handleCountUpdated(payload: {
    workOrderId: string;
    areaId: string;
    quantityProduced: number;
    quantityTarget: number;
  }) {
    this.server.to(`area:${payload.areaId}`).emit('production:count-updated', payload);
  }

  @OnEvent('qc.check-due')
  handleCheckDue(payload: {
    checkId: string;
    workOrderId: string;
    workCenterId: string;
  }) {
    this.server.to(`work-center:${payload.workCenterId}`).emit('qc:check-due', payload);
  }

  @OnEvent('qc.deviation-raised')
  handleDeviationRaised(payload: {
    deviationId: string;
    severity: string;
    workOrderId: string;
    areaId: string;
  }) {
    this.server.to(`area:${payload.areaId}`).emit('qc:deviation-raised', payload);
  }
}
