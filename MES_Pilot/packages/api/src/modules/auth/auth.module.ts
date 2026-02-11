import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity.js';
import { UserArea } from '../users/entities/user-area.entity.js';
import { Role } from '../users/entities/role.entity.js';
import { DevStrategy } from './strategies/dev.strategy.js';
import { PermissionGuard } from './guards/permission.guard.js';
import { SessionSerializer } from './session.serializer.js';
import { AuthController } from './auth.controller.js';

@Module({
  imports: [
    PassportModule.register({ session: true }),
    TypeOrmModule.forFeature([User, UserArea, Role]),
  ],
  controllers: [AuthController],
  providers: [DevStrategy, PermissionGuard, SessionSerializer],
  exports: [PermissionGuard],
})
export class AuthModule {}
