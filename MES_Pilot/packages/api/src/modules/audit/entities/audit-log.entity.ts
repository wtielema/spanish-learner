import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('audit_log')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn()
  timestamp: Date;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  userId: string;

  @Column({ type: 'text' })
  action: string;

  @Column({ type: 'text' })
  @Index()
  entityType: string;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  entityId: string;

  @Column({ type: 'jsonb', nullable: true })
  beforeState: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  afterState: Record<string, any>;
}
