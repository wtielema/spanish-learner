import { IsObject, IsOptional, IsString } from 'class-validator';

export class CreateMaterialDto {
  @IsString()
  code: string;

  @IsObject()
  nameI18n: Record<string, string>;

  @IsString()
  @IsOptional()
  category?: string;

  @IsString()
  unitOfMeasure: string;
}
