import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateDeviationDto {
  @IsUUID()
  workOrderId: string;

  @IsUUID()
  @IsOptional()
  checkId?: string;

  @IsString()
  severity: string; // minor, major, critical

  @IsString()
  description: string;
}
