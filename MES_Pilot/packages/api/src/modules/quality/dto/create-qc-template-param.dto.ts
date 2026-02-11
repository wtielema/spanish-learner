import {
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateQcTemplateParamDto {
  @IsObject()
  nameI18n: Record<string, string>;

  @IsString()
  paramType: string; // numeric, boolean, text, selection

  @IsString()
  @IsOptional()
  unit?: string;

  @IsNumber()
  @IsOptional()
  targetValue?: number;

  @IsNumber()
  @IsOptional()
  lowerLimit?: number;

  @IsNumber()
  @IsOptional()
  upperLimit?: number;

  @IsObject()
  @IsOptional()
  optionsI18n?: Record<string, string[]>;

  @IsInt()
  @IsOptional()
  sequence?: number;
}
