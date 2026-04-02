import { Injectable, NestInterceptor, ExecutionContext, CallHandler, ConflictException } from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class ResilienceInterceptor implements NestInterceptor {

    private cache = new Map<string, { data: any; expiry: number }>();
    private processedRequests = new Set<string>();

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const request = context.switchToHttp().getRequest();
        const method = request.method;
        const url = request.url;
        const deviceId = request['deviceId'];
        const idempotencyKey = request.headers['x-idempotency-key'];

        if (['POST', 'PATCH', 'DELETE'].includes(method) && idempotencyKey) {
            if (this.processedRequests.has(idempotencyKey)) {
                throw new ConflictException('Request already processed (Idempotency check)');
            }
        }

        const cacheKey = `CACHE_${deviceId}_${url}`;
        if (method === 'GET') {
            const cached = this.cache.get(cacheKey);
            if (cached && cached.expiry > Date.now()) {
                const response = context.switchToHttp().getResponse();
                response.setHeader('X-Cache', 'HIT');
                return of(cached.data);
            }
        }

        return next.handle().pipe(
            tap((data) => {
                if (method === 'GET') {
                    // Cachear resultados GET por 5 segundos
                    this.cache.set(cacheKey, { data, expiry: Date.now() + 5000 });
                }
                if (idempotencyKey) {
                    // Registrar clave procesada para evitar duplicados en la BD
                    this.processedRequests.add(idempotencyKey);
                }
            }),
        );
    }
}