import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeviceFingerprintMiddleware } from './common/middlewares/device-fingerprint.middleware';
import { RateLimitMiddleware } from './common/middlewares/rate-limit.middleware';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { Task } from './tasks/entities/task.entity';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { TasksModule } from './tasks/tasks.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'mysql',
        host: configService.get<string>('DB_HOST'),
        port: configService.get<number>('DB_PORT'),
        username: configService.get<string>('DB_USER'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_NAME'),
        entities: [Task],
        synchronize: true, // Only for development/assessment purposes
        logging: configService.get('NODE_ENV') === 'development' || configService.get('NODE_ENV') === 'local',
        logger: 'advanced-console',
      }),
    }),
    EventEmitterModule.forRoot({
      // Global configuration for the event emitter
      wildcard: true,
      delimiter: '.',
    }),
    TasksModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(DeviceFingerprintMiddleware, RateLimitMiddleware)
      .forRoutes('*');
  }
}