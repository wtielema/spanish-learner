import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Site } from './site.entity.js';
import { WorkCenter } from './work-center.entity.js';

export enum AreaType {
  BATCH = 'batch',
  DISCRETE = 'discrete',
  PACKAGING = 'packaging',
}

@Entity('areas')
export class Area {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  siteId: string;

  @ManyToOne(() => Site, (site) => site.areas)
  @JoinColumn({ name: 'siteId' })
  site: Site;

  @Column({ type: 'jsonb' })
  nameI18n: Record<string, string>;

  @Column({ type: 'text' })
  areaType: string;

  @Column({ type: 'jsonb', default: {} })
  config: Record<string, any>;

  @OneToMany(() => WorkCenter, (wc) => wc.area)
  workCenters: WorkCenter[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
