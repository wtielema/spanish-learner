# MES System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the MVP of a web-based MES for FMCG manufacturing with Job Center, Quality Control, Recipe Management, and Plant Simulator modules.

**Architecture:** NestJS monorepo with a TypeScript API, React+Vite SPA, PostgreSQL+TimescaleDB database, Redis for sessions/caching, and Socket.io for real-time. Authentication via Microsoft Entra ID (OIDC) with a dev-mode bypass. Role+Area permission matrix enforced via NestJS guards. Immutable audit log via interceptor.

**Tech Stack:** Node.js 25, NestJS 11, React 19, Vite, TypeORM, PostgreSQL 16 + TimescaleDB, Redis, Socket.io, react-i18next, Passport.js (OIDC strategy)

**Design document:** `docs/plans/2026-02-11-mes-design.md`

---

## Phase 1: Foundation

### Task 1: Project Scaffolding & Dev Environment

Set up the monorepo structure, install local services, and verify everything boots.

**Files:**
- Create: `MES_Pilot/package.json` (workspace root)
- Create: `MES_Pilot/packages/api/` (NestJS app)
- Create: `MES_Pilot/packages/web/` (React+Vite app)
- Create: `MES_Pilot/packages/simulator/` (placeholder)
- Create: `MES_Pilot/docker-compose.yml` (for PostgreSQL+TimescaleDB and Redis)
- Create: `MES_Pilot/.gitignore`
- Create: `MES_Pilot/.env.example`

**Step 1: Install local services via Homebrew**

```bash
brew install postgresql@16 redis
brew services start postgresql@16
brew services start redis
```

Verify:
```bash
psql --version   # PostgreSQL 16.x
redis-cli ping   # PONG
```

**Step 2: Create the workspace root**

```bash
mkdir -p MES_Pilot
cd MES_Pilot
```

Create `package.json`:
```json
{
  "name": "mes-pilot",
  "private": true,
  "workspaces": ["packages/*"]
}
```

Create `.gitignore`:
```
node_modules/
dist/
.env
*.log
.DS_Store
```

Create `.env.example`:
```env
# Database
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=mes_pilot
DATABASE_USER=mes_user
DATABASE_PASSWORD=mes_dev_password

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Auth (set to 'dev' to bypass OIDC)
AUTH_MODE=dev
ENTRA_CLIENT_ID=
ENTRA_TENANT_ID=
ENTRA_CLIENT_SECRET=

# App
API_PORT=3000
SESSION_SECRET=dev-secret-change-in-production
```

**Step 3: Create the database**

```bash
createdb mes_pilot
psql mes_pilot -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"
```

TimescaleDB can be added later when we need hypertables (Phase 2 OEE). For MVP, standard PostgreSQL is sufficient.

**Step 4: Scaffold the NestJS API**

```bash
cd MES_Pilot/packages
npx @nestjs/cli new api --package-manager npm --skip-git
cd api
npm install @nestjs/typeorm typeorm pg
npm install @nestjs/config
npm install @nestjs/passport passport
npm install express-session connect-redis redis
npm install @nestjs/platform-socket.io @nestjs/websockets socket.io
npm install class-validator class-transformer
npm install uuid
npm install --save-dev @types/express-session @types/passport
```

Update `packages/api/src/app.module.ts` to add TypeORM and ConfigModule:
```typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '../../.env',
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DATABASE_HOST', 'localhost'),
        port: config.get<number>('DATABASE_PORT', 5432),
        database: config.get('DATABASE_NAME', 'mes_pilot'),
        username: config.get('DATABASE_USER', 'mes_user'),
        password: config.get('DATABASE_PASSWORD', 'mes_dev_password'),
        autoLoadEntities: true,
        synchronize: false,
        logging: config.get('NODE_ENV') !== 'production',
      }),
    }),
  ],
})
export class AppModule {}
```

**Step 5: Scaffold the React+Vite frontend**

```bash
cd MES_Pilot/packages
npm create vite@latest web -- --template react-ts
cd web
npm install
npm install react-router-dom
npm install react-i18next i18next i18next-http-backend i18next-browser-languagedetector
npm install socket.io-client
npm install @tanstack/react-query
npm install dayjs
```

**Step 6: Verify both apps boot**

```bash
# Terminal 1: API
cd MES_Pilot/packages/api
cp ../../.env.example ../../.env
npm run start:dev
# Expected: NestJS listening on port 3000

# Terminal 2: Web
cd MES_Pilot/packages/web
npm run dev
# Expected: Vite dev server on port 5173
```

**Step 7: Create Docker Compose for portable dev/production**

Create `MES_Pilot/docker-compose.yml`:
```yaml
services:
  postgres:
    image: timescale/timescaledb:latest-pg16
    ports:
      - "5432:5432"
    environment:
      POSTGRES_DB: mes_pilot
      POSTGRES_USER: mes_user
      POSTGRES_PASSWORD: mes_dev_password
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  pgdata:
```

This is for future use / CI environments. Local Homebrew services work for now.

**Step 8: Commit**

```bash
git add MES_Pilot/
git commit -m "feat(mes): scaffold monorepo with NestJS API, React+Vite frontend, and dev environment"
```

---

### Task 2: Database Schema — Core Entities & Migrations

Set up TypeORM migrations and create all the foundational tables: equipment hierarchy, users, roles, audit log.

**Files:**
- Create: `packages/api/src/modules/core/entities/site.entity.ts`
- Create: `packages/api/src/modules/core/entities/area.entity.ts`
- Create: `packages/api/src/modules/core/entities/work-center.entity.ts`
- Create: `packages/api/src/modules/core/entities/work-unit.entity.ts`
- Create: `packages/api/src/modules/users/entities/user.entity.ts`
- Create: `packages/api/src/modules/users/entities/role.entity.ts`
- Create: `packages/api/src/modules/users/entities/user-area.entity.ts`
- Create: `packages/api/src/modules/audit/entities/audit-log.entity.ts`
- Create: migration file via TypeORM CLI

**Step 1: Configure TypeORM CLI**

Create `packages/api/typeorm.config.ts`:
```typescript
import { DataSource } from 'typeorm';
import { config } from 'dotenv';

config({ path: '../../.env' });

export default new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432'),
  database: process.env.DATABASE_NAME || 'mes_pilot',
  username: process.env.DATABASE_USER || 'mes_user',
  password: process.env.DATABASE_PASSWORD || 'mes_dev_password',
  entities: ['src/**/*.entity.ts'],
  migrations: ['migrations/*.ts'],
});
```

Add to `packages/api/package.json` scripts:
```json
"typeorm": "ts-node -r tsconfig-paths/register ./node_modules/typeorm/cli.js -d typeorm.config.ts",
"migration:generate": "npm run typeorm -- migration:generate",
"migration:run": "npm run typeorm -- migration:run",
"migration:revert": "npm run typeorm -- migration:revert"
```

Install ts-node: `npm install --save-dev ts-node tsconfig-paths`

**Step 2: Create Site entity**

```typescript
// packages/api/src/modules/core/entities/site.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Area } from './area.entity';

@Entity('sites')
export class Site {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  enterpriseId: string;

  @Column({ type: 'jsonb' })
  nameI18n: Record<string, string>;  // { "en": "Plant Amsterdam", "nl": "Fabriek Amsterdam" }

  @Column({ type: 'text', default: 'UTC' })
  timezone: string;

  @Column({ type: 'text', default: 'en' })
  locale: string;

  @OneToMany(() => Area, (area) => area.site)
  areas: Area[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

**Step 3: Create Area entity**

```typescript
// packages/api/src/modules/core/entities/area.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Site } from './site.entity';
import { WorkCenter } from './work-center.entity';

export enum AreaType {
  BATCH = 'batch',
  DISCRETE = 'discrete',
  PACKAGING = 'packaging',
}

@Entity('areas')
export class Area {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  siteId: string;

