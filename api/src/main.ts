import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

/**
 * Bootstraps the NestJS application with global configurations for:
 * - Versioned routing (/api/v1)
 * - Cross-Origin Resource Sharing (CORS)
 * - Global Validation Pipes
 */
async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Define global prefix for API versioning as per REST best practices
  app.setGlobalPrefix('api/v1');

  // Enable CORS for frontend integration (Web/Client)
  app.enableCors({
    origin: true, // In production, replace with specific domain
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // Enforce strict type validation for incoming DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = process.env.PORT || 3000;
  await app.listen(port);

  logger.log(`🚀 API is running on: http://localhost:${port}/api/v1`);
  logger.log(`🛠️  Environment: ${process.env.NODE_ENV || 'development'}`);
}

bootstrap();