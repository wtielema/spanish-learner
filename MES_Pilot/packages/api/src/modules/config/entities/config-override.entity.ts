import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('config_overrides')
export class ConfigOverride {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  entityType: string;

  @Column({ type: 'uuid', nullable: true })
  entityId: string;

  @Column({ type: 'text' })
  scopeType: string; // 'site' | 'area' | 'work_center'

  @Column({ type: 'uuid' })
  scopeId: string;

  @Column({ type: 'text' })
  key: string;

  @Column({ type: 'jsonb' })
  value: any;

  @CreateDateColumn()
  createdAt: Date;
}
