import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { Job, Queue, JobExecution, JobLog, DeadLetterQueueEntry, ScheduledJob } from 'shared';
import { RedisService } from '../redis/redis.service';
import { Queue as BullQueue } from 'bullmq';

@Injectable()
export class JobService {
  private readonly logger = new Logger(JobService.name);
  private bullQueues: Map<string, BullQueue> = new Map();

  constructor(
    @InjectRepository(Job)
    private readonly jobRepository: Repository<Job>,
    @InjectRepository(Queue)
    private readonly queueRepository: Repository<Queue>,
    @InjectRepository(JobExecution)
    private readonly executionRepository: Repository<JobExecution>,
    @InjectRepository(JobLog)
    private readonly logRepository: Repository<JobLog>,
    @InjectRepository(DeadLetterQueueEntry)
    private readonly dlqRepository: Repository<DeadLetterQueueEntry>,
    @InjectRepository(ScheduledJob)
    private readonly scheduledJobRepository: Repository<ScheduledJob>,
    private readonly redisService: RedisService,
    private readonly dataSource: DataSource
  ) {}

  private getBullQueue(queueName: string): BullQueue {
    let bq = this.bullQueues.get(queueName);
    if (!bq) {
      bq = new BullQueue(queueName, {
        connection: this.redisService.getClient() as any,
        defaultJobOptions: {
          removeOnComplete: true,
          removeOnFail: true,
        },
      });
      this.bullQueues.set(queueName, bq);
    }
    return bq;
  }

  async submitJob(
    queueId: string,
    dto: {
      type: 'IMMEDIATE' | 'DELAYED' | 'SCHEDULED' | 'RECURRING' | 'BATCH';
      payload: any;
      priority?: number;
      runAt?: string;
      delayMs?: number;
      cronExpression?: string;
      batchId?: string;
      idempotencyKey?: string;
      maxRetries?: number;
      parentJobIds?: string[]; // workflow dependencies
    }
  ) {
    const queue = await this.queueRepository.findOne({ where: { id: queueId } });
    if (!queue) {
      throw new NotFoundException('Queue not found');
    }

    if (queue.status === 'PAUSED') {
      throw new BadRequestException('Queue is currently paused');
    }

    // Rate Limiting Check
    if (queue.rateLimitWindowMs && queue.rateLimitMaxJobs) {
      const windowStart = new Date(Date.now() - queue.rateLimitWindowMs);
      const jobsCount = await this.jobRepository
        .createQueryBuilder('job')
        .where('job.queueId = :queueId', { queueId })
        .andWhere('job.createdAt >= :windowStart', { windowStart })
        .getCount();

      if (jobsCount >= queue.rateLimitMaxJobs) {
        throw new BadRequestException('Queue rate limit exceeded, please try again later');
      }
    }

    // Idempotency check
    if (dto.idempotencyKey) {
      const existing = await this.jobRepository.findOne({ where: { idempotencyKey: dto.idempotencyKey } });
      if (existing) {
        return existing; // Return existing job (Idempotent Execution Pattern)
      }
    }

    let runAt = new Date();
    if (dto.type === 'DELAYED' && dto.delayMs) {
      runAt = new Date(Date.now() + dto.delayMs);
    } else if (dto.type === 'SCHEDULED' && dto.runAt) {
      runAt = new Date(dto.runAt);
    }

    // Determine if we have unresolved dependencies
    let hasUnresolvedDependencies = false;
    let parentIdsStr = '';
    if (dto.parentJobIds && dto.parentJobIds.length > 0) {
      parentIdsStr = JSON.stringify(dto.parentJobIds);
      const parents = await this.jobRepository.find({
        where: { id: In(dto.parentJobIds) },
      });

      const uncompletedParents = parents.filter((p) => p.status !== 'COMPLETED');
      if (uncompletedParents.length > 0) {
        hasUnresolvedDependencies = true;
      }
    }

    const job = this.jobRepository.create({
      queueId,
      type: dto.type,
      payload: JSON.stringify(dto.payload),
      priority: dto.priority ?? queue.priority,
      status: hasUnresolvedDependencies ? 'SCHEDULED' : 'QUEUED',
      runAt,
      batchId: dto.batchId,
      idempotencyKey: dto.idempotencyKey,
      attempt: 0,
      maxRetries: dto.maxRetries ?? 3,
    });

    // Save job dependency metadata in payload/options if needed, or store it in a standard attribute
    // We can store the parent IDs as a metadata field inside the DB row
    // Let's attach them to a text column, we can use `batchId` or save inside the payload JSON
    if (dto.parentJobIds && dto.parentJobIds.length > 0) {
      const payloadObj = { ...dto.payload, _parentJobIds: dto.parentJobIds };
      job.payload = JSON.stringify(payloadObj);
    }

    const savedJob = await this.jobRepository.save(job);

    // If no parent dependencies are blocking, schedule in BullMQ
    if (!hasUnresolvedDependencies) {
      await this.pushToBullMQ(queue.name, savedJob, runAt);
    }

    return savedJob;
  }

