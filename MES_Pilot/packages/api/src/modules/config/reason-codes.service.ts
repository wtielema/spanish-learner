import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { ReasonCode } from './entities/reason-code.entity.js';
import { CreateReasonCodeDto } from './dto/create-reason-code.dto.js';
import { UpdateReasonCodeDto } from './dto/update-reason-code.dto.js';

@Injectable()
export class ReasonCodesService {
  constructor(
    @InjectRepository(ReasonCode)
    private repo: Repository<ReasonCode>,
  ) {}

  async create(dto: CreateReasonCodeDto): Promise<ReasonCode> {
    const code = this.repo.create(dto);
    return this.repo.save(code);
  }

  async findAll(): Promise<ReasonCode[]> {
    return this.repo.find();
  }

  async findOne(id: string): Promise<ReasonCode> {
    const code = await this.repo.findOne({ where: { id } });
    if (!code) throw new NotFoundException(`ReasonCode ${id} not found`);
    return code;
  }

  async update(id: string, dto: UpdateReasonCodeDto): Promise<ReasonCode> {
    const code = await this.findOne(id);
    Object.assign(code, dto);
    return this.repo.save(code);
  }

  async remove(id: string): Promise<void> {
    const code = await this.findOne(id);
    await this.repo.remove(code);
  }

  /**
   * Returns site-level (areaId = null) + area-level codes merged.
   */
  async findByArea(areaId: string): Promise<ReasonCode[]> {
    const [siteLevelCodes, areaLevelCodes] = await Promise.all([
      this.repo.find({ where: { areaId: IsNull() } }),
      this.repo.find({ where: { areaId } }),
    ]);
    return [...siteLevelCodes, ...areaLevelCodes];
  }
}
