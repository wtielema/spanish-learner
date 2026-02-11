import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Product } from './product.entity.js';
import { RecipePhase } from './recipe-phase.entity.js';
import { RecipeMaterial } from './recipe-material.entity.js';

@Entity('master_recipes')
export class MasterRecipe {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  productId: string;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column({ type: 'int', default: 1 })
  version: number;

  @Column({ type: 'text', default: 'draft' })
  status: string; // draft, in_review, approved, active, obsolete

  @Column({ type: 'text' })
  areaType: string;

  @Column({ type: 'uuid', array: true, default: '{}' })
  applicableWorkCenters: string[];

  @Column({ type: 'uuid', nullable: true })
  createdBy: string;

  @Column({ type: 'uuid', nullable: true })
  approvedBy: string;

  @Column({ type: 'timestamptz', nullable: true })
  approvedAt: Date;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @OneToMany(() => RecipePhase, (phase) => phase.recipe)
  phases: RecipePhase[];

  @OneToMany(() => RecipeMaterial, (rm) => rm.recipe)
  materials: RecipeMaterial[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
