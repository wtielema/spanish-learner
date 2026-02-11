import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateWorkUnitDto } from './create-work-unit.dto.js';

export class UpdateWorkUnitDto extends PartialType(OmitType(CreateWorkUnitDto, ['workCenterId'] as const)) {}
