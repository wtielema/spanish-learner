import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { UserArea } from './user-area.entity.js';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text', unique: true, nullable: true })
  entraId: string;

  @Column({ type: 'text', unique: true })
  email: string;

  @Column({ type: 'text' })
  displayName: string;

  @Column({ type: 'text', default: 'en' })
  preferredLocale: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @OneToMany(() => UserArea, (ua) => ua.user)
  userAreas: UserArea[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
