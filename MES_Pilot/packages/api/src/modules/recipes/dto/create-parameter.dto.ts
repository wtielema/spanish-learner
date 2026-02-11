import { IsNumber, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateParameterDto {
  @IsObject()
  nameI18n: Record<string, string>;

  @IsString()
  paramType: string; // setpoint, limit, info

  @IsNumber()
  @IsOptional()
  value?: number;

  @IsString()
  @IsOptional()
  unit?: string;

  @IsNumber()
  @IsOptional()
  lowerLimit?: number;

  @IsNumber()
  @IsOptional()
  upperLimit?: number;
}
