import { IsString } from 'class-validator';

export class ReleaseHoldDto {
  @IsString()
  disposition: string; // release, rework, scrap

  @IsString()
  justification: string;
}
