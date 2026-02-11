import { Entity, Column, ManyToOne, JoinColumn, CreateDateColumn, PrimaryGeneratedColumn } from 'typeorm';
import { User } from './user.entity.js';
import { Role } from './role.entity.js';

@Entity('user_areas')
export class UserArea {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'uuid' })
  areaId: string;

  @Column({ type: 'uuid' })
  roleId: string;

  @ManyToOne(() => User, (user) => user.userAreas)
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => Role)
  @JoinColumn({ name: 'roleId' })
  role: Role;

  @CreateDateColumn()
  createdAt: Date;
}
