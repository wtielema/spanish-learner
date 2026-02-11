import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { WorkOrder } from './entities/work-order.entity.js';
import { WorkOrderStep } from './entities/work-order-step.entity.js';
import { ProductionLog } from './entities/production-log.entity.js';
import { RecipesService } from '../recipes/recipes.service.js';
import { CreateWorkOrderDto } from './dto/create-work-order.dto.js';
import { UpdateWorkOrderDto } from './dto/update-work-order.dto.js';
import { LogProductionDto } from './dto/log-production.dto.js';

@Injectable()
export class JobsService {
  constructor(
    @InjectRepository(WorkOrder)
    private workOrderRepo: Repository<WorkOrder>,
    @InjectRepository(WorkOrderStep)
    private stepRepo: Repository<WorkOrderStep>,
    @InjectRepository(ProductionLog)
    private productionLogRepo: Repository<ProductionLog>,
    private recipesService: RecipesService,
    private eventEmitter: EventEmitter2,
  ) {}

  // ── Create ─────────────────────────────────────────────

  async create(
    dto: CreateWorkOrderDto,
    userId: string,
  ): Promise<WorkOrder> {
    const orderNumber = `WO-${Date.now()}`;
    const workOrder = this.workOrderRepo.create({
      ...dto,
      orderNumber,
      createdBy: userId,
      status: 'draft',
    });
    return this.workOrderRepo.save(workOrder);
  }

  // ── Find All ───────────────────────────────────────────

  async findAll(filters: {
    areaId?: string;
    status?: string;
    workCenterId?: string;
  }): Promise<WorkOrder[]> {
    const qb = this.workOrderRepo
      .createQueryBuilder('wo')
      .leftJoinAndSelect('wo.product', 'product');

    if (filters.areaId) {
      qb.andWhere('wo.areaId = :areaId', { areaId: filters.areaId });
    }
    if (filters.status) {
      qb.andWhere('wo.status = :status', { status: filters.status });
    }
    if (filters.workCenterId) {
      qb.andWhere('wo.workCenterId = :workCenterId', {
        workCenterId: filters.workCenterId,
      });
    }

    qb.orderBy('wo.createdAt', 'DESC');
    return qb.getMany();
  }

  // ── Find One ───────────────────────────────────────────

  async findOne(id: string): Promise<WorkOrder> {
    const workOrder = await this.workOrderRepo.findOne({
      where: { id },
      relations: ['steps', 'productionLogs', 'product', 'workCenter'],
    });
    if (!workOrder) {
      throw new NotFoundException(`Work order ${id} not found`);
    }
    return workOrder;
  }

  // ── Update ─────────────────────────────────────────────

  async update(
    id: string,
    dto: UpdateWorkOrderDto,
  ): Promise<WorkOrder> {
    const workOrder = await this.findOne(id);
    Object.assign(workOrder, dto);
    return this.workOrderRepo.save(workOrder);
  }

  // ── Release ────────────────────────────────────────────

  async release(workOrderId: string): Promise<WorkOrder> {
    const workOrder = await this.findOne(workOrderId);

    if (workOrder.status !== 'draft') {
      throw new BadRequestException(
        'Can only release work orders in draft status',
      );
    }

    // Find the active master recipe for this product
    const recipes = await this.recipesService.findAllRecipes({
      productId: workOrder.productId,
      status: 'active',
    });

    if (recipes.length === 0) {
      throw new BadRequestException(
        `No active recipe found for product ${workOrder.productId}`,
      );
    }

    const masterRecipe = recipes[0];

    // Create a control recipe snapshot for this work order
    const controlRecipe = await this.recipesService.createControlRecipe(
      masterRecipe.id,
      workOrder.id,
      Number(workOrder.quantityTarget),
    );

    workOrder.controlRecipeId = controlRecipe.id;
    workOrder.status = 'released';
    return this.workOrderRepo.save(workOrder);
  }

  // ── Start ──────────────────────────────────────────────

