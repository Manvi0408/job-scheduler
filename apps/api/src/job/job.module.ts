import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Job, Queue, JobExecution, JobLog, DeadLetterQueueEntry, ScheduledJob } from 'shared';
import { JobService } from './job.service';
import { JobController } from './job.controller';
import { OrgModule } from '../org/org.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Job,
      Queue,
      JobExecution,
      JobLog,
      DeadLetterQueueEntry,
      ScheduledJob,
    ]),
    OrgModule,
  ],
  controllers: [JobController],
  providers: [JobService],
  exports: [JobService],
})
export class JobModule {}
