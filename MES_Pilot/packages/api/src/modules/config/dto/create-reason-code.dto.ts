import { IsBoolean, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateReasonCodeDto {
  @IsUUID()
  @IsOptional()
  areaId?: string;

  @IsString()
  category: string;

  @IsObject()
  nameI18n: Record<string, string>;

  @IsBoolean()
  requiresComment: boolean;
}
