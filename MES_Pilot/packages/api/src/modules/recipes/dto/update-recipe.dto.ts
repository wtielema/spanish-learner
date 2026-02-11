import { PartialType } from '@nestjs/mapped-types';
import { CreateRecipeDto } from './create-recipe.dto.js';

export class UpdateRecipeDto extends PartialType(CreateRecipeDto) {}
