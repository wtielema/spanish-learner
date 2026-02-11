import { Type } from 'class-transformer';
import {
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

export class CheckResultItemDto {
  @IsUUID()
  paramId: string;

  @IsString()
  value: string;

  @IsString()
  @IsOptional()
  comment?: string;
}

export class CompleteCheckDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CheckResultItemDto)
  results: CheckResultItemDto[];
}
