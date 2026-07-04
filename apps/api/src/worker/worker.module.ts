import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Worker, WorkerHeartbeat, Job, JobExecution, JobLog, Queue } from 'shared';
import { WorkerService } from './worker.service';
import { WorkerController } from './worker.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Worker,
      WorkerHeartbeat,
      Job,
      JobExecution,
      JobLog,
      Queue,
    ]),
  ],
  controllers: [WorkerController],
  providers: [WorkerService],
  exports: [WorkerService],
})
export class WorkerModule {}
