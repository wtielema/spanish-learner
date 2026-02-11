import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('qc_holds')
export class QcHold {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  workOrderId: string;

  @Column({ type: 'uuid', nullable: true })
  deviationId: string;

  @Column({ type: 'text' })
  holdType: string; // quality, material

  @Column({ type: 'uuid' })
  placedBy: string;

  @CreateDateColumn()
  placedAt: Date;

  @Column({ type: 'uuid', nullable: true })
  releasedBy: string;

  @Column({ type: 'timestamptz', nullable: true })
  releasedAt: Date;

  @Column({ type: 'text', nullable: true })
  disposition: string; // release, rework, scrap

  @Column({ type: 'text', nullable: true })
  justification: string;
}
