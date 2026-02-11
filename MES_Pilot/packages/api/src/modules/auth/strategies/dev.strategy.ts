import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../users/entities/user.entity.js';

@Injectable()
export class DevStrategy extends PassportStrategy(Strategy, 'dev') {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
  ) {
    super({ usernameField: 'email', passwordField: 'email' });
  }

  async validate(email: string): Promise<User> {
    let user = await this.userRepo.findOne({ where: { email } });
    if (!user) {
      user = this.userRepo.create({
        email,
        displayName: email.split('@')[0],
        isActive: true,
      });
      await this.userRepo.save(user);
    }
    if (!user.isActive) {
      throw new UnauthorizedException('User is deactivated');
    }
    return user;
  }
}
