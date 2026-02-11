import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateWorkCenterDto } from './create-work-center.dto.js';

export class UpdateWorkCenterDto extends PartialType(OmitType(CreateWorkCenterDto, ['areaId'] as const)) {}
