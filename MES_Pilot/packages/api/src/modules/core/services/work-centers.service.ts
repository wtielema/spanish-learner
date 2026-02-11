import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkCenter } from '../entities/work-center.entity.js';
import { CreateWorkCenterDto } from '../dto/create-work-center.dto.js';
import { UpdateWorkCenterDto } from '../dto/update-work-center.dto.js';

@Injectable()
export class WorkCentersService {
  constructor(
    @InjectRepository(WorkCenter)
    private repo: Repository<WorkCenter>,
  ) {}

  async create(dto: CreateWorkCenterDto): Promise<WorkCenter> {
    const workCenter = this.repo.create(dto);
    return this.repo.save(workCenter);
  }

  async findAll(): Promise<WorkCenter[]> {
    return this.repo.find({ relations: ['area', 'workUnits'] });
  }

  async findOne(id: string): Promise<WorkCenter> {
    const workCenter = await this.repo.findOne({ where: { id }, relations: ['area', 'workUnits'] });
    if (!workCenter) throw new NotFoundException(`WorkCenter ${id} not found`);
    return workCenter;
  }

  async update(id: string, dto: UpdateWorkCenterDto): Promise<WorkCenter> {
    const workCenter = await this.findOne(id);
    Object.assign(workCenter, dto);
    return this.repo.save(workCenter);
  }

  async remove(id: string): Promise<void> {
    const workCenter = await this.findOne(id);
    await this.repo.remove(workCenter);
  }

  async clone(id: string): Promise<WorkCenter> {
    const original = await this.findOne(id);
    const clone = this.repo.create({
      areaId: original.areaId,
      nameI18n: Object.fromEntries(
        Object.entries(original.nameI18n).map(([lang, name]) => [lang, `${name} (Copy)`]),
      ),
      descriptionI18n: original.descriptionI18n,
    });
    return this.repo.save(clone);
  }
}
