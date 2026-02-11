import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from './entities/product.entity.js';
import { Material } from './entities/material.entity.js';
import { MasterRecipe } from './entities/master-recipe.entity.js';
import { RecipePhase } from './entities/recipe-phase.entity.js';
import { RecipeParameter } from './entities/recipe-parameter.entity.js';
import { RecipeMaterial } from './entities/recipe-material.entity.js';
import { ControlRecipe } from './entities/control-recipe.entity.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { CreateMaterialDto } from './dto/create-material.dto.js';
import { CreateRecipeDto } from './dto/create-recipe.dto.js';
import { UpdateRecipeDto } from './dto/update-recipe.dto.js';
import { CreatePhaseDto } from './dto/create-phase.dto.js';
import { CreateParameterDto } from './dto/create-parameter.dto.js';
import { CreateRecipeMaterialDto } from './dto/create-recipe-material.dto.js';

@Injectable()
export class RecipesService {
  constructor(
    @InjectRepository(Product)
    private productRepo: Repository<Product>,
    @InjectRepository(Material)
    private materialRepo: Repository<Material>,
    @InjectRepository(MasterRecipe)
    private recipeRepo: Repository<MasterRecipe>,
    @InjectRepository(RecipePhase)
    private phaseRepo: Repository<RecipePhase>,
    @InjectRepository(RecipeParameter)
    private parameterRepo: Repository<RecipeParameter>,
    @InjectRepository(RecipeMaterial)
    private recipeMaterialRepo: Repository<RecipeMaterial>,
    @InjectRepository(ControlRecipe)
    private controlRecipeRepo: Repository<ControlRecipe>,
  ) {}

  // ── Products ──────────────────────────────────────────

  async createProduct(dto: CreateProductDto): Promise<Product> {
    const product = this.productRepo.create(dto);
    return this.productRepo.save(product);
  }

  async findAllProducts(): Promise<Product[]> {
    return this.productRepo.find();
  }

  async findOneProduct(id: string): Promise<Product> {
    const product = await this.productRepo.findOne({ where: { id } });
    if (!product) throw new NotFoundException(`Product ${id} not found`);
    return product;
  }

  async updateProduct(id: string, dto: UpdateProductDto): Promise<Product> {
    const product = await this.findOneProduct(id);
    Object.assign(product, dto);
    return this.productRepo.save(product);
  }

  // ── Materials ─────────────────────────────────────────

  async createMaterial(dto: CreateMaterialDto): Promise<Material> {
    const material = this.materialRepo.create(dto);
    return this.materialRepo.save(material);
  }

  async findAllMaterials(): Promise<Material[]> {
    return this.materialRepo.find();
  }

  // ── Master Recipes ────────────────────────────────────

  async createRecipe(
    dto: CreateRecipeDto,
    userId: string,
  ): Promise<MasterRecipe> {
    const recipe = this.recipeRepo.create({
      ...dto,
      createdBy: userId,
      status: 'draft',
    });
    return this.recipeRepo.save(recipe);
  }

  async findAllRecipes(filters?: {
    productId?: string;
    status?: string;
    areaType?: string;
  }): Promise<MasterRecipe[]> {
    const qb = this.recipeRepo
      .createQueryBuilder('recipe')
      .leftJoinAndSelect('recipe.product', 'product')
      .leftJoinAndSelect('recipe.phases', 'phases')
      .leftJoinAndSelect('recipe.materials', 'materials');

    if (filters?.productId) {
      qb.andWhere('recipe.productId = :productId', {
        productId: filters.productId,
      });
    }
    if (filters?.status) {
      qb.andWhere('recipe.status = :status', { status: filters.status });
    }
    if (filters?.areaType) {
      qb.andWhere('recipe.areaType = :areaType', {
        areaType: filters.areaType,
      });
    }

    qb.orderBy('recipe.createdAt', 'DESC');
    return qb.getMany();
  }

  async findOneRecipe(id: string): Promise<MasterRecipe> {
    const recipe = await this.recipeRepo.findOne({
      where: { id },
      relations: [
        'product',
        'phases',
        'phases.parameters',
        'materials',
        'materials.material',
      ],
    });
    if (!recipe) throw new NotFoundException(`Recipe ${id} not found`);
    return recipe;
  }

  async updateRecipe(
    id: string,
    dto: UpdateRecipeDto,
  ): Promise<MasterRecipe> {
    const recipe = await this.findOneRecipe(id);
    if (recipe.status !== 'draft') {
      throw new BadRequestException(
        'Can only update recipes in draft status',
      );
    }
    Object.assign(recipe, dto);
    return this.recipeRepo.save(recipe);
  }

  // ── Phases ────────────────────────────────────────────

  async addPhase(
    recipeId: string,
    dto: CreatePhaseDto,
  ): Promise<RecipePhase> {
    const recipe = await this.findOneRecipe(recipeId);
    if (recipe.status !== 'draft') {
      throw new BadRequestException(
        'Can only modify recipes in draft status',
      );
    }
    const phase = this.phaseRepo.create({ ...dto, recipeId });
    return this.phaseRepo.save(phase);
  }

  async updatePhase(
    phaseId: string,
    dto: Partial<CreatePhaseDto>,
  ): Promise<RecipePhase> {
    const phase = await this.phaseRepo.findOne({
      where: { id: phaseId },
      relations: ['recipe'],
    });
    if (!phase) throw new NotFoundException(`Phase ${phaseId} not found`);
    if (phase.recipe.status !== 'draft') {
      throw new BadRequestException(
        'Can only modify recipes in draft status',
      );
    }
    Object.assign(phase, dto);
    return this.phaseRepo.save(phase);
  }

