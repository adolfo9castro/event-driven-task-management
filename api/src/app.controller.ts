import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('System')
@Controller('health')
export class AppController {
  constructor(private readonly appService: AppService) { }

  @Get()
  @ApiOperation({ summary: 'API Health Check' })
  @ApiResponse({ status: 200, description: 'API is running optimally.' })
  getHealth() {
    return this.appService.getHealthStatus();
  }
}