  @ManyToOne(() => Site, (site) => site.areas)
  @JoinColumn({ name: 'siteId' })
  site: Site;

  @Column({ type: 'jsonb' })
  nameI18n: Record<string, string>;

  @Column({ type: 'enum', enum: AreaType })
  areaType: AreaType;

  @Column({ type: 'jsonb', default: {} })
  config: Record<string, any>;

  @OneToMany(() => WorkCenter, (wc) => wc.area)
  workCenters: WorkCenter[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

**Step 4: Create WorkCenter and WorkUnit entities**

```typescript
// packages/api/src/modules/core/entities/work-center.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Area } from './area.entity';
import { WorkUnit } from './work-unit.entity';

@Entity('work_centers')
export class WorkCenter {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  areaId: string;

  @ManyToOne(() => Area, (area) => area.workCenters)
  @JoinColumn({ name: 'areaId' })
  area: Area;

  @Column({ type: 'jsonb' })
  nameI18n: Record<string, string>;

  @Column({ type: 'jsonb', nullable: true })
  descriptionI18n: Record<string, string>;

  @OneToMany(() => WorkUnit, (wu) => wu.workCenter)
  workUnits: WorkUnit[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

```typescript
// packages/api/src/modules/core/entities/work-unit.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { WorkCenter } from './work-center.entity';

@Entity('work_units')
export class WorkUnit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  workCenterId: string;

  @ManyToOne(() => WorkCenter, (wc) => wc.workUnits)
  @JoinColumn({ name: 'workCenterId' })
  workCenter: WorkCenter;

  @Column({ type: 'jsonb' })
  nameI18n: Record<string, string>;

  @Column({ type: 'text', nullable: true })
  unitType: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

**Step 5: Create User, Role, UserArea entities**

```typescript
// packages/api/src/modules/users/entities/user.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { UserArea } from './user-area.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text', unique: true, nullable: true })
  entraId: string;

  @Column({ type: 'text', unique: true })
  email: string;

  @Column({ type: 'text' })
  displayName: string;

  @Column({ type: 'text', default: 'en' })
  preferredLocale: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @OneToMany(() => UserArea, (ua) => ua.user)
  userAreas: UserArea[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

```typescript
// packages/api/src/modules/users/entities/role.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('roles')
export class Role {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text', unique: true })
  name: string;

  @Column({ type: 'text', array: true })
  permissions: string[];

  @CreateDateColumn()
  createdAt: Date;
}
```

```typescript
// packages/api/src/modules/users/entities/user-area.entity.ts
import { Entity, PrimaryColumn, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { User } from './user.entity';
import { Area } from '../../core/entities/area.entity';
import { Role } from './role.entity';

@Entity('user_areas')
export class UserArea {
  @PrimaryColumn({ type: 'uuid' })
  userId: string;

  @PrimaryColumn({ type: 'uuid' })
  areaId: string;

  @ManyToOne(() => User, (user) => user.userAreas)
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => Area)
  @JoinColumn({ name: 'areaId' })
  area: Area;

  @ManyToOne(() => Role)
  @JoinColumn({ name: 'roleId' })
  role: Role;

  @PrimaryColumn({ type: 'uuid' })
  roleId: string;

  @CreateDateColumn()
  createdAt: Date;
}
```

**Step 6: Create AuditLog entity**

```typescript
// packages/api/src/modules/audit/entities/audit-log.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('audit_log')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn()
  timestamp: Date;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  userId: string;

  @Column({ type: 'text' })
  action: string;

  @Column({ type: 'text' })
  @Index()
  entityType: string;

  @Column({ type: 'uuid' })
  @Index()
  entityId: string;

  @Column({ type: 'jsonb', nullable: true })
  beforeState: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  afterState: Record<string, any>;
}
```

**Step 7: Generate and run migration**

```bash
cd packages/api
npm run migration:generate -- migrations/InitialSchema
npm run migration:run
```

Verify: `psql mes_pilot -c "\dt"` should show: sites, areas, work_centers, work_units, users, roles, user_areas, audit_log.

**Step 8: Seed default roles**

Create `packages/api/src/modules/users/seeds/roles.seed.ts`:
```typescript
import { DataSource } from 'typeorm';

export async function seedRoles(dataSource: DataSource) {
  const roleRepo = dataSource.getRepository('Role');

  const roles = [
    {
      name: 'Operator',
      permissions: ['job:view', 'job:start', 'job:complete', 'qc:view', 'qc:inspect', 'recipe:view'],
    },
    {
      name: 'Supervisor',
      permissions: [
        'job:view', 'job:create', 'job:start', 'job:complete', 'job:hold', 'job:reassign',
        'qc:view', 'qc:inspect', 'qc:deviate', 'qc:hold', 'qc:release',
        'recipe:view', 'config:view',
      ],
    },
    {
      name: 'QC Inspector',
      permissions: ['job:view', 'qc:view', 'qc:inspect', 'qc:deviate', 'qc:hold', 'qc:release', 'recipe:view'],
    },
    {
      name: 'Engineer',
      permissions: [
        'job:view', 'qc:view', 'recipe:view', 'recipe:edit', 'recipe:approve', 'recipe:obsolete',
        'config:view', 'config:edit',
      ],
    },
    {
      name: 'Admin',
      permissions: [
        'job:view', 'job:create', 'job:start', 'job:complete', 'job:hold', 'job:reassign',
        'qc:view', 'qc:inspect', 'qc:deviate', 'qc:hold', 'qc:release',
        'recipe:view', 'recipe:edit', 'recipe:approve', 'recipe:obsolete',
        'config:view', 'config:edit', 'user:view', 'user:manage',
      ],
    },
  ];

  for (const role of roles) {
    const existing = await roleRepo.findOneBy({ name: role.name });
    if (!existing) {
      await roleRepo.save(roleRepo.create(role));
    }
  }
}
```

**Step 9: Commit**

```bash
git add MES_Pilot/
git commit -m "feat(mes): database schema for equipment hierarchy, users, roles, and audit log"
```

---

### Task 3: Auth Module — Dev Bypass & Permission Guard

Implement authentication with a dev-mode bypass (no Entra ID needed for development) and the Role+Area permission guard.

**Files:**
- Create: `packages/api/src/modules/auth/auth.module.ts`
- Create: `packages/api/src/modules/auth/strategies/dev.strategy.ts`
- Create: `packages/api/src/modules/auth/guards/auth.guard.ts`
- Create: `packages/api/src/modules/auth/guards/permission.guard.ts`
- Create: `packages/api/src/modules/auth/decorators/require-permission.decorator.ts`
- Create: `packages/api/src/modules/auth/decorators/current-user.decorator.ts`
- Create: `packages/api/src/modules/auth/auth.controller.ts`
- Modify: `packages/api/src/app.module.ts`

**Step 1: Create the dev auth strategy**

In `AUTH_MODE=dev`, the system bypasses OIDC and lets you log in as any seeded user via `POST /api/auth/dev-login` with an email. This is for development only.

```typescript
// packages/api/src/modules/auth/strategies/dev.strategy.ts
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../users/entities/user.entity';

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
    return user;
  }
}
```

**Step 2: Create the permission guard**

This is the core authorization mechanism. It checks: does the current user have a role in the requested area that includes the required permission?

```typescript
// packages/api/src/modules/auth/guards/permission.guard.ts
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserArea } from '../../users/entities/user-area.entity';
import { PERMISSION_KEY } from '../decorators/require-permission.decorator';

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

    if (!permission) return true; // No permission required

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user) throw new ForbiddenException('Not authenticated');

    // Get the area from route params, query, or body
    const areaId = request.params.areaId || request.query.areaId || request.body?.areaId;

    // Load user's area assignments with roles
    const userAreas = await this.userAreaRepo.find({
      where: { userId: user.id },
      relations: ['role'],
    });

    if (areaId) {
      // Check specific area
      const assignment = userAreas.find((ua) => ua.areaId === areaId);
      if (!assignment || !assignment.role.permissions.includes(permission)) {
        throw new ForbiddenException(`Missing permission: ${permission} in area ${areaId}`);
      }
    } else {
      // No area specified — check if user has this permission in ANY area
      const hasPermission = userAreas.some((ua) => ua.role.permissions.includes(permission));
      if (!hasPermission) {
        throw new ForbiddenException(`Missing permission: ${permission}`);
      }
      // Attach the user's allowed area IDs to the request for query scoping
      request.allowedAreaIds = userAreas
        .filter((ua) => ua.role.permissions.includes(permission))
        .map((ua) => ua.areaId);
    }

    return true;
  }
}
```

**Step 3: Create decorators**

```typescript
// packages/api/src/modules/auth/decorators/require-permission.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const PERMISSION_KEY = 'requiredPermission';
export const RequirePermission = (permission: string) => SetMetadata(PERMISSION_KEY, permission);
```

```typescript
// packages/api/src/modules/auth/decorators/current-user.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
```

**Step 4: Create auth controller with dev login endpoint**

```typescript
// packages/api/src/modules/auth/auth.controller.ts
import { Controller, Post, Body, Req, UseGuards, Get, HttpCode } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from './decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@Controller('api/auth')
export class AuthController {
  @Post('dev-login')
  @HttpCode(200)
  @UseGuards(AuthGuard('dev'))
  async devLogin(@CurrentUser() user: User, @Req() req: any) {
    req.session.userId = user.id;
    return { user: { id: user.id, email: user.email, displayName: user.displayName } };
  }

