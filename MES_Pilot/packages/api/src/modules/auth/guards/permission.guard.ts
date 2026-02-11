import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserArea } from '../../users/entities/user-area.entity.js';
import { PERMISSION_KEY } from '../decorators/require-permission.decorator.js';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @InjectRepository(UserArea)
    private userAreaRepo: Repository<UserArea>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const permission = this.reflector.getAllAndOverride<string>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!permission) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user) throw new ForbiddenException('Not authenticated');

    const areaId = request.params.areaId || request.query.areaId || request.body?.areaId;

    const userAreas = await this.userAreaRepo.find({
      where: { userId: user.id },
      relations: ['role'],
    });

    if (areaId) {
      const assignment = userAreas.find((ua) => ua.areaId === areaId);
      if (!assignment || !assignment.role.permissions.includes(permission)) {
        throw new ForbiddenException(`Missing permission: ${permission} in area ${areaId}`);
      }
    } else {
      const hasPermission = userAreas.some((ua) => ua.role.permissions.includes(permission));
      if (!hasPermission) {
        throw new ForbiddenException(`Missing permission: ${permission}`);
      }
      request.allowedAreaIds = userAreas
        .filter((ua) => ua.role.permissions.includes(permission))
        .map((ua) => ua.areaId);
    }

    return true;
  }
}
