import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Area } from '../entities/area.entity.js';
import { CreateAreaDto } from '../dto/create-area.dto.js';
import { UpdateAreaDto } from '../dto/update-area.dto.js';

@Injectable()
export class AreasService {
  constructor(
    @InjectRepository(Area)
    private repo: Repository<Area>,
  ) {}

  async create(dto: CreateAreaDto): Promise<Area> {
    const area = this.repo.create(dto);
    return this.repo.save(area);
  }

  async findAll(): Promise<Area[]> {
    return this.repo.find({ relations: ['site', 'workCenters'] });
  }

  async findOne(id: string): Promise<Area> {
    const area = await this.repo.findOne({ where: { id }, relations: ['site', 'workCenters'] });
    if (!area) throw new NotFoundException(`Area ${id} not found`);
    return area;
  }

  async update(id: string, dto: UpdateAreaDto): Promise<Area> {
    const area = await this.findOne(id);
    Object.assign(area, dto);
    return this.repo.save(area);
  }

  async remove(id: string): Promise<void> {
    const area = await this.findOne(id);
    await this.repo.remove(area);
  }
}