  async start(
    workOrderId: string,
    userId: string,
  ): Promise<WorkOrder> {
    const workOrder = await this.findOne(workOrderId);

    if (workOrder.status !== 'released') {
      throw new BadRequestException(
        'Can only start work orders in released status',
      );
    }

    workOrder.actualStart = new Date();
    workOrder.status = 'started';
    const saved = await this.workOrderRepo.save(workOrder);

    this.eventEmitter.emit('work-order.started', {
      workOrderId,
      areaId: workOrder.areaId,
      workCenterId: workOrder.workCenterId,
    });

    return saved;
  }

  // ── Log Production ─────────────────────────────────────

  async logProduction(
    workOrderId: string,
    dto: LogProductionDto,
    userId: string,
  ): Promise<ProductionLog> {
    const workOrder = await this.findOne(workOrderId);

    const log = this.productionLogRepo.create({
      workOrderId,
      eventType: dto.eventType,
      value: dto.value,
      reasonCodeId: dto.reasonCodeId,
      workUnitId: dto.workUnitId,
      operatorId: userId,
      comment: dto.comment,
    });
    const savedLog = await this.productionLogRepo.save(log);

    // Update quantities on the work order based on event type
    if (dto.eventType === 'count' && dto.value != null) {
      workOrder.quantityProduced = Number(workOrder.quantityProduced) + Number(dto.value);
      await this.workOrderRepo.save(workOrder);
    } else if (dto.eventType === 'reject' && dto.value != null) {
      workOrder.quantityRejected = Number(workOrder.quantityRejected) + Number(dto.value);
      await this.workOrderRepo.save(workOrder);
    }

    this.eventEmitter.emit('production.count-updated', {
      workOrderId,
      areaId: workOrder.areaId,
      quantityProduced: workOrder.quantityProduced,
      quantityTarget: workOrder.quantityTarget,
    });

    return savedLog;
  }

  // ── Get Production Logs ────────────────────────────────

  async getProductionLogs(workOrderId: string): Promise<ProductionLog[]> {
    return this.productionLogRepo.find({
      where: { workOrderId },
      order: { timestamp: 'DESC' },
    });
  }

  // ── Complete ───────────────────────────────────────────

  async complete(
    workOrderId: string,
    userId: string,
  ): Promise<WorkOrder> {
    const workOrder = await this.findOne(workOrderId);

    if (workOrder.status !== 'started' && workOrder.status !== 'in_progress') {
      throw new BadRequestException(
        'Can only complete work orders that are started or in progress',
      );
    }

    workOrder.actualEnd = new Date();
    workOrder.status = 'completed';
    const saved = await this.workOrderRepo.save(workOrder);

    this.eventEmitter.emit('work-order.status-changed', {
      workOrderId,
      status: 'completed',
      workCenterId: workOrder.workCenterId,
      areaId: workOrder.areaId,
    });

    return saved;
  }

  // ── Hold ───────────────────────────────────────────────

  async hold(
    workOrderId: string,
    reason: string,
    userId: string,
  ): Promise<WorkOrder> {
    const workOrder = await this.findOne(workOrderId);

    workOrder.status = 'on_hold';
    const saved = await this.workOrderRepo.save(workOrder);

    this.eventEmitter.emit('work-order.status-changed', {
      workOrderId,
      status: 'on_hold',
      workCenterId: workOrder.workCenterId,
      areaId: workOrder.areaId,
    });

    return saved;
  }

  // ── Resume ─────────────────────────────────────────────

  async resume(
    workOrderId: string,
    userId: string,
  ): Promise<WorkOrder> {
    const workOrder = await this.findOne(workOrderId);

    if (workOrder.status !== 'on_hold') {
      throw new BadRequestException(
        'Can only resume work orders that are on hold',
      );
    }

    workOrder.status = 'started';
    const saved = await this.workOrderRepo.save(workOrder);

    this.eventEmitter.emit('work-order.status-changed', {
      workOrderId,
      status: 'started',
      workCenterId: workOrder.workCenterId,
      areaId: workOrder.areaId,
    });

    return saved;
  }
}