  @Get('me')
  async me(@Req() req: any) {
    if (!req.user) return { user: null };
    return { user: { id: req.user.id, email: req.user.email, displayName: req.user.displayName } };
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@Req() req: any) {
    req.session.destroy();
    return { ok: true };
  }
}
```

**Step 5: Create auth module and wire into AppModule**

```typescript
// packages/api/src/modules/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { User } from '../users/entities/user.entity';
import { UserArea } from '../users/entities/user-area.entity';
import { DevStrategy } from './strategies/dev.strategy';
import { PermissionGuard } from './guards/permission.guard';
import { AuthController } from './auth.controller';

@Module({
  imports: [
    PassportModule.register({ session: true }),
    TypeOrmModule.forFeature([User, UserArea]),
  ],
  controllers: [AuthController],
  providers: [DevStrategy, PermissionGuard],
  exports: [PermissionGuard],
})
export class AuthModule {}
```

Wire session middleware and auth module into `app.module.ts` and `main.ts`.

**Step 6: Write test for permission guard**

Create `packages/api/src/modules/auth/guards/permission.guard.spec.ts`:
```typescript
// Test that:
// 1. Endpoint with no @RequirePermission passes
// 2. Endpoint with @RequirePermission('job:start') passes when user has that permission in the area
// 3. Endpoint with @RequirePermission('job:start') fails when user lacks permission
// 4. When no areaId specified, request.allowedAreaIds is populated
```

Run: `cd packages/api && npm run test -- --testPathPattern=permission.guard`

**Step 7: Commit**

```bash
git add MES_Pilot/
git commit -m "feat(mes): auth module with dev login bypass and Role+Area permission guard"
```

---

### Task 4: Audit Log Interceptor & i18n Middleware

Cross-cutting concerns that every module benefits from.

**Files:**
- Create: `packages/api/src/common/interceptors/audit-log.interceptor.ts`
- Create: `packages/api/src/common/interceptors/i18n.interceptor.ts`
- Create: `packages/api/src/common/filters/http-exception.filter.ts`
- Modify: `packages/api/src/app.module.ts`

**Step 1: Create audit log interceptor**

```typescript
// packages/api/src/common/interceptors/audit-log.interceptor.ts
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../../modules/audit/entities/audit-log.entity';

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(
    @InjectRepository(AuditLog)
    private auditLogRepo: Repository<AuditLog>,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const method = request.method;

    // Only audit mutations
    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      return next.handle();
    }

    return next.handle().pipe(
      tap(async (responseData) => {
        try {
          const userId = request.user?.id;
          const action = `${method} ${request.route?.path || request.url}`;
          // Extract entity info from response if available
          const entityId = responseData?.id || request.params?.id;
          const entityType = this.resolveEntityType(request.route?.path || request.url);

          if (entityId && entityType) {
            await this.auditLogRepo.save(
              this.auditLogRepo.create({
                userId,
                action,
                entityType,
                entityId,
                afterState: responseData,
              }),
            );
          }
        } catch (error) {
          // Audit logging should never break the request
          console.error('Audit log error:', error);
        }
      }),
    );
  }

  private resolveEntityType(path: string): string {
    // Extract entity type from URL path: /api/work-orders/:id → work-orders
    const segments = path.split('/').filter(Boolean);
    // Find the first non-'api' segment
    return segments.find((s) => s !== 'api' && !s.startsWith(':')) || 'unknown';
  }
}
```

**Step 2: Create i18n interceptor**

Resolves `nameI18n` JSONB fields to a flat `name` string based on `Accept-Language` header.

```typescript
// packages/api/src/common/interceptors/i18n.interceptor.ts
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, map } from 'rxjs';

@Injectable()
export class I18nInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const lang = request.headers['accept-language']?.split(',')[0]?.split('-')[0] || 'en';

    return next.handle().pipe(
      map((data) => this.resolveI18n(data, lang)),
    );
  }

  private resolveI18n(data: any, lang: string): any {
    if (data === null || data === undefined) return data;
    if (Array.isArray(data)) return data.map((item) => this.resolveI18n(item, lang));
    if (typeof data !== 'object') return data;

    const resolved: any = {};
    for (const [key, value] of Object.entries(data)) {
      if (key.endsWith('I18n') && typeof value === 'object' && value !== null && !Array.isArray(value)) {
        const baseKey = key.replace(/I18n$/, '');
        resolved[baseKey] = (value as Record<string, string>)[lang] || (value as Record<string, string>)['en'] || Object.values(value)[0];
        resolved[key] = value; // Keep original too for editing
      } else if (typeof value === 'object') {
        resolved[key] = this.resolveI18n(value, lang);
      } else {
        resolved[key] = value;
      }
    }
    return resolved;
  }
}
```

**Step 3: Create global exception filter**

```typescript
// packages/api/src/common/filters/http-exception.filter.ts
import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();

    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const message = exception instanceof HttpException
      ? exception.getResponse()
      : 'Internal server error';

    response.status(status).json({
      statusCode: status,
      message: typeof message === 'string' ? message : (message as any).message || message,
      timestamp: new Date().toISOString(),
    });
  }
}
```

**Step 4: Register globally in main.ts**

Update `packages/api/src/main.ts` to register session, interceptors, filters, and validation pipes.

**Step 5: Write test for i18n interceptor**

Test that `{ nameI18n: { en: "Batch", nl: "Batch" } }` with `Accept-Language: nl` resolves to `{ name: "Batch", nameI18n: { ... } }`.

Run: `cd packages/api && npm run test -- --testPathPattern=i18n`

**Step 6: Commit**

```bash
git add MES_Pilot/
git commit -m "feat(mes): audit log interceptor, i18n resolver, and global exception filter"
```

---

### Task 5: Core Module — Equipment Hierarchy CRUD

Full CRUD for Sites, Areas, Work Centers, Work Units. This is the first real API surface and establishes patterns for all other modules.

**Files:**
- Create: `packages/api/src/modules/core/core.module.ts`
- Create: `packages/api/src/modules/core/controllers/sites.controller.ts`
- Create: `packages/api/src/modules/core/controllers/areas.controller.ts`
- Create: `packages/api/src/modules/core/controllers/work-centers.controller.ts`
- Create: `packages/api/src/modules/core/controllers/work-units.controller.ts`
- Create: `packages/api/src/modules/core/services/sites.service.ts`
- Create: `packages/api/src/modules/core/services/areas.service.ts`
- Create: `packages/api/src/modules/core/services/work-centers.service.ts`
- Create: DTOs for each entity
- Create: Tests for each service

**Step 1: Write failing test for SitesService**

```typescript
// Test CRUD: create site, get site, list sites, update site
```

**Step 2: Implement SitesService with standard CRUD pattern**

All services follow the same pattern:
```typescript
@Injectable()
export class SitesService {
  constructor(
    @InjectRepository(Site)
    private repo: Repository<Site>,
  ) {}

