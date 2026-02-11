import { Controller, Post, Body, Req, UseGuards, Get, HttpCode } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from './decorators/current-user.decorator.js';
import { User } from '../users/entities/user.entity.js';

@Controller('api/auth')
export class AuthController {
  @Post('dev-login')
  @HttpCode(200)
  @UseGuards(AuthGuard('dev'))
  async devLogin(@CurrentUser() user: User, @Req() req: any) {
    (req.session as any).passport = { user: user.id };
    return { user: { id: user.id, email: user.email, displayName: user.displayName } };
  }

  @Get('me')
  async me(@Req() req: any) {
    if (!req.user) return { user: null };
    return {
      user: {
        id: req.user.id,
        email: req.user.email,
        displayName: req.user.displayName,
        preferredLocale: req.user.preferredLocale,
      },
    };
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@Req() req: any) {
    return new Promise<{ ok: boolean }>((resolve) => {
      req.session.destroy(() => {
        resolve({ ok: true });
      });
    });
  }
}
