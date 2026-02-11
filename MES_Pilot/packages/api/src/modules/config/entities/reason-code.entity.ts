import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('reason_codes')
export class ReasonCode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  areaId: string; // null = site-level

  @Column({ type: 'text' })
  category: string; // 'downtime' | 'reject' | 'hold'

  @Column({ type: 'jsonb' })
  nameI18n: Record<string, string>;

  @Column({ type: 'boolean', default: false })
  requiresComment: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
