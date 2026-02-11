import { IsObject, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateWorkUnitDto {
  @IsUUID()
  workCenterId: string;

  @IsObject()
  nameI18n: Record<string, string>;

  @IsString()
  @IsOptional()
  unitType?: string;
}
