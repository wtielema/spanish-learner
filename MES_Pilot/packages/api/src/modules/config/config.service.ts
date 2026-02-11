import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigOverride } from './entities/config-override.entity.js';
import { WorkCenter } from '../core/entities/work-center.entity.js';
import { Area } from '../core/entities/area.entity.js';
import { SetOverrideDto } from './dto/set-override.dto.js';

@Injectable()
export class MesConfigService {
  constructor(
    @InjectRepository(ConfigOverride)
    private overrideRepo: Repository<ConfigOverride>,
    @InjectRepository(WorkCenter)
    private workCenterRepo: Repository<WorkCenter>,
  ) {}

  /**
   * Three-tier config resolution:
   * site defaults -> area overrides -> work center overrides
   */
  async getResolvedConfig(
    workCenterId: string,
  ): Promise<Record<string, any>> {
    // Load work center with area and site
    const workCenter = await this.workCenterRepo.findOne({
      where: { id: workCenterId },
      relations: ['area', 'area.site'],
    });
    if (!workCenter) {
      throw new NotFoundException(
        `WorkCenter ${workCenterId} not found`,
      );
    }

    const area = workCenter.area;
    const site = area.site;

    // Get overrides at each level
    const siteOverrides = await this.overrideRepo.find({
      where: { scopeType: 'site', scopeId: site.id },
    });
    const areaOverrides = await this.overrideRepo.find({
      where: { scopeType: 'area', scopeId: area.id },
    });
    const wcOverrides = await this.overrideRepo.find({
      where: { scopeType: 'work_center', scopeId: workCenterId },
    });

    // Merge: site defaults -> area overrides -> work center overrides
    const resolved: Record<string, any> = {};

    for (const o of siteOverrides) {
      resolved[o.key] = o.value;
    }
    for (const o of areaOverrides) {
      resolved[o.key] = o.value;
    }
    for (const o of wcOverrides) {
      resolved[o.key] = o.value;
    }

    return resolved;
  }

  async setOverride(dto: SetOverrideDto): Promise<ConfigOverride> {
    // Upsert: find existing override for same scope + key
    const existing = await this.overrideRepo.findOne({
      where: {
        scopeType: dto.scopeType,
        scopeId: dto.scopeId,
        key: dto.key,
      },
    });

    if (existing) {
      existing.value = dto.value;
      return this.overrideRepo.save(existing);
    }

    const override = this.overrideRepo.create(dto);
    return this.overrideRepo.save(override);
  }

  async removeOverride(id: string): Promise<void> {
    const override = await this.overrideRepo.findOne({ where: { id } });
    if (!override) {
      throw new NotFoundException(`ConfigOverride ${id} not found`);
    }
    await this.overrideRepo.remove(override);
  }
}
