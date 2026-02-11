import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('qc_deviations')
export class QcDeviation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  checkId: string;

  @Column({ type: 'uuid' })
  workOrderId: string;

  @Column({ type: 'text' })
  severity: string; // minor, major, critical

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'text', nullable: true })
  actionTaken: string;

  @Column({ type: 'uuid', nullable: true })
  resolvedBy: string;

  @Column({ type: 'timestamptz', nullable: true })
  resolvedAt: Date;

  @Column({ type: 'uuid' })
  createdBy: string;

  @CreateDateColumn()
  createdAt: Date;
}
