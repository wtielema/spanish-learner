import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { WorkCenter } from './work-center.entity.js';

@Entity('work_units')
export class WorkUnit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  workCenterId: string;

  @ManyToOne(() => WorkCenter, (wc) => wc.workUnits)
  @JoinColumn({ name: 'workCenterId' })
  workCenter: WorkCenter;

  @Column({ type: 'jsonb' })
  nameI18n: Record<string, string>;

  @Column({ type: 'text', nullable: true })
  unitType: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
