import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { WorkOrder } from './work-order.entity.js';

@Entity('work_order_steps')
export class WorkOrderStep {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  workOrderId: string;

  @Column({ type: 'int' })
  sequence: number;

  @Column({ type: 'jsonb' })
  nameI18n: Record<string, string>;

  @Column({ type: 'text' })
  stepType: string; // setup, production, changeover, cleaning

  @Column({ type: 'text', default: 'pending' })
  status: string;

  @Column({ type: 'timestamptz', nullable: true })
  startedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt: Date;

  @Column({ type: 'uuid', nullable: true })
  operatorId: string;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => WorkOrder, (wo) => wo.steps)
  @JoinColumn({ name: 'workOrderId' })
  workOrder: WorkOrder;
}
