import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from './entities/product.entity.js';
import { Material } from './entities/material.entity.js';
import { MasterRecipe } from './entities/master-recipe.entity.js';
import { RecipePhase } from './entities/recipe-phase.entity.js';
import { RecipeParameter } from './entities/recipe-parameter.entity.js';
import { RecipeMaterial } from './entities/recipe-material.entity.js';
import { ControlRecipe } from './entities/control-recipe.entity.js';
import { UserArea } from '../users/entities/user-area.entity.js';
import { RecipesService } from './recipes.service.js';
import { RecipesController } from './recipes.controller.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Product,
      Material,
      MasterRecipe,
      RecipePhase,
      RecipeParameter,
      RecipeMaterial,
      ControlRecipe,
      UserArea,
    ]),
  ],
  controllers: [RecipesController],
  providers: [RecipesService],
  exports: [RecipesService],
})
export class RecipesModule {}
