import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { QcTemplate } from './entities/qc-template.entity.js';
import { QcTemplateParam } from './entities/qc-template-param.entity.js';
import { QcCheck } from './entities/qc-check.entity.js';
import { QcResult } from './entities/qc-result.entity.js';
import { QcDeviation } from './entities/qc-deviation.entity.js';
import { QcHold } from './entities/qc-hold.entity.js';
import { CreateQcTemplateDto } from './dto/create-qc-template.dto.js';
import { CreateQcTemplateParamDto } from './dto/create-qc-template-param.dto.js';
import { CompleteCheckDto } from './dto/complete-check.dto.js';
import { CreateDeviationDto } from './dto/create-deviation.dto.js';
import { PlaceHoldDto } from './dto/place-hold.dto.js';
import { ReleaseHoldDto } from './dto/release-hold.dto.js';

@Injectable()
export class QualityService {
  constructor(
    @InjectRepository(QcTemplate)
    private templateRepo: Repository<QcTemplate>,
    @InjectRepository(QcTemplateParam)
    private paramRepo: Repository<QcTemplateParam>,
    @InjectRepository(QcCheck)
    private checkRepo: Repository<QcCheck>,
    @InjectRepository(QcResult)
    private resultRepo: Repository<QcResult>,
    @InjectRepository(QcDeviation)
    private deviationRepo: Repository<QcDeviation>,
    @InjectRepository(QcHold)
    private holdRepo: Repository<QcHold>,
    private eventEmitter: EventEmitter2,
  ) {}

  // ── Templates ──────────────────────────────────────────

  async createTemplate(dto: CreateQcTemplateDto): Promise<QcTemplate> {
    const template = this.templateRepo.create(dto);
    return this.templateRepo.save(template);
  }

  async findAllTemplates(filters?: {
    areaId?: string;
    productId?: string;
  }): Promise<QcTemplate[]> {
    const qb = this.templateRepo
      .createQueryBuilder('template')
      .leftJoinAndSelect('template.params', 'params')
      .orderBy('template.createdAt', 'DESC')
      .addOrderBy('params.sequence', 'ASC');

    if (filters?.areaId) {
      qb.andWhere('template.areaId = :areaId', { areaId: filters.areaId });
    }
    if (filters?.productId) {
      qb.andWhere('template.productId = :productId', {
        productId: filters.productId,
      });
    }

    return qb.getMany();
  }

  async findOneTemplate(id: string): Promise<QcTemplate> {
    const template = await this.templateRepo.findOne({
      where: { id },
      relations: ['params'],
    });
    if (!template) throw new NotFoundException(`QC template ${id} not found`);
    return template;
  }

  async addTemplateParam(
    templateId: string,
    dto: CreateQcTemplateParamDto,
  ): Promise<QcTemplateParam> {
    await this.findOneTemplate(templateId); // ensure template exists
    const param = this.paramRepo.create({ ...dto, templateId });
    return this.paramRepo.save(param);
  }

  async assignToWorkCenters(
    templateId: string,
    workCenterIds: string[],
  ): Promise<QcTemplate> {
    const template = await this.findOneTemplate(templateId);
    template.applicableWorkCenters = workCenterIds;
    return this.templateRepo.save(template);
  }

  // ── Check generation ───────────────────────────────────

  async generateChecks(
    workOrderId: string,
    areaId: string,
    productId?: string,
  ): Promise<QcCheck[]> {
    // Find applicable templates for the area (and optionally product)
    const qb = this.templateRepo
      .createQueryBuilder('template')
      .leftJoinAndSelect('template.params', 'params')
      .where('template.areaId = :areaId', { areaId });

    if (productId) {
      qb.andWhere(
        '(template.productId = :productId OR template.productId IS NULL)',
        { productId },
      );
    } else {
      qb.andWhere('template.productId IS NULL');
    }

    const templates = await qb.getMany();
    const checks: QcCheck[] = [];

    for (const template of templates) {
      const check = this.checkRepo.create({
        workOrderId,
        templateId: template.id,
        status: 'pending',
        ...(template.trigger === 'timed_interval'
          ? { scheduledAt: new Date() }
          : {}),
      });
      const saved = await this.checkRepo.save(check);
      checks.push(saved);
    }

    return checks;
  }

  // ── Checks ─────────────────────────────────────────────

  async getDueChecks(workOrderId: string): Promise<QcCheck[]> {
    return this.checkRepo.find({
      where: [
        { workOrderId, status: 'pending' },
        { workOrderId, status: 'due' },
      ],
      relations: ['template', 'template.params', 'results'],
      order: { createdAt: 'ASC' },
    });
  }

