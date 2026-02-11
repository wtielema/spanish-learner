import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { QcCheck } from './qc-check.entity.js';
import { QcTemplateParam } from './qc-template-param.entity.js';

@Entity('qc_results')
export class QcResult {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  checkId: string;

  @Column({ type: 'uuid' })
  paramId: string;

  @Column({ type: 'text', nullable: true })
  value: string;

  @Column({ type: 'boolean', nullable: true })
  isInSpec: boolean;

  @Column({ type: 'text', nullable: true })
  comment: string;

  @ManyToOne(() => QcCheck, (c) => c.results)
  @JoinColumn({ name: 'checkId' })
  check: QcCheck;

  @ManyToOne(() => QcTemplateParam)
  @JoinColumn({ name: 'paramId' })
  param: QcTemplateParam;
}
