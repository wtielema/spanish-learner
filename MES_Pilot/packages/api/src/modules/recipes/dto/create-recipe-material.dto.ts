import { IsBoolean, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateRecipeMaterialDto {
  @IsUUID()
  @IsOptional()
  phaseId?: string;

  @IsUUID()
  materialId: string;

  @IsNumber()
  quantityPerBatch: number;

  @IsString()
  unit: string;

  @IsBoolean()
  @IsOptional()
  isCritical?: boolean;

  @IsString()
  @IsOptional()
  scalingType?: string; // linear, fixed
}
