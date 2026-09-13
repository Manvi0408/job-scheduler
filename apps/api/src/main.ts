import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { CentralExceptionFilter } from './utils/exceptions';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS: a wildcard origin ('*') is invalid together with credentials:true and
  // browsers reject it. Reflect the request origin by default, or restrict to a
  // comma-separated allowlist via CORS_ORIGIN (e.g. your deployed dashboard URL).
  const corsOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean)
    : null;
  app.enableCors({
    origin: corsOrigins && corsOrigins.length ? corsOrigins : true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  app.setGlobalPrefix('api');

  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    })
  );

  app.useGlobalFilters(new CentralExceptionFilter());

  // Configure Swagger Documenter
  const config = new DocumentBuilder()
    .setTitle('Distributed Job Scheduler API')
    .setDescription('Production-grade Distributed Background Job Processing Platform')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  // Bind to 0.0.0.0 so the container is reachable on hosts like Render/Railway
  // (binding to localhost only makes the service unreachable from outside).
  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`API Application is running on port ${port} (prefix /api/v1)`);
  console.log(`Swagger documentation is available at /docs`);
}

bootstrap();
