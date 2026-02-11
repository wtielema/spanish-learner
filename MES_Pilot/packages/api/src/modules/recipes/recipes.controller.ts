import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { RecipesService } from './recipes.service.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { CreateMaterialDto } from './dto/create-material.dto.js';
import { CreateRecipeDto } from './dto/create-recipe.dto.js';
import { UpdateRecipeDto } from './dto/update-recipe.dto.js';
import { CreatePhaseDto } from './dto/create-phase.dto.js';
import { CreateParameterDto } from './dto/create-parameter.dto.js';
import { CreateRecipeMaterialDto } from './dto/create-recipe-material.dto.js';
import { RequirePermission } from '../auth/decorators/require-permission.decorator.js';
import { PermissionGuard } from '../auth/guards/permission.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { User } from '../users/entities/user.entity.js';

@Controller('api')
@UseGuards(PermissionGuard)
export class RecipesController {
  constructor(private recipesService: RecipesService) {}

  // ── Products ──────────────────────────────────────────

  @Get('products')
  @RequirePermission('recipe:view')
  findAllProducts() {
    return this.recipesService.findAllProducts();
  }

  @Post('products')
  @RequirePermission('recipe:edit')
  createProduct(@Body() dto: CreateProductDto) {
    return this.recipesService.createProduct(dto);
  }

  @Patch('products/:id')
  @RequirePermission('recipe:edit')
  updateProduct(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.recipesService.updateProduct(id, dto);
  }

  // ── Materials ─────────────────────────────────────────

  @Get('materials')
  @RequirePermission('recipe:view')
  findAllMaterials() {
    return this.recipesService.findAllMaterials();
  }

  @Post('materials')
  @RequirePermission('recipe:edit')
  createMaterial(@Body() dto: CreateMaterialDto) {
    return this.recipesService.createMaterial(dto);
  }

  // ── Recipes ───────────────────────────────────────────

  @Get('recipes')
  @RequirePermission('recipe:view')
  findAllRecipes(
    @Query('productId') productId?: string,
    @Query('status') status?: string,
    @Query('areaType') areaType?: string,
  ) {
    return this.recipesService.findAllRecipes({
      productId,
      status,
      areaType,
    });
  }

  @Post('recipes')
  @RequirePermission('recipe:edit')
  createRecipe(@Body() dto: CreateRecipeDto, @CurrentUser() user: User) {
    return this.recipesService.createRecipe(dto, user.id);
  }

  @Get('recipes/:id')
  @RequirePermission('recipe:view')
  findOneRecipe(@Param('id') id: string) {
    return this.recipesService.findOneRecipe(id);
  }

  @Patch('recipes/:id')
  @RequirePermission('recipe:edit')
  updateRecipe(@Param('id') id: string, @Body() dto: UpdateRecipeDto) {
    return this.recipesService.updateRecipe(id, dto);
  }

  // ── Phases ────────────────────────────────────────────

  @Post('recipes/:id/phases')
  @RequirePermission('recipe:edit')
  addPhase(@Param('id') id: string, @Body() dto: CreatePhaseDto) {
    return this.recipesService.addPhase(id, dto);
  }

  // ── Materials on Recipe ───────────────────────────────

  @Post('recipes/:id/materials')
  @RequirePermission('recipe:edit')
  addMaterial(
    @Param('id') id: string,
    @Body() dto: CreateRecipeMaterialDto,
  ) {
    return this.recipesService.addMaterial(id, dto);
  }

  // ── Parameters on Phase ───────────────────────────────

  @Post('recipes/phases/:phaseId/parameters')
  @RequirePermission('recipe:edit')
  addParameter(
    @Param('phaseId') phaseId: string,
    @Body() dto: CreateParameterDto,
  ) {
    return this.recipesService.addParameter(phaseId, dto);
  }

  // ── Workflow ──────────────────────────────────────────

  @Post('recipes/:id/submit')
  @RequirePermission('recipe:edit')
  submitForReview(@Param('id') id: string, @CurrentUser() user: User) {
    return this.recipesService.submitForReview(id, user.id);
  }

  @Post('recipes/:id/approve')
  @RequirePermission('recipe:approve')
  approve(@Param('id') id: string, @CurrentUser() user: User) {
    return this.recipesService.approve(id, user.id);
  }

  @Post('recipes/:id/activate')
  @RequirePermission('recipe:approve')
  activate(@Param('id') id: string) {
    return this.recipesService.activate(id);
  }

  @Post('recipes/:id/obsolete')
  @RequirePermission('recipe:obsolete')
  obsolete(@Param('id') id: string) {
    return this.recipesService.obsolete(id);
  }
}
