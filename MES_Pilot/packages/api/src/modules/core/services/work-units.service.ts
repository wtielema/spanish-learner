import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkUnit } from '../entities/work-unit.entity.js';
import { CreateWorkUnitDto } from '../dto/create-work-unit.dto.js';
import { UpdateWorkUnitDto } from '../dto/update-work-unit.dto.js';

@Injectable()
export class WorkUnitsService {
  constructor(
    @InjectRepository(WorkUnit)
    private repo: Repository<WorkUnit>,
  ) {}

  async create(dto: CreateWorkUnitDto): Promise<WorkUnit> {
    const workUnit = this.repo.create(dto);
    return this.repo.save(workUnit);
  }

  async findAll(): Promise<WorkUnit[]> {
    return this.repo.find({ relations: ['workCenter'] });
  }

  async findOne(id: string): Promise<WorkUnit> {
    const workUnit = await this.repo.findOne({ where: { id }, relations: ['workCenter'] });
    if (!workUnit) throw new NotFoundException(`WorkUnit ${id} not found`);
    return workUnit;
  }

  async update(id: string, dto: UpdateWorkUnitDto): Promise<WorkUnit> {
    const workUnit = await this.findOne(id);
    Object.assign(workUnit, dto);
    return this.repo.save(workUnit);
  }

  async remove(id: string): Promise<void> {
    const workUnit = await this.findOne(id);
    await this.repo.remove(workUnit);
  }
}
