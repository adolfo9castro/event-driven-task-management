import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';

@Injectable()
export class DeviceFingerprintMiddleware implements NestMiddleware {
    use(req: Request, res: Response, next: NextFunction) {
        const ip = req.ip || req.socket.remoteAddress || 'unknown';
        const userAgent = req.headers['user-agent'] || 'unknown';

        // Hash único SHA-256 basado en IP y Navegador
        req['deviceId'] = crypto.createHash('sha256').update(`${ip}-${userAgent}`).digest('hex');
        next();
    }
}