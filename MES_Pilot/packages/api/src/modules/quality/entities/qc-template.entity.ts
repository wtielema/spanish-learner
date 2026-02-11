import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { QcTemplateParam } from './qc-template-param.entity.js';

@Entity('qc_templates')
export class QcTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  areaId: string;

  @Column({ type: 'uuid', nullable: true })
  productId: string;

  @Column({ type: 'jsonb' })
  nameI18n: Record<string, string>;

  @Column({ type: 'text' })
  trigger: string; // on_start, on_complete, timed_interval, every_n_units

  @Column({ type: 'decimal', nullable: true })
  triggerValue: number; // interval minutes or unit count

  @Column({ type: 'boolean', default: true })
  isMandatory: boolean;

  @Column({ type: 'uuid', array: true, default: '{}' })
  applicableWorkCenters: string[]; // empty = all in area

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => QcTemplateParam, (p) => p.template)
  params: QcTemplateParam[];
}
