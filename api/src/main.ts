import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

/**
 * Bootstraps the NestJS application with global configurations for:
 * - Versioned routing (/api/v1)
 * - Cross-Origin Resource Sharing (CORS)
 * - Global Validation Pipes
 */
async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  //Define security headers using Helmet middleware for enhanced security
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'https://validator.swagger.io'],
        upgradeInsecureRequests: [],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    frameguard: {
      action: 'deny',
    },
    hidePoweredBy: true,
    noSniff: true,
  }));

  // Define global prefix for API versioning as per REST best practices
  app.setGlobalPrefix('api/v1');

  //Define cookie parser middleware to handle cookies in requests and responses.
  app.use(cookieParser());

  // Enable CORS for frontend integration (Web/Client)
  app.enableCors({
    origin: configService.get('CORS_ORIGIN'),
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

  // Register the global exception filter
  app.useGlobalFilters(new HttpExceptionFilter());

  /**
   * OpenAPI (Swagger) Configuration
   */
  const config = new DocumentBuilder()
    .setTitle('Event-Driven Task Management API')
    .setDescription('The core API for managing tasks and triggering asynchronous background events.')
    .setVersion('1.0')
    .addTag('Tasks')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  // Swagger UI will be available at /api/v1/docs
  SwaggerModule.setup('api/v1/docs', app, document);

  const port = configService.get('PORT') || 3000;
  await app.listen(port);

  logger.log(`🚀 API is running on: http://localhost:${port}/api/v1`);
  logger.log(`🛠️  Environment: ${configService.get('NODE_ENV') || 'development'}`);
}

bootstrap();