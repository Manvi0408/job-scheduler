import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { Queue, Job, JobExecution, JobLog, DeadLetterQueueEntry, Worker, WorkerHeartbeat } from 'shared';
import { RedisService } from './redis.service';
import { WorkerService } from './worker.service';
import * as entities from 'shared';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env', '../.env'],
    }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const dbUrl = configService.get<string>('DATABASE_URL');
        if (!dbUrl) {
          throw new Error('DATABASE_URL environment variable is missing');
        }

        const isPostgres = dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://');
        const entityClasses = Object.values(entities).filter(
          (val) => typeof val === 'function' && val.name && val.prototype
        );

        return {
          type: (isPostgres ? 'postgres' : 'mysql') as any,
          url: dbUrl,
          entities: entityClasses as any,
          synchronize: true,
          logging: false,
        };
      },
    }),
    TypeOrmModule.forFeature([
      Queue,
      Job,
      JobExecution,
      JobLog,
      DeadLetterQueueEntry,
      Worker,
      WorkerHeartbeat,
    ]),
  ],
  providers: [RedisService, WorkerService],
})
export class WorkerModule {}