  async pushToBullMQ(queueName: string, dbJob: Job, runAt: Date) {
    if (this.redisService.getIsMock()) {
      this.logger.log(`Mock Redis active. Skipping BullMQ scheduling for job ${dbJob.id}`);
      return;
    }

    const bq = this.getBullQueue(queueName);
    const delay = Math.max(0, runAt.getTime() - Date.now());

    await bq.add(
      dbJob.type,
      { jobId: dbJob.id },
      {
        delay,
        priority: dbJob.priority,
        jobId: dbJob.id, // BullMQ jobId matches DB jobId!
      }
    );

    this.logger.log(`Scheduled job ${dbJob.id} on BullMQ queue ${queueName} with delay ${delay}ms`);
  }

  // Submit jobs in batch
  async submitBatch(queueId: string, batchId: string, jobsDto: any[]) {
    const results = [];
    for (const j of jobsDto) {
      results.push(
        await this.submitJob(queueId, {
          type: 'BATCH',
          payload: j.payload,
          priority: j.priority,
          idempotencyKey: j.idempotencyKey,
          maxRetries: j.maxRetries,
          batchId,
        })
      );
    }
    return results;
  }

  // Handle workflow dependency resolution when a job completes
  async resolveDependentJobs(completedJobId: string) {
    // Find jobs that have completedJobId in their parent dependencies
    // Since we store dependencies in the payload JSON as `_parentJobIds`, we can run a simple database query
    const allJobs = await this.jobRepository.find({
      where: { status: 'SCHEDULED' },
    });

    for (const job of allJobs) {
      try {
        const payload = JSON.parse(job.payload);
        if (payload._parentJobIds && Array.isArray(payload._parentJobIds)) {
          if (payload._parentJobIds.includes(completedJobId)) {
            // Check if all parent jobs are completed now
            const parents = await this.jobRepository.find({
              where: { id: In(payload._parentJobIds) },
            });

            const uncompleted = parents.filter((p) => p.status !== 'COMPLETED');
            if (uncompleted.length === 0) {
              // Trigger job submission!
              job.status = 'QUEUED';
              await this.jobRepository.save(job);

              const queue = await this.queueRepository.findOne({ where: { id: job.queueId } });
              if (queue) {
                await this.pushToBullMQ(queue.name, job, new Date());
              }
            }
          }
        }
      } catch (err) {
        // ignore JSON parse error
      }
    }
  }

  async getJobDetails(jobId: string) {
    const job = await this.jobRepository.findOne({
      where: { id: jobId },
      relations: ['queue', 'executions', 'executions.logs', 'dlqEntries'],
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    return job;
  }

  async listQueueJobs(queueId: string, status?: string) {
    const where: any = { queueId };
    if (status) {
      where.status = status;
    }

    return this.jobRepository.find({
      where,
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  async getJobLogs(jobId: string) {
    const execs = await this.executionRepository.find({
      where: { jobId },
      relations: ['logs'],
      order: { attemptNumber: 'ASC' },
    });

    return execs.flatMap((e) =>
      e.logs.map((l) => ({
        attempt: e.attemptNumber,
        level: l.level,
        message: l.message,
        timestamp: l.timestamp,
      }))
    );
  }

  // Dead Letter Queue operations
  async listDlq(queueId: string) {
    return this.dlqRepository.find({
      where: { job: { queueId } },
      relations: ['job'],
      order: { movedAt: 'DESC' },
    });
  }

  async requeueJob(jobId: string) {
    const job = await this.jobRepository.findOne({ where: { id: jobId } });
    if (!job) {
      throw new NotFoundException('Job not found');
    }

    if (job.status !== 'DLQ') {
      throw new BadRequestException('Job is not in the Dead Letter Queue');
    }

    // Reset attempt count and set status back to QUEUED
    job.attempt = 0;
    job.status = 'QUEUED';
    job.runAt = new Date();
    await this.jobRepository.save(job);

    // Remove from DLQ entries
    await this.dlqRepository.delete({ jobId });

    // Submit back to BullMQ
    const queue = await this.queueRepository.findOne({ where: { id: job.queueId } });
    if (queue) {
      await this.pushToBullMQ(queue.name, job, new Date());
    }

    return { success: true, message: 'Job successfully requeued' };
  }
}
