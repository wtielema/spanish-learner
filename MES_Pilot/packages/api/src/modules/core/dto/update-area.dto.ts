import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateAreaDto } from './create-area.dto.js';

export class UpdateAreaDto extends PartialType(OmitType(CreateAreaDto, ['siteId'] as const)) {}
