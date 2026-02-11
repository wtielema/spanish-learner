import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Site } from '../entities/site.entity.js';
import { CreateSiteDto } from '../dto/create-site.dto.js';
import { UpdateSiteDto } from '../dto/update-site.dto.js';

@Injectable()
export class SitesService {
  constructor(
    @InjectRepository(Site)
    private repo: Repository<Site>,
  ) {}

  async create(dto: CreateSiteDto): Promise<Site> {
    const site = this.repo.create(dto);
    return this.repo.save(site);
  }

  async findAll(): Promise<Site[]> {
    return this.repo.find({ relations: ['areas'] });
  }

  async findOne(id: string): Promise<Site> {
    const site = await this.repo.findOne({ where: { id }, relations: ['areas'] });
    if (!site) throw new NotFoundException(`Site ${id} not found`);
    return site;
  }

  async update(id: string, dto: UpdateSiteDto): Promise<Site> {
    const site = await this.findOne(id);
    Object.assign(site, dto);
    return this.repo.save(site);
  }

  async remove(id: string): Promise<void> {
    const site = await this.findOne(id);
    await this.repo.remove(site);
  }
}
