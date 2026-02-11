import { IsString, IsNumber, IsUUID, IsOptional } from 'class-validator';

export class LogProductionDto {
  @IsString()
  eventType: string; // count, reject, downtime, note

  @IsNumber()
  @IsOptional()
  value?: number;

  @IsUUID()
  @IsOptional()
  reasonCodeId?: string;

  @IsUUID()
  @IsOptional()
  workUnitId?: string;

  @IsString()
  @IsOptional()
  comment?: string;
}
