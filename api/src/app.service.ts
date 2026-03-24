import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  /**
   * Returns the current health status and uptime of the API.
   */
  getHealthStatus() {
    return {
      status: 'OK',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
    };
  }
}