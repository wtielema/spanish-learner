import { IsObject, IsString, IsIn, IsOptional, IsUUID } from 'class-validator';

export class CreateAreaDto {
  @IsUUID()
  siteId: string;

  @IsObject()
  nameI18n: Record<string, string>;

  @IsIn(['batch', 'discrete', 'packaging'])
  areaType: string;

  @IsObject()
  @IsOptional()
  config?: Record<string, any>;
}
