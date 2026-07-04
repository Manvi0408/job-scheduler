import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In, IsNull, LessThan } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Queue, Job, JobExecution, JobLog, DeadLetterQueueEntry, RetryPolicy, Worker } from 'shared';
import { RedisService } from './redis.service';
import { Worker as BullWorker, Job as BullJob, Queue as BullQueue } from 'bullmq';
import * as os from 'os';

@Injectable()
export class WorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WorkerService.name);
  private workerId!: string;
  private hostname!: string;
  private activeWorkers: Map<string, BullWorker> = new Map();
  private processingJobsCount = 0;
  private isShuttingDown = false;

  constructor(
    @InjectRepository(Queue)
    private readonly queueRepository: Repository<Queue>,
    @InjectRepository(Job)
    private readonly jobRepository: Repository<Job>,
    @InjectRepository(JobExecution)
    private readonly executionRepository: Repository<JobExecution>,
    @InjectRepository(JobLog)
    private readonly logRepository: Repository<JobLog>,
    @InjectRepository(DeadLetterQueueEntry)
    private readonly dlqRepository: Repository<DeadLetterQueueEntry>,
    @InjectRepository(Worker)
    private readonly workerRepository: Repository<Worker>,
    private readonly redisService: RedisService,
    private readonly dataSource: DataSource
  ) {}

  async onModuleInit() {
    this.hostname = os.hostname();
    this.workerId = `worker-${this.hostname}-${Math.random().toString(36).substr(2, 9)}`;
    this.logger.log(`Initializing worker process: ${this.workerId} on host ${this.hostname}`);

    // Register worker node in the database
    await this.registerInDatabase();

    // Start polling queues
    await this.syncQueues();
  }

  private async registerInDatabase() {
    try {
      const worker = this.workerRepository.create({
        id: this.workerId,
        hostname: this.hostname,
        status: 'ACTIVE',
      });
      await this.workerRepository.save(worker);
    } catch (err) {
      this.logger.error(`Failed to register worker in database: ${(err as Error).message}`);
    }
  }

  // Periodic heartbeat reporter (every 5 seconds)
  @Cron(CronExpression.EVERY_5_SECONDS)
  async reportHeartbeat() {
    if (this.isShuttingDown) return;
    try {
      // Direct database update to prevent API dependency during startup
      const worker = await this.workerRepository.findOne({ where: { id: this.workerId } });
      if (worker) {
        worker.status = 'ACTIVE';
        worker.lastHeartbeatAt = new Date();
        await this.workerRepository.save(worker);
      }

      // Add a heartbeat entry
      await this.dataSource.query(
        `INSERT INTO worker_heartbeats (id, workerId, currentLoad, lastSeenAt) VALUES (uuid(), ?, ?, now())`,
        [this.workerId, this.processingJobsCount]
      );
    } catch (err) {
      this.logger.error(`Failed to report heartbeat: ${(err as Error).message}`);
    }
  }

  // Periodic polling for mock Redis (every 5 seconds)
  @Cron(CronExpression.EVERY_5_SECONDS)
  async pollDatabaseJobs() {
    if (!this.redisService.getIsMock() || this.isShuttingDown) return;

    try {
      // Find all active queues
      const queues = await this.queueRepository.find({
        where: { status: 'ACTIVE' },
        relations: ['retryPolicy']
      });
      if (queues.length === 0) return;
      const queueIds = queues.map(q => q.id);

      // Find jobs that are QUEUED or RETRYING and runAt <= now
      const now = new Date();
      const jobs = await this.jobRepository.find({
        where: {
          status: In(['QUEUED', 'RETRYING']),
          runAt: LessThan(now),
          queueId: In(queueIds)
        },
        order: { priority: 'DESC', createdAt: 'ASC' },
        take: 5
      });

      for (const job of jobs) {
        const queue = queues.find(q => q.id === job.queueId);
        if (!queue) continue;

        // Process job using mock BullJob structure
        const mockBullJob = {
          data: { jobId: job.id },
          id: job.id,
          name: job.type,
        } as any;

        // Claim and execute job asynchronously
        this.processJob(mockBullJob, queue).catch(err => {
          this.logger.error(`Error processing polled job ${job.id}: ${err.message}`);
        });
      }
    } catch (err) {
      this.logger.error(`Failed to poll database jobs: ${(err as Error).message}`);
    }
  }

  // Dynamic queue sync (runs every 10 seconds)
  @Cron(CronExpression.EVERY_10_SECONDS)
  async syncQueues() {
    if (this.isShuttingDown) return;
    try {
      // Find all active queues from database
      const queues = await this.queueRepository.find({
        where: { status: 'ACTIVE' },
        relations: ['retryPolicy'],
      });

      const activeQueueNames = new Set(queues.map((q) => q.name));

      // Close workers for queues that are no longer active or have been paused/deleted
      for (const [queueName, worker] of this.activeWorkers.entries()) {
        if (!activeQueueNames.has(queueName)) {
          this.logger.log(`Pausing/stopping worker for queue: ${queueName}`);
          await worker.close();
          this.activeWorkers.delete(queueName);
        }
      }

      // Spin up workers for new queues
      for (const q of queues) {
        if (!this.activeWorkers.has(q.name)) {
          this.logger.log(`Starting worker for queue: ${q.name} (concurrency: ${q.concurrencyLimit})`);
          
          if (!this.redisService.getIsMock()) {
            const worker = new BullWorker(
              q.name,
              async (bullJob) => this.processJob(bullJob, q),
              {
                connection: this.redisService.getClient() as any,
                concurrency: q.concurrencyLimit,
              }
            );

            worker.on('error', (err) => {
              this.logger.error(`Worker error on queue ${q.name}: ${err.message}`);
            });

            this.activeWorkers.set(q.name, worker);
          } else {
            this.activeWorkers.set(q.name, {
              close: async () => {},
              opts: { concurrency: q.concurrencyLimit },
            } as any);
          }
        } else {
          // Concurrency limit adjustment
          const worker = this.activeWorkers.get(q.name)!;
          if (worker.opts.concurrency !== q.concurrencyLimit) {
            this.logger.log(`Adjusting concurrency limit for ${q.name} to ${q.concurrencyLimit}`);
            // Re-create worker to apply concurrency changes
            await worker.close();
            
            if (!this.redisService.getIsMock()) {
              const newWorker = new BullWorker(
                q.name,
                async (bullJob) => this.processJob(bullJob, q),
                {
                  connection: this.redisService.getClient() as any,
                  concurrency: q.concurrencyLimit,
                }
              );
              this.activeWorkers.set(q.name, newWorker);
            } else {
              this.activeWorkers.set(q.name, {
                close: async () => {},
                opts: { concurrency: q.concurrencyLimit },
              } as any);
            }
          }
        }
      }
    } catch (err) {
      this.logger.error(`Failed to sync queues: ${(err as Error).message}`);
    }
  }

  // Atomically claim and process jobs
  private async processJob(bullJob: BullJob, queue: Queue) {
    const jobId = bullJob.data.jobId;
    this.processingJobsCount++;

    const dbJob = await this.jobRepository.findOne({ where: { id: jobId } });
    if (!dbJob || dbJob.status === 'COMPLETED' || dbJob.status === 'DLQ') {
      this.processingJobsCount = Math.max(0, this.processingJobsCount - 1);
      return;
    }

    // Atomic claim check in DB: Set claimedBy and status to RUNNING
    // Using transaction to prevent concurrent duplicate execution (Double-Execution Avoidance Pattern)
    const claimedJob = await this.dataSource.transaction(async (manager) => {
      const job = await manager.findOne(Job, {
        where: { id: jobId, status: In(['QUEUED', 'RETRYING']) },
        lock: { mode: 'pessimistic_write' }, // Row lock
      });

      if (!job) return null;

      job.status = 'RUNNING';
      job.claimedBy = this.workerId;
      job.claimedAt = new Date();
      job.startedAt = new Date();
      job.attempt += 1;

      return manager.save(Job, job);
    });

    if (!claimedJob) {
      this.logger.warn(`Job ${jobId} already running or claimed by another worker.`);
      this.processingJobsCount = Math.max(0, this.processingJobsCount - 1);
      return;
    }

    // Create execution history
    const execution = this.executionRepository.create({
      jobId,
      workerId: this.workerId,
      attemptNumber: claimedJob.attempt,
      status: 'RUNNING',
    });
    const savedExec = await this.executionRepository.save(execution);

    // Save initial running log
    await this.logMessage(savedExec.id, 'INFO', `Worker ${this.workerId} started processing this job.`);

    const startTime = Date.now();
    try {
      // Execute the job workload payload
      const payload = JSON.parse(claimedJob.payload);
      
      // Execute dynamic tasks based on type or simulate execution latency
      await this.logMessage(savedExec.id, 'INFO', `Running task payload: ${JSON.stringify(payload)}`);
      
      // Simulate task workload execution duration
      const workloadDelay = payload.durationMs || Math.floor(Math.random() * 800) + 200;
      await new Promise((resolve) => setTimeout(resolve, workloadDelay));

      // Check if payload requests simulated crash
      if (payload.simulateFailure === true || payload.simulateFailure === 'true') {
        throw new Error(payload.simulateErrorMsg || 'Simulated runtime execution error.');
      }

      // Success branch
      const durationMs = Date.now() - startTime;
      await this.logMessage(savedExec.id, 'INFO', `Task completed successfully in ${durationMs}ms.`);

      await this.dataSource.transaction(async (manager) => {
        claimedJob.status = 'COMPLETED';
        claimedJob.completedAt = new Date();
        await manager.save(Job, claimedJob);

        savedExec.status = 'COMPLETED';
        savedExec.finishedAt = new Date();
        savedExec.durationMs = durationMs;
        await manager.save(JobExecution, savedExec);
      });

      // Event emitter hooks for gateway socket triggers
      await this.emitRealtimeEvent('job.status', {
        jobId,
        queueId: queue.id,
        status: 'COMPLETED',
        attempt: claimedJob.attempt,
      });

      // Trigger dependent workflows
      await this.resolveDependentWorkflows(jobId);

    } catch (err) {
      // Failure branch
      const durationMs = Date.now() - startTime;
      const errorMsg = (err as Error).message || (err as Error).stack || 'Unknown error';
      this.logger.error(`Job ${jobId} failed: ${errorMsg}`);
      
      await this.logMessage(savedExec.id, 'ERROR', `Task execution failed: ${errorMsg}`);

      await this.dataSource.transaction(async (manager) => {
        savedExec.status = 'FAILED';
        savedExec.finishedAt = new Date();
        savedExec.error = errorMsg;
        savedExec.durationMs = durationMs;
        await manager.save(JobExecution, savedExec);

        const retryPolicy = queue.retryPolicy;
        const maxRetries = claimedJob.maxRetries;

        if (claimedJob.attempt < maxRetries) {
          // Reschedule for Retry
          claimedJob.status = 'RETRYING';
          const backoffDelay = this.calculateBackoff(retryPolicy, claimedJob.attempt);
          const nextRun = new Date(Date.now() + backoffDelay);
          claimedJob.runAt = nextRun;
          
          await manager.save(Job, claimedJob);
          
          if (!this.redisService.getIsMock()) {
            // Re-insert into BullMQ with retry delay
            const bq = new BullQueue(queue.name, { connection: this.redisService.getClient() as any });
            await bq.add(
              claimedJob.type,
              { jobId: claimedJob.id },
              {
                delay: backoffDelay,
                priority: claimedJob.priority,
                jobId: claimedJob.id,
              }
            );
          }

          await this.logMessage(
            savedExec.id,
            'WARN',
            `Rescheduled for retry attempt ${claimedJob.attempt + 1}/${maxRetries} in ${backoffDelay}ms.`
          );

          await this.emitRealtimeEvent('job.status', {
            jobId,
            queueId: queue.id,
            status: 'RETRYING',
            attempt: claimedJob.attempt,
          });
        } else {
          // Move to Dead Letter Queue (DLQ)
          claimedJob.status = 'DLQ';
          claimedJob.failedAt = new Date();
          await manager.save(Job, claimedJob);

          // Add a job execution failure log
          const exec = await manager.findOne(JobExecution, {
            where: { jobId: jobId, workerId: this.workerId, finishedAt: IsNull(), status: 'RUNNING' as any },
            order: { attemptNumber: 'DESC' },
          });

          // Get full failure history
          const execs = await manager.find(JobExecution, { where: { jobId } });
          const failureHistory = execs.map((e) => ({
            attempt: e.attemptNumber,
            error: e.error,
            durationMs: e.durationMs,
            finishedAt: e.finishedAt,
          }));

          const dlq = manager.create(DeadLetterQueueEntry, {
            jobId,
            finalError: errorMsg,
            failureHistory: JSON.stringify(failureHistory),
          });
          await manager.save(DeadLetterQueueEntry, dlq);

          await this.logMessage(
            savedExec.id,
            'ERROR',
            `Maximum retry limits reached. Job moved to Dead Letter Queue.`
          );

          await this.emitRealtimeEvent('job.status', {
            jobId,
            queueId: queue.id,
            status: 'DLQ',
            attempt: claimedJob.attempt,
          });
        }
      });
    } finally {
      this.processingJobsCount = Math.max(0, this.processingJobsCount - 1);
    }
  }

  // Log write utility
  private async logMessage(executionId: string, level: 'INFO' | 'WARN' | 'ERROR', message: string) {
    try {
      const log = this.logRepository.create({
        jobExecutionId: executionId,
        level,
        message,
      });
      await this.logRepository.save(log);
    } catch (err) {
      // ignore log save error
    }
  }

  private calculateBackoff(policy: RetryPolicy, attempt: number): number {
    if (!policy) {
      return 1000 * Math.pow(2, attempt - 1);
    }
    const base = policy.baseDelayMs;
    const max = policy.maxDelayMs;

    let delay = base;
    if (policy.strategy === 'LINEAR') {
      delay = base * attempt;
    } else if (policy.strategy === 'EXPONENTIAL') {
      delay = base * Math.pow(2, attempt - 1);
    }

    return Math.min(delay, max);
  }

  // Publish event back to database/sockets
  private async emitRealtimeEvent(channel: string, payload: any) {
    try {
      // Workers directly communicate state transitions back by publishing to Redis pub/sub
      // which the API Gateway listens to and broadcasts!
      await this.redisService.getClient().publish(channel, JSON.stringify(payload));
    } catch (err) {
      this.logger.error(`WebSocket Pub failed: ${(err as Error).message}`);
    }
  }

  // Trigger dependent workflows in database
  private async resolveDependentWorkflows(completedJobId: string) {
    try {
      // Call API to trigger dependency checks
      // Since workers share the database, they can check if any scheduled job is waiting for this parent
      const scheduledJobs = await this.jobRepository.find({
        where: { status: 'SCHEDULED' },
      });

      for (const j of scheduledJobs) {
        const payload = JSON.parse(j.payload);
        if (payload._parentJobIds && Array.isArray(payload._parentJobIds)) {
          if (payload._parentJobIds.includes(completedJobId)) {
            const parents = await this.jobRepository.find({
              where: { id: In(payload._parentJobIds) },
            });

            const uncompleted = parents.filter((p) => p.status !== 'COMPLETED');
            if (uncompleted.length === 0) {
              // Atomically advance state to QUEUED
              j.status = 'QUEUED';
              await this.jobRepository.save(j);

              // Push to BullMQ queue
              const queue = await this.queueRepository.findOne({ where: { id: j.queueId } });
              if (queue) {
                const bq = new BullQueue(queue.name, { connection: this.redisService.getClient() as any });
                await bq.add(j.type, { jobId: j.id }, { priority: j.priority, jobId: j.id });
              }
            }
          }
        }
      }
    } catch (err) {
      this.logger.error(`Dependency resolution failed: ${(err as Error).message}`);
    }
  }

  // Graceful shutdown
  async onModuleDestroy() {
    this.isShuttingDown = true;
    this.logger.log('Graceful shutdown initiated. Pausing claiming pipelines...');

    // Close all workers
    for (const [queueName, worker] of this.activeWorkers.entries()) {
      this.logger.log(`Closing worker connection for queue: ${queueName}`);
      await worker.close();
    }

    // Mark worker node INACTIVE
    try {
      const worker = await this.workerRepository.findOne({ where: { id: this.workerId } });
      if (worker) {
        worker.status = 'INACTIVE';
        await this.workerRepository.save(worker);
      }
    } catch (err) {
      // ignore
    }

    this.logger.log('Worker closed gracefully.');
  }
}
