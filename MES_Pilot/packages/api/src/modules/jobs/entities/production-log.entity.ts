import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { WorkOrder } from './work-order.entity.js';

@Entity('production_logs')
export class ProductionLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  workOrderId: string;

  @Column({ type: 'uuid', nullable: true })
  workUnitId: string;

  @CreateDateColumn()
  timestamp: Date;

  @Column({ type: 'text' })
  eventType: string; // count, reject, downtime, note

  @Column({ type: 'decimal', nullable: true })
  value: number;

  @Column({ type: 'uuid', nullable: true })
  reasonCodeId: string;

  @Column({ type: 'uuid', nullable: true })
  operatorId: string;

  @Column({ type: 'text', nullable: true })
  comment: string;

  @ManyToOne(() => WorkOrder, (wo) => wo.productionLogs)
  @JoinColumn({ name: 'workOrderId' })
  workOrder: WorkOrder;
}
