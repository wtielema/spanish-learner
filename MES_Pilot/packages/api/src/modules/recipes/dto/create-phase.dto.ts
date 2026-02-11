import { IsInt, IsObject, IsOptional, IsString } from 'class-validator';

export class CreatePhaseDto {
  @IsInt()
  sequence: number;

  @IsObject()
  nameI18n: Record<string, string>;

  @IsString()
  phaseType: string; // preparation, processing, finishing, cleaning

  @IsInt()
  @IsOptional()
  durationTargetMin?: number;

  @IsObject()
  @IsOptional()
  instructionsI18n?: Record<string, string>;
}