  async removePhase(phaseId: string): Promise<void> {
    const phase = await this.phaseRepo.findOne({
      where: { id: phaseId },
      relations: ['recipe'],
    });
    if (!phase) throw new NotFoundException(`Phase ${phaseId} not found`);
    if (phase.recipe.status !== 'draft') {
      throw new BadRequestException(
        'Can only modify recipes in draft status',
      );
    }
    await this.phaseRepo.remove(phase);
  }

  // ── Parameters ────────────────────────────────────────

  async addParameter(
    phaseId: string,
    dto: CreateParameterDto,
  ): Promise<RecipeParameter> {
    const phase = await this.phaseRepo.findOne({
      where: { id: phaseId },
      relations: ['recipe'],
    });
    if (!phase) throw new NotFoundException(`Phase ${phaseId} not found`);
    if (phase.recipe.status !== 'draft') {
      throw new BadRequestException(
        'Can only modify recipes in draft status',
      );
    }
    const parameter = this.parameterRepo.create({ ...dto, phaseId });
    return this.parameterRepo.save(parameter);
  }

  // ── Recipe Materials ──────────────────────────────────

  async addMaterial(
    recipeId: string,
    dto: CreateRecipeMaterialDto,
  ): Promise<RecipeMaterial> {
    const recipe = await this.findOneRecipe(recipeId);
    if (recipe.status !== 'draft') {
      throw new BadRequestException(
        'Can only modify recipes in draft status',
      );
    }
    const recipeMaterial = this.recipeMaterialRepo.create({
      ...dto,
      recipeId,
    });
    return this.recipeMaterialRepo.save(recipeMaterial);
  }

  // ── Workflow transitions ──────────────────────────────

  async submitForReview(
    recipeId: string,
    userId: string,
  ): Promise<MasterRecipe> {
    const recipe = await this.findOneRecipe(recipeId);
    if (recipe.status !== 'draft') {
      throw new BadRequestException(
        'Can only submit draft recipes for review',
      );
    }
    recipe.status = 'in_review';
    return this.recipeRepo.save(recipe);
  }

  async approve(recipeId: string, userId: string): Promise<MasterRecipe> {
    const recipe = await this.findOneRecipe(recipeId);
    if (recipe.status !== 'in_review') {
      throw new BadRequestException(
        'Can only approve recipes that are in review',
      );
    }
    // Four-eyes principle: approver must not be the creator
    if (recipe.createdBy === userId) {
      throw new ForbiddenException(
        'Four-eyes principle: the creator cannot approve their own recipe',
      );
    }
    recipe.status = 'approved';
    recipe.approvedBy = userId;
    recipe.approvedAt = new Date();
    return this.recipeRepo.save(recipe);
  }

  async activate(recipeId: string): Promise<MasterRecipe> {
    const recipe = await this.findOneRecipe(recipeId);
    if (recipe.status !== 'approved') {
      throw new BadRequestException(
        'Can only activate approved recipes',
      );
    }

    // Deactivate previous active version for the same product
    await this.recipeRepo
      .createQueryBuilder()
      .update(MasterRecipe)
      .set({ status: 'obsolete' })
      .where('productId = :productId', { productId: recipe.productId })
      .andWhere('status = :status', { status: 'active' })
      .andWhere('id != :id', { id: recipeId })
      .execute();

    recipe.status = 'active';
    return this.recipeRepo.save(recipe);
  }

  async obsolete(recipeId: string): Promise<MasterRecipe> {
    const recipe = await this.findOneRecipe(recipeId);
    if (recipe.status !== 'active') {
      throw new BadRequestException(
        'Can only obsolete active recipes',
      );
    }
    recipe.status = 'obsolete';
    return this.recipeRepo.save(recipe);
  }

  // ── Control Recipes ───────────────────────────────────

  async createControlRecipe(
    masterRecipeId: string,
    workOrderId: string,
    batchSize?: number,
  ): Promise<ControlRecipe> {
    const masterRecipe = await this.findOneRecipe(masterRecipeId);
    if (masterRecipe.status !== 'active') {
      throw new BadRequestException(
        'Can only create control recipes from active master recipes',
      );
    }

    // Snapshot the full master recipe
    const snapshot = {
      id: masterRecipe.id,
      productId: masterRecipe.productId,
      product: masterRecipe.product,
      version: masterRecipe.version,
      areaType: masterRecipe.areaType,
      applicableWorkCenters: masterRecipe.applicableWorkCenters,
      notes: masterRecipe.notes,
      phases: masterRecipe.phases.map((phase) => ({
        id: phase.id,
        sequence: phase.sequence,
        nameI18n: phase.nameI18n,
        phaseType: phase.phaseType,
        durationTargetMin: phase.durationTargetMin,
        instructionsI18n: phase.instructionsI18n,
        parameters: phase.parameters.map((param) => ({
          id: param.id,
          nameI18n: param.nameI18n,
          paramType: param.paramType,
          value: param.value,
          unit: param.unit,
          lowerLimit: param.lowerLimit,
          upperLimit: param.upperLimit,
        })),
      })),
      materials: masterRecipe.materials.map((mat) => ({
        id: mat.id,
        materialId: mat.materialId,
        material: mat.material,
        phaseId: mat.phaseId,
        quantityPerBatch: mat.quantityPerBatch,
        unit: mat.unit,
        isCritical: mat.isCritical,
        scalingType: mat.scalingType,
      })),
    };

    const controlRecipe = this.controlRecipeRepo.create({
      masterRecipeId,
      workOrderId,
      snapshot,
      ...(batchSize !== undefined ? { batchSize } : {}),
    });
    return this.controlRecipeRepo.save(controlRecipe as ControlRecipe);
  }
}