  async create(dto: CreateSiteDto): Promise<Site> { ... }
  async findAll(): Promise<Site[]> { ... }
  async findOne(id: string): Promise<Site> { ... }
  async update(id: string, dto: UpdateSiteDto): Promise<Site> { ... }
  async remove(id: string): Promise<void> { ... }
}
```

**Step 3: Create controller with permission decorators**

```typescript
@Controller('api/sites')
export class SitesController {
  @Get()
  @RequirePermission('config:view')
  findAll() { ... }

  @Post()
  @RequirePermission('config:edit')
  create(@Body() dto: CreateSiteDto) { ... }
  // etc.
}
```

**Step 4: Repeat for Areas, Work Centers, Work Units**

Areas controller nests under sites: `GET /api/sites/:siteId/areas`
Work Centers nest under areas: `GET /api/areas/:areaId/work-centers`
Work Units nest under work centers: `GET /api/work-centers/:workCenterId/work-units`

Include the **Clone Work Center** endpoint: `POST /api/work-centers/:id/clone` — copies the work center and all its config overrides to a new work center with a suffix like "(Copy)".

**Step 5: Run all tests**

```bash
cd packages/api && npm run test
```

**Step 6: Manual smoke test**

```bash
# Dev login
curl -X POST http://localhost:3000/api/auth/dev-login -H 'Content-Type: application/json' -d '{"email":"admin@test.com"}'

# Create a site (use the session cookie from above)
curl -X POST http://localhost:3000/api/sites -H 'Content-Type: application/json' \
  -d '{"nameI18n": {"en": "Plant Amsterdam", "nl": "Fabriek Amsterdam"}, "timezone": "Europe/Amsterdam"}'
