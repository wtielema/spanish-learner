import { IsUUID, IsNumber, IsOptional, IsDateString, IsInt } from 'class-validator';

export class CreateWorkOrderDto {
  @IsUUID()
  productId: string;

  @IsUUID()
  areaId: string;

  @IsUUID()
  workCenterId: string;

  @IsNumber()
  quantityTarget: number;

  @IsInt()
  @IsOptional()
  priority?: number;

  @IsDateString()
  @IsOptional()
  scheduledStart?: string;
}
