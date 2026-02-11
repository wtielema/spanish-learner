import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { QcTemplate } from './qc-template.entity.js';

@Entity('qc_template_params')
export class QcTemplateParam {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  templateId: string;

  @Column({ type: 'jsonb' })
  nameI18n: Record<string, string>;

  @Column({ type: 'text' })
  paramType: string; // numeric, boolean, text, selection

  @Column({ type: 'text', nullable: true })
  unit: string;

  @Column({ type: 'decimal', nullable: true })
  targetValue: number;

  @Column({ type: 'decimal', nullable: true })
  lowerLimit: number;

  @Column({ type: 'decimal', nullable: true })
  upperLimit: number;

  @Column({ type: 'jsonb', nullable: true })
  optionsI18n: Record<string, string[]>;

  @Column({ type: 'int', default: 0 })
  sequence: number;

  @ManyToOne(() => QcTemplate, (t) => t.params)
  @JoinColumn({ name: 'templateId' })
  template: QcTemplate;
}