  async completeCheck(
    checkId: string,
    dto: CompleteCheckDto,
    userId: string,
  ): Promise<QcCheck> {
    const check = await this.checkRepo.findOne({
      where: { id: checkId },
      relations: ['template', 'template.params'],
    });
    if (!check) throw new NotFoundException(`QC check ${checkId} not found`);

    // Build a map of params for limit evaluation
    const paramMap = new Map<string, QcTemplateParam>();
    for (const param of check.template.params) {
      paramMap.set(param.id, param);
    }

    let allInSpec = true;
    const results: QcResult[] = [];

    for (const item of dto.results) {
      const templateParam = paramMap.get(item.paramId);
      let isInSpec: boolean | null = null;

      if (templateParam && templateParam.paramType === 'numeric') {
        const numericValue = parseFloat(item.value);
        if (!isNaN(numericValue)) {
          const aboveLower =
            templateParam.lowerLimit == null ||
            numericValue >= Number(templateParam.lowerLimit);
          const belowUpper =
            templateParam.upperLimit == null ||
            numericValue <= Number(templateParam.upperLimit);
          isInSpec = aboveLower && belowUpper;
        }
      } else if (templateParam && templateParam.paramType === 'boolean') {
        // For boolean params, check against target if available
        if (templateParam.targetValue != null) {
          isInSpec =
            item.value === String(Boolean(Number(templateParam.targetValue)));
        } else {
          isInSpec = true;
        }
      } else {
        // text / selection: always in spec unless explicitly out
        isInSpec = true;
      }

      if (isInSpec === false) {
        allInSpec = false;
      }

      const result = this.resultRepo.create({
        checkId,
        paramId: item.paramId,
        value: item.value,
        ...(isInSpec != null ? { isInSpec } : {}),
        ...(item.comment ? { comment: item.comment } : {}),
      });
      results.push(result);
    }

    for (const result of results) {
      await this.resultRepo.save(result);
    }

    // Update check status
    check.status = allInSpec ? 'passed' : 'failed';
    check.completedAt = new Date();
    check.operatorId = userId;
    const savedCheck = await this.checkRepo.save(check);

    // If any result is out of spec, auto-create a deviation
    if (!allInSpec) {
      const outOfSpecParams = dto.results
        .filter((r) => {
          const tp = paramMap.get(r.paramId);
          if (!tp || tp.paramType !== 'numeric') return false;
          const val = parseFloat(r.value);
          if (isNaN(val)) return false;
          const aboveLower =
            tp.lowerLimit == null || val >= Number(tp.lowerLimit);
          const belowUpper =
            tp.upperLimit == null || val <= Number(tp.upperLimit);
          return !(aboveLower && belowUpper);
        })
        .map((r) => {
          const tp = paramMap.get(r.paramId);
          const name =
            tp?.nameI18n?.en || tp?.nameI18n?.es || r.paramId;
          return `${name}: ${r.value} (limits: ${tp?.lowerLimit ?? '-'} - ${tp?.upperLimit ?? '-'})`;
        });

      const description = `Auto-deviation: QC check failed. Out-of-spec parameters: ${outOfSpecParams.join('; ')}`;

      await this.createDeviation(
        {
          workOrderId: check.workOrderId,
          checkId: check.id,
          severity: 'major',
          description,
        },
        userId,
      );
    }

    return savedCheck;
  }

  // ── Deviations ─────────────────────────────────────────

  async createDeviation(
    dto: CreateDeviationDto,
    userId: string,
  ): Promise<QcDeviation> {
    const deviation = this.deviationRepo.create({
      ...dto,
      createdBy: userId,
    });
    const saved = await this.deviationRepo.save(deviation);

    if (dto.severity === 'critical') {
      this.eventEmitter.emit('qc.deviation-raised', {
        deviationId: saved.id,
        severity: saved.severity,
        workOrderId: saved.workOrderId,
      });
    }

    return saved;
  }

  async findDeviations(filters?: {
    workOrderId?: string;
  }): Promise<QcDeviation[]> {
    const where: Record<string, unknown> = {};
    if (filters?.workOrderId) {
      where.workOrderId = filters.workOrderId;
    }
    return this.deviationRepo.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  // ── Holds ──────────────────────────────────────────────

  async placeHold(dto: PlaceHoldDto, userId: string): Promise<QcHold> {
    const hold = this.holdRepo.create({
      ...dto,
      placedBy: userId,
    });
    return this.holdRepo.save(hold);
  }

  async releaseHold(
    holdId: string,
    dto: ReleaseHoldDto,
    userId: string,
  ): Promise<QcHold> {
    const hold = await this.holdRepo.findOne({ where: { id: holdId } });
    if (!hold) throw new NotFoundException(`QC hold ${holdId} not found`);

    hold.releasedBy = userId;
    hold.releasedAt = new Date();
    hold.disposition = dto.disposition;
    hold.justification = dto.justification;
    return this.holdRepo.save(hold);
  }

  async findHolds(filters?: {
    workOrderId?: string;
    active?: boolean;
  }): Promise<QcHold[]> {
    const qb = this.holdRepo
      .createQueryBuilder('hold')
      .orderBy('hold.placedAt', 'DESC');

    if (filters?.workOrderId) {
      qb.andWhere('hold.workOrderId = :workOrderId', {
        workOrderId: filters.workOrderId,
      });
    }
    if (filters?.active === true) {
      qb.andWhere('hold.releasedAt IS NULL');
    } else if (filters?.active === false) {
      qb.andWhere('hold.releasedAt IS NOT NULL');
    }

    return qb.getMany();
  }

  // ── Event Listeners ────────────────────────────────────

  @OnEvent('work-order.started')
  async handleWorkOrderStarted(payload: {
    workOrderId: string;
    areaId: string;
    workCenterId: string;
  }): Promise<void> {
    await this.generateChecks(payload.workOrderId, payload.areaId);
  }
}
