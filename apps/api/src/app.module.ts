import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { DatabaseModule } from './database/database.module';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './auth/auth.module';
import { OrgModule } from './org/org.module';
import { ProjectModule } from './project/project.module';
import { QueueModule } from './queue/queue.module';
import { JobModule } from './job/job.module';
import { WorkerModule } from './worker/worker.module';
import { TelemetryModule } from './telemetry/telemetry.module';
import { AiModule } from './ai/ai.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env', '../.env'],
    }),
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
    // Baseline rate limiting for all endpoints: 100 requests / minute / IP.
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    DatabaseModule,
    RedisModule,
    AuthModule,
    OrgModule,
    ProjectModule,
    QueueModule,
    JobModule,
    WorkerModule,
    TelemetryModule,
    AiModule,
  ],
  providers: [
    // Apply the baseline throttler to every route by default.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
