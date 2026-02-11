import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity.js';
import { UserArea } from './entities/user-area.entity.js';
import { Role } from './entities/role.entity.js';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(UserArea) private userAreaRepo: Repository<UserArea>,
    @InjectRepository(Role) private roleRepo: Repository<Role>,
  ) {}

  async findAll(): Promise<User[]> {
    return this.userRepo.find({ relations: ['userAreas', 'userAreas.role'] });
  }

  async findOne(id: string): Promise<User> {
    const user = await this.userRepo.findOne({
      where: { id },
      relations: ['userAreas', 'userAreas.role'],
    });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }

  async findByArea(areaId: string): Promise<User[]> {
    const userAreas = await this.userAreaRepo.find({
      where: { areaId },
      relations: ['user', 'role'],
    });
    return userAreas.map(
      (ua) => ({ ...ua.user, role: ua.role }) as any,
    );
  }

  async update(
    id: string,
    dto: { displayName?: string; preferredLocale?: string },
  ): Promise<User> {
    const user = await this.findOne(id);
    Object.assign(user, dto);
    return this.userRepo.save(user);
  }

  async assignRole(
    userId: string,
    areaId: string,
    roleId: string,
  ): Promise<UserArea> {
    // Remove existing assignment for this user+area if any
    await this.userAreaRepo.delete({ userId, areaId });
    const assignment = this.userAreaRepo.create({ userId, areaId, roleId });
    return this.userAreaRepo.save(assignment);
  }

  async removeRole(userId: string, areaId: string): Promise<void> {
    await this.userAreaRepo.delete({ userId, areaId });
  }

  async getUserPermissions(
    userId: string,
  ): Promise<{ areaId: string; areaName?: string; permissions: string[] }[]> {
    const userAreas = await this.userAreaRepo.find({
      where: { userId },
      relations: ['role'],
    });
    return userAreas.map((ua) => ({
      areaId: ua.areaId,
      permissions: ua.role.permissions,
    }));
  }

  async findAllRoles(): Promise<Role[]> {
    return this.roleRepo.find();
  }
}
