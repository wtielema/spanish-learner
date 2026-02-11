import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { RecipePhase } from './recipe-phase.entity.js';

@Entity('recipe_parameters')
export class RecipeParameter {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  phaseId: string;

  @ManyToOne(() => RecipePhase, (p) => p.parameters)
  @JoinColumn({ name: 'phaseId' })
  phase: RecipePhase;

  @Column({ type: 'jsonb' })
  nameI18n: Record<string, string>;

  @Column({ type: 'text' })
  paramType: string; // setpoint, limit, info

  @Column({ type: 'decimal', nullable: true })
  value: number;

  @Column({ type: 'text', nullable: true })
  unit: string;

  @Column({ type: 'decimal', nullable: true })
  lowerLimit: number;

  @Column({ type: 'decimal', nullable: true })
  upperLimit: number;

  @CreateDateColumn()
  createdAt: Date;
}
