import { IsBoolean, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateProductDto {
  @IsString()
  sku: string;

  @IsObject()
  nameI18n: Record<string, string>;

  @IsObject()
  @IsOptional()
  descriptionI18n?: Record<string, string>;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
