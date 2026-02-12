import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { QcTemplate } from './qc-template.entity.js';
import { QcResult } from './qc-result.entity.js';
import { WorkOrder } from '../../jobs/entities/work-order.entity.js';

@Entity('qc_checks')
export class QcCheck {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  workOrderId: string;

  @Column({ type: 'uuid' })
  templateId: string;

  @Column({ type: 'text', default: 'pending' })
  status: string; // pending, due, passed, failed, skipped

  @Column({ type: 'timestamptz', nullable: true })
  scheduledAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt: Date;

  @Column({ type: 'uuid', nullable: true })
  operatorId: string;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => QcTemplate)
  @JoinColumn({ name: 'templateId' })
  template: QcTemplate;

  @ManyToOne(() => WorkOrder)
  @JoinColumn({ name: 'workOrderId' })
  workOrder: WorkOrder;

  @OneToMany(() => QcResult, (r) => r.check)
  results: QcResult[];
}
