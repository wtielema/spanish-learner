import { IsObject, IsOptional, IsString } from 'class-validator';

export class CreateSiteDto {
  @IsObject()
  nameI18n: Record<string, string>;

  @IsString()
  @IsOptional()
  timezone?: string;

  @IsString()
  @IsOptional()
  locale?: string;
}
