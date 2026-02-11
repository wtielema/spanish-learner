import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Area } from './area.entity.js';
import { WorkUnit } from './work-unit.entity.js';

@Entity('work_centers')
export class WorkCenter {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  areaId: string;

  @ManyToOne(() => Area, (area) => area.workCenters)
  @JoinColumn({ name: 'areaId' })
  area: Area;

  @Column({ type: 'jsonb' })
  nameI18n: Record<string, string>;

  @Column({ type: 'jsonb', nullable: true })
  descriptionI18n: Record<string, string>;

  @OneToMany(() => WorkUnit, (wu) => wu.workCenter)
  workUnits: WorkUnit[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
