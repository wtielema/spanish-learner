import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('control_recipes')
export class ControlRecipe {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  masterRecipeId: string;

  @Column({ type: 'uuid' })
  workOrderId: string;

  @Column({ type: 'jsonb' })
  snapshot: Record<string, any>; // Full copy of master recipe data

  @Column({ type: 'decimal', nullable: true })
  batchSize: number;

  @CreateDateColumn()
  createdAt: Date;
}
