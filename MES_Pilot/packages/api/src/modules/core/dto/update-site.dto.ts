import { PartialType } from '@nestjs/mapped-types';
import { CreateSiteDto } from './create-site.dto.js';

export class UpdateSiteDto extends PartialType(CreateSiteDto) {}
