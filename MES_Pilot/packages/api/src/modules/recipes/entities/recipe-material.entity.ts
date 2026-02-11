import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { MasterRecipe } from './master-recipe.entity.js';
import { Material } from './material.entity.js';

@Entity('recipe_materials')
export class RecipeMaterial {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  recipeId: string;

  @ManyToOne(() => MasterRecipe, (r) => r.materials)
  @JoinColumn({ name: 'recipeId' })
  recipe: MasterRecipe;

  @Column({ type: 'uuid', nullable: true })
  phaseId: string;

  @Column({ type: 'uuid' })
  materialId: string;

  @ManyToOne(() => Material)
  @JoinColumn({ name: 'materialId' })
  material: Material;

  @Column({ type: 'decimal' })
  quantityPerBatch: number;

  @Column({ type: 'text' })
  unit: string;

  @Column({ type: 'boolean', default: false })
  isCritical: boolean;

  @Column({ type: 'text', default: 'linear' })
  scalingType: string; // linear, fixed

  @CreateDateColumn()
  createdAt: Date;
}