```

**Step 7: Commit**

```bash
git add MES_Pilot/
git commit -m "feat(mes): core module with equipment hierarchy CRUD (sites, areas, work centers, work units)"
```

---

## Phase 2: Domain Modules

### Task 6: Users Module — User Management & Role Assignment

**Files:**
- Create: `packages/api/src/modules/users/users.module.ts`
- Create: `packages/api/src/modules/users/controllers/users.controller.ts`
- Create: `packages/api/src/modules/users/services/users.service.ts`
- Create: DTOs, tests

**Step 1: Write failing tests for UsersService**

Test: create user, assign role to area, list users with their area assignments, update user locale.

**Step 2: Implement UsersService**

Key methods:
```typescript
async assignRole(userId: string, areaId: string, roleId: string): Promise<UserArea>
async removeRole(userId: string, areaId: string): Promise<void>
async getUserPermissions(userId: string): Promise<{ areaId: string; permissions: string[] }[]>
async findByArea(areaId: string): Promise<User[]>
```

**Step 3: Implement UsersController**

```
GET    /api/users                          — list all users (user:view)
GET    /api/users/:id                      — get user details with area assignments
POST   /api/users/:id/areas                — assign role to area (user:manage)
DELETE /api/users/:userId/areas/:areaId    — remove area assignment (user:manage)
PATCH  /api/users/:id                      — update user profile (locale, etc.)
```

**Step 4: Run tests, commit**

```bash
git commit -m "feat(mes): users module with role-area assignment management"
```

---

### Task 7: Config Module — Three-Tier Inheritance & Reason Codes

**Files:**
- Create: `packages/api/src/modules/config/config.module.ts`
- Create: `packages/api/src/modules/config/entities/config-override.entity.ts`
- Create: `packages/api/src/modules/config/entities/reason-code.entity.ts`
- Create: `packages/api/src/modules/config/services/config.service.ts`
- Create: `packages/api/src/modules/config/services/reason-codes.service.ts`
- Create: Controllers, DTOs, tests

**Step 1: Write failing test for config resolution**

```typescript
// Test: site-level config returns site values
// Test: area-level override replaces site value for that key
// Test: work-center override replaces area value for that key
// Test: unset keys still inherited from parent
```

**Step 2: Implement ConfigService**

Key method — three-tier merge:
```typescript
async getResolvedConfig(workCenterId: string): Promise<Record<string, any>> {
  const wc = await this.workCenterRepo.findOne({ where: { id: workCenterId }, relations: ['area', 'area.site'] });

  const siteOverrides = await this.getOverrides('site', wc.area.siteId);
  const areaOverrides = await this.getOverrides('area', wc.areaId);
  const wcOverrides = await this.getOverrides('work_center', workCenterId);

  return { ...siteOverrides, ...areaOverrides, ...wcOverrides };
}
```

**Step 3: Implement ReasonCodesService**

Reason codes follow the same inheritance: site-level codes are available everywhere, area-level codes add to them, work-center level can suppress.

```
GET    /api/work-centers/:id/reason-codes  — resolved list (inherited + overrides)
POST   /api/reason-codes                   — create (config:edit)
PATCH  /api/reason-codes/:id               — update
DELETE /api/reason-codes/:id               — delete
```

**Step 4: Bulk assignment endpoint**

```
POST /api/config/bulk-assign
Body: { entityType: "qc_template", entityId: "...", workCenterIds: ["...", "..."] }
```

**Step 5: Run tests, commit**

```bash
git commit -m "feat(mes): config module with three-tier inheritance and reason codes"
```

---

### Task 8: Recipe Module — Products, Materials, Master Recipes

**Files:**
- Create: `packages/api/src/modules/recipes/entities/product.entity.ts`
- Create: `packages/api/src/modules/recipes/entities/material.entity.ts`
- Create: `packages/api/src/modules/recipes/entities/master-recipe.entity.ts`
- Create: `packages/api/src/modules/recipes/entities/recipe-phase.entity.ts`
- Create: `packages/api/src/modules/recipes/entities/recipe-parameter.entity.ts`
- Create: `packages/api/src/modules/recipes/entities/recipe-material.entity.ts`
- Create: `packages/api/src/modules/recipes/entities/control-recipe.entity.ts`
- Create: Service, controller, DTOs, tests
- Create: Migration for recipe tables

**Step 1: Create entities and generate migration**

All entities as defined in the design document (Section 11).

```bash
npm run migration:generate -- migrations/RecipeTables
npm run migration:run
```

**Step 2: Write failing tests for RecipesService**

```typescript
// Test: create product
// Test: create master recipe in draft status
// Test: add phases, parameters, materials to recipe
// Test: submit recipe for review (draft → in_review)
// Test: approve recipe (in_review → approved) — requires different user
// Test: activate recipe (approved → active) — deactivates previous active version
// Test: create control recipe snapshot when starting a work order
// Test: recipe scaling — linear materials scale, fixed materials don't
```

**Step 3: Implement RecipesService**

Key methods:
```typescript
async createMasterRecipe(dto: CreateRecipeDto, userId: string): Promise<MasterRecipe>
async submitForReview(recipeId: string, userId: string): Promise<MasterRecipe>
async approve(recipeId: string, userId: string): Promise<MasterRecipe>  // must be different user
async activate(recipeId: string): Promise<MasterRecipe>
async createControlRecipe(masterRecipeId: string, batchSize?: number): Promise<ControlRecipe>
async compareVersions(recipeId1: string, recipeId2: string): Promise<RecipeDiff>
```

**Step 4: Implement controller**

```
GET    /api/products                        — list products
POST   /api/products                        — create product (recipe:edit)
GET    /api/recipes                         — list recipes (filterable by product, status)
POST   /api/recipes                         — create recipe (recipe:edit)
GET    /api/recipes/:id                     — get recipe with phases, params, materials
PATCH  /api/recipes/:id                     — update recipe (recipe:edit, must be draft)
POST   /api/recipes/:id/submit              — submit for review (recipe:edit)
POST   /api/recipes/:id/approve             — approve (recipe:approve, four-eyes)
POST   /api/recipes/:id/activate            — activate (recipe:approve)
POST   /api/recipes/:id/obsolete            — obsolete (recipe:obsolete)
GET    /api/recipes/compare?v1=...&v2=...   — diff two versions
POST   /api/materials                       — create material (recipe:edit)
GET    /api/materials                       — list materials
```

**Step 5: Run tests, commit**

```bash
git commit -m "feat(mes): recipe module with ISA 88 lifecycle, versioning, and four-eyes approval"
```

---

### Task 9: Jobs Module — Work Orders & Production Execution

**Files:**
- Create: `packages/api/src/modules/jobs/entities/work-order.entity.ts`
- Create: `packages/api/src/modules/jobs/entities/work-order-step.entity.ts`
- Create: `packages/api/src/modules/jobs/entities/production-log.entity.ts`
- Create: Service, controller, DTOs, tests
- Create: Migration

**Step 1: Create entities and generate migration**

All entities as defined in the design document (Section 9).

```bash
npm run migration:generate -- migrations/JobTables
npm run migration:run
```

**Step 2: Write failing tests for JobsService**

```typescript
// Test: create work order in draft status
// Test: release work order (creates control recipe snapshot)
// Test: start work order → status changes, actual_start set
// Test: log production count → quantity_produced increments
// Test: log reject → quantity_rejected increments
// Test: log downtime with reason code
// Test: complete work order → actual_end set
// Test: hold work order → status changes to on_hold
// Test: changeover detection — different product on same work center
// Test: permission scoping — operator only sees their area's work orders
```

**Step 3: Implement JobsService**

Key methods:
```typescript
async create(dto: CreateWorkOrderDto, userId: string): Promise<WorkOrder>
async release(workOrderId: string): Promise<WorkOrder>  // snapshots control recipe
async start(workOrderId: string, userId: string): Promise<WorkOrder>
async logProduction(workOrderId: string, dto: LogProductionDto, userId: string): Promise<ProductionLog>
async complete(workOrderId: string, userId: string): Promise<WorkOrder>
async hold(workOrderId: string, reason: string, userId: string): Promise<WorkOrder>
async resume(workOrderId: string, userId: string): Promise<WorkOrder>
async findByArea(areaId: string, filters?: WorkOrderFilters): Promise<WorkOrder[]>
```

**Step 4: Implement controller**

```
GET    /api/areas/:areaId/work-orders       — list work orders for area (job:view)
POST   /api/work-orders                     — create work order (job:create)
GET    /api/work-orders/:id                 — get with steps, logs, recipe
PATCH  /api/work-orders/:id                 — update draft work order
POST   /api/work-orders/:id/release         — release (job:create)
POST   /api/work-orders/:id/start           — start (job:start)
POST   /api/work-orders/:id/complete        — complete (job:complete)
POST   /api/work-orders/:id/hold            — place hold (job:hold)
POST   /api/work-orders/:id/resume          — resume from hold (job:hold)
POST   /api/work-orders/:id/logs            — log production event (job:start)
GET    /api/work-orders/:id/logs            — get production logs
```

**Step 5: Run tests, commit**

```bash
git commit -m "feat(mes): jobs module with work order lifecycle and production logging"
```

---

### Task 10: Quality Module — QC Templates, Checks, Deviations, Holds

**Files:**
- Create: `packages/api/src/modules/quality/entities/qc-template.entity.ts`
- Create: `packages/api/src/modules/quality/entities/qc-template-param.entity.ts`
- Create: `packages/api/src/modules/quality/entities/qc-check.entity.ts`
- Create: `packages/api/src/modules/quality/entities/qc-result.entity.ts`
- Create: `packages/api/src/modules/quality/entities/qc-deviation.entity.ts`
- Create: `packages/api/src/modules/quality/entities/qc-hold.entity.ts`
- Create: Service, controller, DTOs, tests
- Create: Migration

**Step 1: Create entities and migration**

All entities as per design Section 10.

```bash
npm run migration:generate -- migrations/QualityTables
npm run migration:run
```

**Step 2: Write failing tests for QualityService**

```typescript
// Test: create QC template with params
// Test: resolve applicable templates for a work order (by area + product)
// Test: generate QC check instances when work order starts (timed interval)
// Test: complete a check — all in spec → status = passed
// Test: complete a check — value out of spec → auto-create deviation
// Test: critical deviation → auto-hold work order
// Test: release hold with disposition
// Test: bulk assign template to multiple work centers
```

**Step 3: Implement QualityService**

Key methods:
```typescript
async createTemplate(dto: CreateQcTemplateDto): Promise<QcTemplate>
async generateChecks(workOrderId: string): Promise<QcCheck[]>  // called when WO starts
async completeCheck(checkId: string, results: CompleteCheckDto[], userId: string): Promise<QcCheck>
async createDeviation(dto: CreateDeviationDto, userId: string): Promise<QcDeviation>
async placeHold(dto: PlaceHoldDto, userId: string): Promise<QcHold>
async releaseHold(holdId: string, dto: ReleaseHoldDto, userId: string): Promise<QcHold>
async getDueChecks(workOrderId: string): Promise<QcCheck[]>
```

**Step 4: Integration with Jobs module**

When `JobsService.start()` is called, it should trigger `QualityService.generateChecks()`. Use NestJS events (EventEmitter2) for loose coupling:

```typescript
// In JobsService.start():
this.eventEmitter.emit('work-order.started', { workOrderId });

