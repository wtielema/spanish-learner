import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Area } from './area.entity.js';

@Entity('sites')
export class Site {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  enterpriseId: string;

  @Column({ type: 'jsonb' })
  nameI18n: Record<string, string>;

  @Column({ type: 'text', default: 'UTC' })
  timezone: string;

  @Column({ type: 'text', default: 'en' })
  locale: string;

  @OneToMany(() => Area, (area) => area.site)
  areas: Area[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
