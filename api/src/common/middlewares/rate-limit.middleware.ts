import { Injectable, NestMiddleware, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
    private hits = new Map<string, { count: number; resetTime: number }>();
    private readonly LIMIT = 60; // 60 peticiones
    private readonly WINDOW_MS = 60000; // Por minuto

    use(req: Request, res: Response, next: NextFunction) {
        const deviceId = req['deviceId'];
        const now = Date.now();
        let record = this.hits.get(deviceId);

        if (!record || now > record.resetTime) {
            record = { count: 1, resetTime: now + this.WINDOW_MS };
        } else {
            record.count++;
        }

        this.hits.set(deviceId, record);

        res.setHeader('X-RateLimit-Limit', this.LIMIT);
        res.setHeader('X-RateLimit-Remaining', Math.max(0, this.LIMIT - record.count));

        if (record.count > this.LIMIT) {
            throw new HttpException('Too Many Requests. Slow down.', HttpStatus.TOO_MANY_REQUESTS);
        }
        next();
    }
}