// In QualityService:
@OnEvent('work-order.started')
async handleWorkOrderStarted(payload: { workOrderId: string }) {
  await this.generateChecks(payload.workOrderId);
}
```

Install: `npm install @nestjs/event-emitter`

**Step 5: Implement controller**

```
POST   /api/qc-templates                           — create template (config:edit)
GET    /api/qc-templates                           — list templates
POST   /api/qc-templates/:id/assign                — bulk assign to work centers
GET    /api/work-orders/:workOrderId/qc-checks     — list checks for work order (qc:view)
POST   /api/qc-checks/:id/complete                 — complete a check (qc:inspect)
POST   /api/qc-deviations                          — create deviation (qc:deviate)
POST   /api/qc-holds                               — place hold (qc:hold)
POST   /api/qc-holds/:id/release                   — release hold (qc:release)
```

**Step 6: Run tests, commit**

```bash
git commit -m "feat(mes): quality module with QC templates, checks, deviations, and holds"
```

---

## Phase 3: Real-Time & Frontend

### Task 11: Socket.io Gateway

**Files:**
- Create: `packages/api/src/gateway/mes.gateway.ts`
- Create: `packages/api/src/gateway/gateway.module.ts`
- Modify: `packages/api/src/app.module.ts`

**Step 1: Create the gateway**

```typescript
// packages/api/src/gateway/mes.gateway.ts
import { WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { OnEvent } from '@nestjs/event-emitter';

@WebSocketGateway({ cors: { origin: '*' } })
export class MesGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    // Client sends their area/work-center subscriptions after connecting
  }

  handleDisconnect(client: Socket) {}

  @SubscribeMessage('join-area')
  handleJoinArea(client: Socket, areaId: string) {
    client.join(`area:${areaId}`);
  }

  @SubscribeMessage('join-work-center')
  handleJoinWorkCenter(client: Socket, workCenterId: string) {
    client.join(`work-center:${workCenterId}`);
  }

  // React to domain events and broadcast to rooms
  @OnEvent('work-order.status-changed')
  handleWorkOrderStatusChanged(payload: { workOrderId: string; status: string; workCenterId: string; areaId: string }) {
    this.server.to(`area:${payload.areaId}`).emit('work-order:status-changed', payload);
    this.server.to(`work-center:${payload.workCenterId}`).emit('work-order:status-changed', payload);
  }

  @OnEvent('production.count-updated')
  handleCountUpdated(payload: any) {
    this.server.to(`area:${payload.areaId}`).emit('production:count-updated', payload);
  }

  @OnEvent('qc.check-due')
  handleCheckDue(payload: any) {
    this.server.to(`work-center:${payload.workCenterId}`).emit('qc:check-due', payload);
  }

  @OnEvent('qc.deviation-raised')
  handleDeviationRaised(payload: any) {
    this.server.to(`area:${payload.areaId}`).emit('qc:deviation-raised', payload);
  }
}
```

**Step 2: Emit events from services**

Update JobsService and QualityService to emit events via EventEmitter2 on state changes.

**Step 3: Test with a Socket.io client**

```bash
# Quick test: connect to ws://localhost:3000 and subscribe to an area room
```

**Step 4: Commit**

```bash
git commit -m "feat(mes): Socket.io gateway with area and work-center rooms"
```

---

### Task 12: Frontend Shell — Auth, Routing, Layout, i18n

**Files:**
- Create: `packages/web/src/api/client.ts` (API client)
- Create: `packages/web/src/api/socket.ts` (Socket.io client)
- Create: `packages/web/src/auth/AuthContext.tsx`
- Create: `packages/web/src/auth/LoginPage.tsx`
- Create: `packages/web/src/auth/ProtectedRoute.tsx`
- Create: `packages/web/src/layout/AppLayout.tsx` (sidebar nav, header)
- Create: `packages/web/src/layout/Sidebar.tsx`
- Create: `packages/web/src/i18n/index.ts` (i18next setup)
- Create: `packages/web/src/i18n/locales/en.json`
- Create: `packages/web/src/i18n/locales/nl.json`
- Modify: `packages/web/src/App.tsx`
- Modify: `packages/web/src/main.tsx`

**Step 1: Set up i18n**

```typescript
// packages/web/src/i18n/index.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import nl from './locales/nl.json';

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, nl: { translation: nl } },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;
```

**Step 2: Set up API client and auth context**

```typescript
// packages/web/src/api/client.ts
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'Accept-Language': i18n.language },
    ...options,
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}
```

**Step 3: Create AuthContext with dev login**

```tsx
// Login page with email input (dev mode) or Entra ID redirect (production)
```

**Step 4: Create AppLayout with sidebar navigation**

Sidebar sections:
- **Operations**: Job Center
- **Quality**: QC Checks, Deviations
- **Engineering**: Recipes, Products, Materials
- **Configuration**: Sites, Areas, Work Centers, Reason Codes, QC Templates
- **Administration**: Users

Show/hide sections based on user permissions. Highlight active route.

**Step 5: Set up React Router**

```tsx
// packages/web/src/App.tsx
<Routes>
  <Route path="/login" element={<LoginPage />} />
  <Route element={<ProtectedRoute />}>
    <Route element={<AppLayout />}>
      <Route path="/" element={<Dashboard />} />
      <Route path="/job-center" element={<JobCenter />} />
      <Route path="/work-orders/:id" element={<WorkOrderDetail />} />
      <Route path="/qc-checks" element={<QcChecks />} />
      <Route path="/recipes" element={<RecipeList />} />
      <Route path="/recipes/:id" element={<RecipeDetail />} />
      <Route path="/products" element={<ProductList />} />
      <Route path="/materials" element={<MaterialList />} />
      <Route path="/sites" element={<SiteList />} />
      <Route path="/areas" element={<AreaList />} />
      <Route path="/work-centers" element={<WorkCenterList />} />
      <Route path="/reason-codes" element={<ReasonCodeList />} />
      <Route path="/qc-templates" element={<QcTemplateList />} />
      <Route path="/users" element={<UserList />} />
    </Route>
  </Route>
</Routes>
```

**Step 6: Set up Socket.io client hook**

```typescript
// packages/web/src/api/socket.ts
import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(import.meta.env.VITE_API_URL || 'http://localhost:3000', {
      withCredentials: true,
    });
  }
  return socket;
}

