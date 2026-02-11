import { IsObject, IsOptional, IsUUID } from 'class-validator';

export class CreateWorkCenterDto {
  @IsUUID()
  areaId: string;

  @IsObject()
  nameI18n: Record<string, string>;

  @IsObject()
  @IsOptional()
  descriptionI18n?: Record<string, string>;
}
