import { Injectable } from '@nestjs/common';
import { PassportSerializer } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity.js';

@Injectable()
export class SessionSerializer extends PassportSerializer {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
  ) {
    super();
  }

  serializeUser(user: User, done: (err: Error | null, id?: string) => void): void {
    done(null, user.id);
  }

  async deserializeUser(userId: string, done: (err: Error | null, user?: User | null) => void): Promise<void> {
    try {
      const user = await this.userRepo.findOne({ where: { id: userId } });
      done(null, user || null);
    } catch (err) {
      done(err as Error);
    }
  }
}
