import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateQcTemplateDto {
  @IsUUID()
  @IsOptional()
  areaId?: string;

  @IsUUID()
  @IsOptional()
  productId?: string;

  @IsObject()
  nameI18n: Record<string, string>;

  @IsString()
  trigger: string; // on_start, on_complete, timed_interval, every_n_units

  @IsNumber()
  @IsOptional()
  triggerValue?: number;

  @IsBoolean()
  @IsOptional()
  isMandatory?: boolean;

  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  applicableWorkCenters?: string[];
}
