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
    if (typeof data !== 'object' || data instanceof Date) return data;

    const resolved: any = {};
    for (const [key, value] of Object.entries(data)) {
      if (key.endsWith('I18n') && typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Date)) {
        const baseKey = key.replace(/I18n$/, '');
        const i18nObj = value as Record<string, string>;
        resolved[baseKey] = i18nObj[lang] || i18nObj['en'] || Object.values(i18nObj)[0];
        resolved[key] = value;
      } else if (typeof value === 'object' && value !== null) {
        resolved[key] = this.resolveI18n(value, lang);
      } else {
        resolved[key] = value;
      }
    }
    return resolved;
  }
}
