import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
// @ts-ignore
import RedisMock from 'ioredis-mock';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client!: Redis;
  private isMock = false;

  async onModuleInit() {
    const redisHost = process.env.REDIS_HOST || '127.0.0.1';
    const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);

    try {
      this.logger.log(`Attempting to connect to Redis at ${redisHost}:${redisPort}...`);
      
      const client = new Redis({
        host: redisHost,
        port: redisPort,
        maxRetriesPerRequest: null, // BullMQ requirement
        connectTimeout: 2000,
        lazyConnect: true,
        retryStrategy: () => null,
      });

      await client.connect();
      this.client = client;
      this.isMock = false;
      this.logger.log('Successfully connected to Redis!');
    } catch (err) {
      this.logger.warn(`Could not connect to Redis: ${(err as Error).message}. Falling back to ioredis-mock for local running/testing!`);
      this.client = new RedisMock({
        // Standard configuration for Mock
      });
      this.isMock = true;
    }
  }

  getClient(): Redis {
    return this.client;
  }

  getIsMock(): boolean {
    return this.isMock;
  }

  async onModuleDestroy() {
    if (this.client && !this.isMock) {
      try {
        await this.client.quit();
      } catch (err) {
        // ignore
      }
    }
  }
}
