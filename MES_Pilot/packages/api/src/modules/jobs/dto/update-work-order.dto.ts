import { PartialType } from '@nestjs/mapped-types';
import { CreateWorkOrderDto } from './create-work-order.dto.js';

export class UpdateWorkOrderDto extends PartialType(CreateWorkOrderDto) {}
