import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AuthModule } from './modules/auth/auth.module.js';
import { CoreModule } from './modules/core/core.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { MesConfigModule } from './modules/config/config.module.js';
import { RecipesModule } from './modules/recipes/recipes.module.js';
import { JobsModule } from './modules/jobs/jobs.module.js';
import { QualityModule } from './modules/quality/quality.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '../../.env',
      isGlobal: true,
    }),
    EventEmitterModule.forRoot(),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        host: config.get<string>('DATABASE_HOST', 'localhost'),
        port: config.get<number>('DATABASE_PORT', 5432),
        database: config.get<string>('DATABASE_NAME', 'mes_pilot'),
        username: config.get<string>('DATABASE_USER', 'woutertielemans'),
        password: config.get<string>('DATABASE_PASSWORD', ''),
        autoLoadEntities: true,
        synchronize: true,  // Dev only! Use migrations in production
        logging: config.get<string>('NODE_ENV') !== 'production',
      }),
    }),
    CoreModule,
    AuthModule,
    UsersModule,
    MesConfigModule,
    RecipesModule,
    JobsModule,
    QualityModule,
  ],
})
export class AppModule {}
