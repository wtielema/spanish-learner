import { IsOptional, IsString, IsUUID } from 'class-validator';

export class PlaceHoldDto {
  @IsUUID()
  workOrderId: string;

  @IsUUID()
  @IsOptional()
  deviationId?: string;

  @IsString()
  holdType: string; // quality, material
}
