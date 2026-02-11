import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import session from 'express-session';
import passport from 'passport';
import { join } from 'path';
import { AppModule } from './app.module.js';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter.js';
import { I18nInterceptor } from './common/interceptors/i18n.interceptor.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const isProd = process.env.NODE_ENV === 'production';

  // Trust Railway's reverse proxy so secure cookies work
  if (isProd) {
    app.set('trust proxy', 1);
  }

  // CORS for Vite dev server and ngrok tunnel
  app.enableCors({
    origin: (origin, callback) => callback(null, true),
    credentials: true,
  });

  // Session config
  const sessionConfig: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || 'dev-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 8 * 60 * 60 * 1000, // 8 hours (one shift)
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
    },
  };

  // Use Redis session store in production
  if (isProd && process.env.REDIS_URL) {
    const { createClient } = await import('redis');
    const { RedisStore } = await import('connect-redis');
    const redisClient = createClient({ url: process.env.REDIS_URL });
    await redisClient.connect();
    sessionConfig.store = new RedisStore({ client: redisClient });
    console.log('Redis session store connected');
  }

  app.use(session(sessionConfig));

  // Passport
  app.use(passport.initialize());
  app.use(passport.session());

  // Global pipes, filters, interceptors
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new I18nInterceptor());

  // In production, serve the built frontend as static files
  if (isProd) {
    const webDist = join(__dirname, '../../web/dist');
    app.useStaticAssets(webDist);

    // SPA catch-all: any non-API, non-asset route serves index.html
    app.use((req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
        return next();
      }
      res.sendFile(join(webDist, 'index.html'));
    });
  }

  const port = process.env.PORT || process.env.API_PORT || 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`MES API running on http://0.0.0.0:${port}`);
}
bootstrap();
