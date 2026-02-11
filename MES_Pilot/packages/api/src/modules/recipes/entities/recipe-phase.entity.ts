import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { MasterRecipe } from './master-recipe.entity.js';
import { RecipeParameter } from './recipe-parameter.entity.js';

@Entity('recipe_phases')
export class RecipePhase {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  recipeId: string;

  @ManyToOne(() => MasterRecipe, (r) => r.phases)
  @JoinColumn({ name: 'recipeId' })
  recipe: MasterRecipe;

  @Column({ type: 'int' })
  sequence: number;

  @Column({ type: 'jsonb' })
  nameI18n: Record<string, string>;

  @Column({ type: 'text' })
  phaseType: string; // preparation, processing, finishing, cleaning

  @Column({ type: 'int', nullable: true })
  durationTargetMin: number;

  @Column({ type: 'jsonb', nullable: true })
  instructionsI18n: Record<string, string>;

  @OneToMany(() => RecipeParameter, (rp) => rp.phase)
  parameters: RecipeParameter[];

  @CreateDateColumn()
  createdAt: Date;
}
