import { IsArray, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateRecipeDto {
  @IsUUID()
  productId: string;

  @IsString()
  areaType: string;

  @IsArray()
  @IsUUID(undefined, { each: true })
  @IsOptional()
  applicableWorkCenters?: string[];

  @IsString()
  @IsOptional()
  notes?: string;
}
