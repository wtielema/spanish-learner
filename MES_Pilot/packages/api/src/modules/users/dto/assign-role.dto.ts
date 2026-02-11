import { IsUUID } from 'class-validator';

export class AssignRoleDto {
  @IsUUID()
  areaId: string;

  @IsUUID()
  roleId: string;
}
