import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Product } from '../../recipes/entities/product.entity.js';
import { Area } from '../../core/entities/area.entity.js';
import { WorkCenter } from '../../core/entities/work-center.entity.js';
import { WorkOrderStep } from './work-order-step.entity.js';
import { ProductionLog } from './production-log.entity.js';

@Entity('work_orders')
export class WorkOrder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text', unique: true })
  orderNumber: string;

  @Column({ type: 'uuid' })
  productId: string;

  @Column({ type: 'uuid' })
  areaId: string;

  @Column({ type: 'uuid' })
  workCenterId: string;

  @Column({ type: 'uuid', nullable: true })
  controlRecipeId: string;

  @Column({ type: 'decimal', default: 0 })
  quantityTarget: number;

  @Column({ type: 'decimal', default: 0 })
  quantityProduced: number;

  @Column({ type: 'decimal', default: 0 })
  quantityRejected: number;

  @Column({ type: 'text', default: 'draft' })
  status: string; // draft, released, started, in_progress, completed, on_hold

  @Column({ type: 'int', default: 0 })
  priority: number;

  @Column({ type: 'timestamptz', nullable: true })
  scheduledStart: Date;

  @Column({ type: 'timestamptz', nullable: true })
  actualStart: Date;

  @Column({ type: 'timestamptz', nullable: true })
  actualEnd: Date;

  @Column({ type: 'uuid' })
  createdBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Product)
  @JoinColumn({ name: 'productId' })
  product: Product;

  @ManyToOne(() => Area)
  @JoinColumn({ name: 'areaId' })
  area: Area;

  @ManyToOne(() => WorkCenter)
  @JoinColumn({ name: 'workCenterId' })
  workCenter: WorkCenter;

  @OneToMany(() => WorkOrderStep, (step) => step.workOrder)
  steps: WorkOrderStep[];

  @OneToMany(() => ProductionLog, (log) => log.workOrder)
  productionLogs: ProductionLog[];
}
