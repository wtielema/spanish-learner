import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { AssignRoleDto } from './dto/assign-role.dto.js';
import { RequirePermission } from '../auth/decorators/require-permission.decorator.js';
import { PermissionGuard } from '../auth/guards/permission.guard.js';

@Controller('api')
@UseGuards(PermissionGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('users')
  @RequirePermission('user:view')
  findAll() {
    return this.usersService.findAll();
  }

  @Get('users/:id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch('users/:id')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Post('users/:id/areas')
  @RequirePermission('user:manage')
  assignRole(@Param('id') id: string, @Body() dto: AssignRoleDto) {
    return this.usersService.assignRole(id, dto.areaId, dto.roleId);
  }

  @Delete('users/:userId/areas/:areaId')
  @RequirePermission('user:manage')
  removeRole(
    @Param('userId') userId: string,
    @Param('areaId') areaId: string,
  ) {
    return this.usersService.removeRole(userId, areaId);
  }

  @Get('users/:id/permissions')
  getPermissions(@Param('id') id: string) {
    return this.usersService.getUserPermissions(id);
  }

  @Get('roles')
  @RequirePermission('user:view')
  findAllRoles() {
    return this.usersService.findAllRoles();
  }
}
