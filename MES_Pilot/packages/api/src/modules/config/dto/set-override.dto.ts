import { IsOptional, IsString, IsUUID } from 'class-validator';

export class SetOverrideDto {
  @IsString()
  entityType: string;

  @IsUUID()
  @IsOptional()
  entityId?: string;

  @IsString()
  scopeType: string; // 'site' | 'area' | 'work_center'

  @IsUUID()
  scopeId: string;

  @IsString()
  key: string;

  // value can be anything (jsonb)
  value: any;
}