// packages/web/src/hooks/useSocketEvent.ts
export function useSocketEvent<T>(event: string, callback: (data: T) => void) {
  useEffect(() => {
    const s = getSocket();
    s.on(event, callback);
    return () => { s.off(event, callback); };
  }, [event, callback]);
}
```

**Step 7: Commit**

```bash
git commit -m "feat(mes): frontend shell with auth, routing, sidebar layout, i18n, and Socket.io client"
```

---

### Task 13: Frontend — Configuration Screens

Build the admin/engineering screens: Sites, Areas, Work Centers, Users, Reason Codes.

**Files:**
- Create: `packages/web/src/modules/config/SiteList.tsx`
- Create: `packages/web/src/modules/config/AreaList.tsx`
- Create: `packages/web/src/modules/config/WorkCenterList.tsx`
- Create: `packages/web/src/modules/config/ReasonCodeList.tsx`
- Create: `packages/web/src/modules/users/UserList.tsx`
- Create: `packages/web/src/modules/users/UserDetail.tsx`
- Create: `packages/web/src/components/DataTable.tsx` (reusable table)
- Create: `packages/web/src/components/I18nInput.tsx` (multi-language input)
- Create: `packages/web/src/components/ConfirmDialog.tsx`

**Step 1: Create reusable DataTable component**

A table component with sorting, filtering, and pagination. Used across all list screens.

**Step 2: Create I18nInput component**

Multi-language text input: shows tabs for each language (EN, NL, ZH), stores as `{ en: "...", nl: "...", zh: "..." }`.

**Step 3: Build Site/Area/WorkCenter management screens**

Standard CRUD UI: list with data table, create/edit modal with form, delete confirmation. Work Centers include the "Clone" button.

**Step 4: Build User management screen**

List users. User detail shows their area-role assignments. Add/remove role assignment with area + role dropdown.

**Step 5: Build Reason Code management screen**

List reason codes with scope (site/area) and category (downtime/reject/hold). Create/edit with i18n name input.

**Step 6: Commit**

```bash
git commit -m "feat(mes): frontend configuration screens (sites, areas, work centers, users, reason codes)"
```

---

### Task 14: Frontend — Recipe Management Screens

**Files:**
- Create: `packages/web/src/modules/recipes/RecipeList.tsx`
- Create: `packages/web/src/modules/recipes/RecipeDetail.tsx`
- Create: `packages/web/src/modules/recipes/RecipeEditor.tsx`
- Create: `packages/web/src/modules/recipes/RecipeComparison.tsx`
- Create: `packages/web/src/modules/recipes/ProductList.tsx`
- Create: `packages/web/src/modules/recipes/MaterialList.tsx`

**Step 1: Build RecipeList**

Table of recipes with filters: product, status, area type. Status badges (Draft, In Review, Approved, Active, Obsolete).

**Step 2: Build RecipeEditor**

Multi-section form:
- Header: product, area type, version, notes
- Phases: orderable list, each with name, type, duration, instructions
- Parameters: grouped by phase, with name, value, unit, limits
- Materials: grouped by phase, with material, quantity, unit, scaling type, critical flag

Only editable in Draft status. Show read-only for other statuses.

**Step 3: Build recipe lifecycle buttons**

Based on status and user permissions:
- Draft → "Submit for Review" button (recipe:edit)
- In Review → "Approve" button (recipe:approve, different user check shown in UI)
- Approved → "Activate" button (recipe:approve)
- Active → "Obsolete" button (recipe:obsolete)

**Step 4: Build RecipeComparison**

Side-by-side diff of two recipe versions. Select two versions from dropdown. Highlight added/removed/changed phases, parameters, materials.

**Step 5: Build Product and Material CRUD screens**

Simple list + create/edit forms.

**Step 6: Commit**

```bash
git commit -m "feat(mes): frontend recipe management with editor, lifecycle, and version comparison"
```

---

### Task 15: Frontend — Job Center

This is the primary operator screen. Needs to be touch-friendly for shop floor tablets.

**Files:**
- Create: `packages/web/src/modules/jobs/JobCenter.tsx`
- Create: `packages/web/src/modules/jobs/WorkOrderCard.tsx`
- Create: `packages/web/src/modules/jobs/WorkOrderDetail.tsx`
- Create: `packages/web/src/modules/jobs/ProductionControls.tsx`
- Create: `packages/web/src/modules/jobs/DowntimeDialog.tsx`
- Create: `packages/web/src/modules/jobs/RejectDialog.tsx`
- Create: `packages/web/src/modules/jobs/CreateWorkOrderForm.tsx`

**Step 1: Build JobCenter main screen**

Area selector at the top (dropdown filtered to user's areas). Below: grid of WorkOrderCards for the selected area, sorted by priority then scheduled start.

Each card shows: order number, product name, work center, status badge, progress bar (produced/target), priority indicator.

**Step 2: Build WorkOrderDetail**

Full work order view when operator taps a card:
- Header: order number, product, recipe, work center, status
- Progress: quantity produced / target, quantity rejected
- Steps: list with status indicators
- Production log: scrollable list of recent events
- QC checks: pending/due checks with "Complete Check" button

**Step 3: Build ProductionControls**

Big, touch-friendly buttons at the bottom of WorkOrderDetail:
- **Start** (green, large) — when status is Released
- **Pause / Resume** — toggle
- **Log Count** — numeric input + submit
- **Log Reject** — opens RejectDialog (select reason code, enter count)
- **Log Downtime** — opens DowntimeDialog (select reason code, optional comment)
- **Complete** — when target reached

Buttons change based on work order status. Min touch target: 48px.

**Step 4: Build real-time updates**

Subscribe to Socket.io events for the selected area. Update work order cards and production counts in real-time without page refresh.

**Step 5: Build CreateWorkOrderForm**

Supervisor form: select product → auto-fills recipe, select work center, set quantity, priority, scheduled start.

**Step 6: Commit**

```bash
git commit -m "feat(mes): frontend Job Center with touch-friendly operator controls and real-time updates"
```

---

### Task 16: Frontend — Quality Control Screens

**Files:**
- Create: `packages/web/src/modules/quality/QcCheckList.tsx`
- Create: `packages/web/src/modules/quality/QcCheckForm.tsx`
- Create: `packages/web/src/modules/quality/DeviationList.tsx`
- Create: `packages/web/src/modules/quality/HoldManager.tsx`
- Create: `packages/web/src/modules/quality/QcTemplateEditor.tsx`

**Step 1: Build QcCheckList**

Shows pending and due QC checks. Filterable by work order, area, status. Due checks highlighted in amber/red based on how overdue.

**Step 2: Build QcCheckForm**

When operator taps a due check:
- Shows the template name and parameters
- For each parameter: input field (numeric, boolean toggle, text, selection)
- Numeric fields show target and limits, highlight red if out of spec
- Submit button: evaluates all results, auto-creates deviation if any out of spec
- Touch-friendly: large inputs, clear visual feedback

**Step 3: Build DeviationList**

Table of deviations with severity badges (minor/major/critical), linked work order, status (open/resolved). Filter by area, severity.

**Step 4: Build HoldManager**

Supervisor screen: list of active holds. Each shows work order, deviation, hold type. "Release" button opens disposition dialog (release/rework/scrap + justification text).

**Step 5: Build QcTemplateEditor (engineering screen)**

Create/edit QC templates: name, trigger type, trigger value, is_mandatory. Add/edit parameters: name, type, target, limits. Assign to work centers (bulk selector).

**Step 6: Commit**

```bash
git commit -m "feat(mes): frontend Quality Control with check forms, deviation tracking, and hold management"
```

---

## Phase 4: Plant Simulator

### Task 17: Simulator — Stochastic Distributions & Engine Core

**Files:**
- Create: `packages/simulator/package.json`
- Create: `packages/simulator/tsconfig.json`
- Create: `packages/simulator/src/distributions.ts`
- Create: `packages/simulator/src/engine.ts`
- Create: `packages/simulator/src/types.ts`
- Create: Tests

**Step 1: Scaffold the simulator package**

```bash
mkdir -p MES_Pilot/packages/simulator/src
cd MES_Pilot/packages/simulator
npm init -y
npm install typescript tsx
npm install --save-dev @types/node vitest
```

**Step 2: Implement statistical distributions**

```typescript
// packages/simulator/src/distributions.ts
// Seeded PRNG (Mulberry32 — simple, deterministic)
export class SeededRandom {
  private state: number;
  constructor(seed: number) { this.state = seed; }
  next(): number { /* Mulberry32 algorithm */ }
}

// Box-Muller for normal distribution
export function normal(rng: SeededRandom, mean: number, std: number): number

// Weibull for time-between-failures
export function weibull(rng: SeededRandom, shape: number, scale: number): number

// Poisson for event counts
export function poisson(rng: SeededRandom, lambda: number): number

// Exponential for inter-arrival times
export function exponential(rng: SeededRandom, rate: number): number

// Log-normal for repair times
export function logNormal(rng: SeededRandom, mean: number, std: number): number
```

**Step 3: Write tests for distributions**

```typescript
// Test: SeededRandom with same seed produces same sequence
// Test: normal distribution produces values within expected range over 10000 samples
// Test: mean and std of 10000 normal samples are close to parameters
// Test: weibull produces positive values
// Test: poisson produces non-negative integers
```

Run: `cd packages/simulator && npx vitest run`

**Step 4: Implement discrete-event engine**

```typescript
// packages/simulator/src/engine.ts
interface SimEvent {
  time: number;           // simulation time in seconds
  type: string;
  data: any;
}

export class SimulationEngine {
  private eventQueue: SimEvent[] = [];  // min-heap by time
  private currentTime: number = 0;
  private rng: SeededRandom;
  private timeScale: number;           // 60 = 1 real second = 60 sim seconds

  constructor(config: SimulationConfig) { ... }

  scheduleEvent(event: SimEvent): void { /* insert into heap */ }

  async run(durationSeconds: number): Promise<void> {
    while (this.eventQueue.length > 0 && this.currentTime < durationSeconds) {
      const event = this.dequeue();
      const realDelay = (event.time - this.currentTime) / this.timeScale;
      if (realDelay > 0) await sleep(realDelay * 1000);
      this.currentTime = event.time;
      await this.processEvent(event);
    }
  }

  private async processEvent(event: SimEvent): Promise<void> {
    // Dispatch to registered handlers
  }
}
```

**Step 5: Commit**

```bash
git commit -m "feat(mes): simulator core with seeded distributions and discrete-event engine"
```

---

### Task 18: Simulator — Equipment Models & Scenarios

**Files:**
- Create: `packages/simulator/src/equipment/simulated-work-center.ts`
- Create: `packages/simulator/src/equipment/production-simulator.ts`
- Create: `packages/simulator/src/scenarios/normal-day.json`
- Create: `packages/simulator/src/scenarios/bad-batch.json`
- Create: `packages/simulator/src/scenarios/unreliable-line.json`
- Create: Tests

**Step 1: Implement SimulatedWorkCenter**

```typescript
// packages/simulator/src/equipment/simulated-work-center.ts
export class SimulatedWorkCenter {
  constructor(private config: WorkCenterConfig, private rng: SeededRandom) {}

  // Generate next production cycle time (with variance)
  nextCycleTime(): number {
    return normal(this.rng, this.config.ideal_cycle_time_sec,
      this.config.ideal_cycle_time_sec * this.config.speed_variance_pct / 100);
  }

  // Check if a breakdown occurs (Weibull)
  shouldBreakdown(timeSinceLastBreakdown: number): boolean { ... }

