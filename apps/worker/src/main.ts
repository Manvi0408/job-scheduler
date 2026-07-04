import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WorkerModule);
  console.log('Distributed Worker Process bootstrapped and listening on active queues...');
  
  // Enable graceful shutdown hooks
  app.enableShutdownHooks();
}

bootstrap();
