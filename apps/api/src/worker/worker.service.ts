import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, LessThan, IsNull } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Worker, WorkerHeartbeat, Job, JobExecution, JobLog, Queue, DeadLetterQueueEntry } from 'shared';
import { RedisService } from '../redis/redis.service';
import { Queue as BullQueue } from 'bullmq';

@Injectable()
export class WorkerService {
  private readonly logger = new Logger(WorkerService.name);
  private bullQueues: Map<string, BullQueue> = new Map();

  constructor(
    @InjectRepository(Worker)
    private readonly workerRepository: Repository<Worker>,
    @InjectRepository(WorkerHeartbeat)
    private readonly heartbeatRepository: Repository<WorkerHeartbeat>,
    @InjectRepository(Job)
    private readonly jobRepository: Repository<Job>,
    @InjectRepository(JobExecution)
    private readonly executionRepository: Repository<JobExecution>,
    @InjectRepository(JobLog)
    private readonly logRepository: Repository<JobLog>,
    @InjectRepository(Queue)
    private readonly queueRepository: Repository<Queue>,
    private readonly redisService: RedisService,
    private readonly dataSource: DataSource
  ) {}

  private getBullQueue(queueName: string): BullQueue {
    let bq = this.bullQueues.get(queueName);
    if (!bq) {
      bq = new BullQueue(queueName, { connection: this.redisService.getClient() as any });
      this.bullQueues.set(queueName, bq);
    }
    return bq;
  }

  async registerWorker(id: string, hostname: string) {
    let worker = await this.workerRepository.findOne({ where: { id } });
    if (!worker) {
      worker = this.workerRepository.create({
        id,
        hostname,
        status: 'ACTIVE',
      });
    } else {
      worker.status = 'ACTIVE';
      worker.lastHeartbeatAt = new Date();
    }

    const savedWorker = await this.workerRepository.save(worker);
    this.logger.log(`Worker registered: ${id} on host ${hostname}`);
    return savedWorker;
  }

  async heartbeat(workerId: string, currentLoad: number) {
    const worker = await this.workerRepository.findOne({ where: { id: workerId } });
    if (!worker) {
      // Auto-register
      await this.registerWorker(workerId, 'unknown-host');
    } else {
      worker.status = 'ACTIVE';
      worker.lastHeartbeatAt = new Date();
      await this.workerRepository.save(worker);
    }

    const heartbeat = this.heartbeatRepository.create({
      workerId,
      currentLoad,
    });

    await this.heartbeatRepository.save(heartbeat);
  }

  async listWorkers() {
    return this.workerRepository.find({
      order: { lastHeartbeatAt: 'DESC' },
    });
  }

  // Cron running every 10 seconds to detect dead workers and recover abandoned jobs
  @Cron(CronExpression.EVERY_10_SECONDS)
  async recoverDeadWorkers() {
    this.logger.debug('Running dead worker recovery cron check...');
    const timeout = new Date(Date.now() - 30 * 1000); // 30 seconds threshold

    // Find active workers that haven't sent heartbeats in 30 seconds
    const deadWorkers = await this.workerRepository.find({
      where: {
        status: 'ACTIVE',
        lastHeartbeatAt: LessThan(timeout),
      },
    });

    for (const w of deadWorkers) {
      this.logger.warn(`Worker ${w.id} is dead (last heartbeat: ${w.lastHeartbeatAt}). Starting recovery...`);
      
      // Update worker status
      w.status = 'INACTIVE';
      await this.workerRepository.save(w);

      // Find jobs currently claimed or running by this worker
      const claimedJobs = await this.jobRepository.find({
        where: {
          claimedBy: w.id,
          status: 'RUNNING', // or CLAIMED
        },
      });

      for (const job of claimedJobs) {
        this.logger.warn(`Recovering job ${job.id} previously claimed by dead worker ${w.id}`);

        await this.dataSource.transaction(async (manager) => {
          // Add a job execution failure log
          const exec = await manager.findOne(JobExecution, {
            where: { jobId: job.id, workerId: w.id, finishedAt: IsNull(), status: 'RUNNING' as any },
            order: { attemptNumber: 'DESC' },
          });

          if (exec) {
            exec.status = 'FAILED';
            exec.finishedAt = new Date();
            exec.error = 'Worker connection lost (dead worker recovery)';
            exec.durationMs = Date.now() - exec.startedAt.getTime();
            await manager.save(JobExecution, exec);

            const log = manager.create(JobLog, {
              jobExecutionId: exec.id,
              level: 'ERROR',
              message: 'Worker connection lost. Job execution was aborted and is being rescheduled.',
            });
            await manager.save(JobLog, log);
          }

          // Check if retry is possible
          const queue = await manager.findOne(Queue, { where: { id: job.queueId } });
          if (job.attempt < job.maxRetries) {
            job.status = 'QUEUED';
            job.attempt += 1;
            job.claimedBy = '';
            await manager.save(Job, job);

            if (queue) {
              // Resubmit back to BullMQ
              await this.pushToBullMQ(queue.name, job);
            }
          } else {
            // Move to DLQ
            job.status = 'DLQ';
            job.failedAt = new Date();
            await manager.save(Job, job);

            const dlq = manager.create(DeadLetterQueueEntry, {
              jobId: job.id,
              finalError: 'Worker connection lost and maximum retries reached.',
              failureHistory: JSON.stringify([{ error: 'Worker connection lost' }]),
            });
            await manager.save(DeadLetterQueueEntry, dlq);
          }
        });
      }
    }
  }

  private async pushToBullMQ(queueName: string, dbJob: Job) {
    const bq = this.getBullQueue(queueName);
    await bq.add(
      dbJob.type,
      { jobId: dbJob.id },
      {
        priority: dbJob.priority,
        jobId: dbJob.id,
      }
    );
  }
}
