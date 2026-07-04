import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Queue, RetryPolicy, Project, Job } from 'shared';
import { QueueService } from './queue.service';
import { QueueController } from './queue.controller';
import { OrgModule } from '../org/org.module';

@Module({
  imports: [TypeOrmModule.forFeature([Queue, RetryPolicy, Project, Job]), OrgModule],
  controllers: [QueueController],
  providers: [QueueService],
  exports: [QueueService],
})
export class QueueModule {}
