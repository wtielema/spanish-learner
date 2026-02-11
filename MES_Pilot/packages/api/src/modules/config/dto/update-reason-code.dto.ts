import { PartialType } from '@nestjs/mapped-types';
import { CreateReasonCodeDto } from './create-reason-code.dto.js';

export class UpdateReasonCodeDto extends PartialType(CreateReasonCodeDto) {}
