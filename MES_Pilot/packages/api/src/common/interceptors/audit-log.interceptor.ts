import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../../modules/audit/entities/audit-log.entity.js';

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(
    @InjectRepository(AuditLog)
    private auditLogRepo: Repository<AuditLog>,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const method = request.method;

    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      return next.handle();
    }

    return next.handle().pipe(
      tap(async (responseData) => {
        try {
          const userId = request.user?.id;
          const action = `${method} ${request.route?.path || request.url}`;
          const entityId = responseData?.id || request.params?.id;
          const entityType = this.resolveEntityType(request.route?.path || request.url);

          if (entityType) {
            await this.auditLogRepo.save(
              this.auditLogRepo.create({
                userId,
                action,
                entityType,
                entityId: entityId || null,
                afterState: responseData,
              }),
            );
          }
        } catch (error) {
          console.error('Audit log error:', error);
        }
      }),
    );
  }

  private resolveEntityType(path: string): string {
    const segments = path.split('/').filter(Boolean);
    return segments.find((s) => s !== 'api' && !s.startsWith(':')) || 'unknown';
  }
}