  // Generate repair time (log-normal)
  repairDuration(): number { ... }

  // Check if unit is rejected (Bernoulli)
  isReject(): boolean { return this.rng.next() < this.config.reject_rate; }

  // Generate QC measurement (normal around target)
  generateQcMeasurement(paramName: string): number {
    const param = this.config.quality_params[paramName];
    return normal(this.rng, param.mean, param.std);
  }
}
```

**Step 2: Implement ProductionSimulator**

Orchestrates multiple SimulatedWorkCenters running work orders:

```typescript
export class ProductionSimulator {
  constructor(private engine: SimulationEngine, private workCenters: SimulatedWorkCenter[]) {}

  async simulateWorkOrder(workOrder: WorkOrderConfig): Promise<void> {
    // 1. Schedule 'start' event
    // 2. On each cycle: produce unit, check reject, check breakdown
    // 3. Periodically schedule QC checks
    // 4. On breakdown: schedule repair event
    // 5. On target reached: complete work order
  }
}
```

**Step 3: Create scenario JSON files**

```json
// packages/simulator/src/scenarios/normal-day.json
{
  "name": "Packaging Area - Normal Day",
  "time_scale": 60,
  "seed": 42,
  "shift_duration_hours": 8,
  "lines": [
    {
      "work_center_id": "pkg-line-1",
      "ideal_cycle_time_sec": 0.5,
      "speed_variance_pct": 3,
      "breakdown_mtbf_hours": 12,
      "breakdown_mttr_min": { "mean": 15, "std": 5 },
      "reject_rate": 0.002,
      "minor_stop_rate_per_hour": 1.5,
      "quality_params": {
        "fill_weight_g": { "mean": 500, "std": 1.8 }
      }
    }
  ],
  "work_orders": [
    { "product_sku": "PROD-001", "quantity": 10000 }
  ]
}
```

**Step 4: Write test**

```typescript
// Test: run "normal-day" scenario with seed 42, verify:
// - Produces expected total count (within ±5%)
// - Breakdown count is reasonable (1-3 per 8h shift)
// - Reject rate matches configured rate (within statistical bounds)
// - Same seed produces identical results
```

**Step 5: Commit**

```bash
git commit -m "feat(mes): simulator equipment models and pre-built scenarios"
```

---

### Task 19: Simulator — MES API Client & CLI

**Files:**
- Create: `packages/simulator/src/client.ts`
- Create: `packages/simulator/src/index.ts` (CLI entry point)
- Modify: `packages/simulator/package.json` (add "start" script)

**Step 1: Implement MES API client**

```typescript
// packages/simulator/src/client.ts
export class MesClient {
  constructor(private baseUrl: string, private apiKey?: string) {}

  async login(email: string): Promise<void> { /* dev login */ }
  async getReleasedWorkOrders(areaId: string): Promise<WorkOrder[]>
  async startWorkOrder(workOrderId: string): Promise<void>
  async logProduction(workOrderId: string, count: number): Promise<void>
  async logReject(workOrderId: string, count: number, reasonCodeId: string): Promise<void>
  async logDowntime(workOrderId: string, reasonCodeId: string, durationMin: number): Promise<void>
  async completeQcCheck(checkId: string, results: QcResult[]): Promise<void>
  async completeWorkOrder(workOrderId: string): Promise<void>
}
```

**Step 2: Create CLI entry point**

```typescript
// packages/simulator/src/index.ts
// Usage: npx tsx src/index.ts --scenario normal-day --api-url http://localhost:3000

import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: {
    scenario: { type: 'string', default: 'normal-day' },
    'api-url': { type: 'string', default: 'http://localhost:3000' },
    seed: { type: 'string' },
    'time-scale': { type: 'string', default: '60' },
  },
});

// Load scenario, create engine, connect to MES, run simulation
```

**Step 3: Integration test**

Start the MES API, seed a site/area/work-center/product/recipe/work-order, run the simulator against it, verify production logs appear in the database.

**Step 4: Commit**

```bash
git commit -m "feat(mes): simulator MES API client and CLI runner"
```

---

## Phase 5: Integration & Polish

### Task 20: Seed Data & End-to-End Smoke Test

**Files:**
- Create: `packages/api/src/seed.ts`
- Create: `packages/api/test/e2e/smoke.e2e-spec.ts`

**Step 1: Create comprehensive seed script**

Seeds a realistic FMCG plant:
- 1 Site: "Plant Amsterdam"
- 3 Areas: Batch Manufacturing, Discrete Manufacturing, Packaging
- 2 Work Centers per area (6 total), with 2-3 Work Units each
- 5 Products with master recipes (active)
- Reason codes for each category (downtime, reject, hold)
- QC templates with parameters per product
- 5 Users with different roles and area assignments
- 10 Work orders in various statuses

```bash
cd packages/api
npx ts-node src/seed.ts
```

**Step 2: Write E2E smoke test**

```typescript
// Test the full flow:
// 1. Login as supervisor
// 2. Create a work order for a product
// 3. Release the work order → verify control recipe created
// 4. Login as operator
// 5. Start the work order → verify QC checks generated
// 6. Log production counts
// 7. Complete a QC check (in spec) → verify passed
// 8. Complete a QC check (out of spec) → verify deviation created
// 9. Complete the work order
// 10. Verify audit log entries exist
```

Run: `cd packages/api && npm run test:e2e`

**Step 3: Commit**

```bash
git commit -m "feat(mes): seed data script and end-to-end smoke test"
```

---

### Task 21: Docker Compose Production Stack

**Files:**
- Modify: `MES_Pilot/docker-compose.yml` (full production config)
- Create: `MES_Pilot/packages/api/Dockerfile`
- Create: `MES_Pilot/packages/web/Dockerfile`
- Create: `MES_Pilot/nginx/nginx.conf`

**Step 1: Create Dockerfiles**

API Dockerfile: multi-stage build (build TypeScript → run with Node).
Web Dockerfile: build Vite SPA → serve from Nginx.

**Step 2: Create Nginx config**

```nginx
# Serve SPA static files
# Proxy /api/* and /socket.io/* to NestJS backend
# WebSocket upgrade handling for Socket.io
```

**Step 3: Update docker-compose.yml**

Full stack: PostgreSQL+TimescaleDB, Redis, API, Web (Nginx), simulator (optional).

**Step 4: Test**

```bash
docker compose up --build
# Verify: http://localhost → SPA loads, login works, API responds
```

**Step 5: Commit**

```bash
git commit -m "feat(mes): Docker Compose production stack with Nginx, API, and database"
```

---

## Summary: Task Dependency Graph

```
Task 1: Scaffolding
  └── Task 2: Database Schema
       ├── Task 3: Auth Module
       │    └── Task 4: Audit + i18n
       │         └── Task 5: Core Module (Equipment CRUD)
       │              ├── Task 6: Users Module
       │              ├── Task 7: Config Module
       │              └── Task 8: Recipe Module
       │                   └── Task 9: Jobs Module
       │                        └── Task 10: Quality Module
       │                             └── Task 11: Socket.io Gateway
       │                                  └── Task 12: Frontend Shell
       │                                       ├── Task 13: Frontend Config
       │                                       ├── Task 14: Frontend Recipes
       │                                       ├── Task 15: Frontend Job Center
       │                                       └── Task 16: Frontend QC
       └── Task 17: Simulator Core (independent)
            └── Task 18: Simulator Equipment
                 └── Task 19: Simulator Client

Tasks 13-16 + Task 19 → Task 20: Seed & E2E Test
Task 20 → Task 21: Docker Compose
```

**Parallelizable groups:**
- Tasks 6, 7, 8 can run in parallel (all depend only on Task 5)
- Tasks 13, 14, 15, 16 can run in parallel (all depend only on Task 12)
- Tasks 17-19 are fully independent from Tasks 6-16 (only need Task 1)
