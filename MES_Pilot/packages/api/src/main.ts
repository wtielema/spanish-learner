import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import session from 'express-session';
import passport from 'passport';
import { AppModule } from './app.module.js';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter.js';
import { I18nInterceptor } from './common/interceptors/i18n.interceptor.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS for Vite dev server
  app.enableCors({
    origin: 'http://localhost:5173',
    credentials: true,
  });

  // Session
  app.use(
    session({
      secret: process.env.SESSION_SECRET || 'dev-secret',
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: 8 * 60 * 60 * 1000, // 8 hours (one shift)
        httpOnly: true,
        sameSite: 'lax',
      },
    }),
  );

  // Passport
  app.use(passport.initialize());
  app.use(passport.session());

  // Global pipes, filters, interceptors
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new I18nInterceptor());

  const port = process.env.API_PORT || 3000;
  await app.listen(port);
  console.log(`MES API running on http://localhost:${port}`);
}
bootstrap();
