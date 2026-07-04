import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Queue, RetryPolicy, Project, Job, User, Organization, OrganizationMember } from 'shared';

@Injectable()
export class QueueService {
  constructor(
    @InjectRepository(Queue)
    private readonly queueRepository: Repository<Queue>,
    @InjectRepository(RetryPolicy)
    private readonly retryPolicyRepository: Repository<RetryPolicy>,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    @InjectRepository(Job)
    private readonly jobRepository: Repository<Job>,
    private readonly dataSource: DataSource
  ) {}

  async onModuleInit() {
    // Seed default User, Organization, and Project for bypass auth
    const defaultUserEmail = 'admin@scheduler.io';
    const defaultOrgId = '00000000-0000-0000-0000-000000000000';
    const defaultProjectId = '00000000-0000-0000-0000-000000000000';

    try {
      await this.dataSource.transaction(async (manager) => {
        let user = await manager.findOne(User, { where: { email: defaultUserEmail } });
        if (!user) {
          user = manager.create(User, {
            email: defaultUserEmail,
            passwordHash: 'bypassed',
          });
          user = await manager.save(User, user);
        }

        let org = await manager.findOne(Organization, { where: { id: defaultOrgId } });
        if (!org) {
          org = manager.create(Organization, {
            id: defaultOrgId,
            name: 'Default Organization',
            ownerId: user.id,
          });
          org = await manager.save(Organization, org);
        }

        let member = await manager.findOne(OrganizationMember, {
          where: { userId: user.id, organizationId: org.id },
        });
        if (!member) {
          member = manager.create(OrganizationMember, {
            userId: user.id,
            organizationId: org.id,
            role: 'OWNER',
          });
          await manager.save(OrganizationMember, member);
        }

        let proj = await manager.findOne(Project, { where: { id: defaultProjectId } });
        if (!proj) {
          proj = manager.create(Project, {
            id: defaultProjectId,
            name: 'Default Project',
            organizationId: org.id,
          });
          await manager.save(Project, proj);
        }
      });
    } catch (err) {
      console.error('Error seeding default organizations/projects:', err);
    }

    // Seed default retry policies
    const defaults = [
      { name: 'Default Fixed', strategy: 'FIXED' as const, baseDelayMs: 1000, maxDelayMs: 5000, maxRetries: 3 },
      { name: 'Default Linear', strategy: 'LINEAR' as const, baseDelayMs: 2000, maxDelayMs: 10000, maxRetries: 3 },
      { name: 'Default Exponential', strategy: 'EXPONENTIAL' as const, baseDelayMs: 1000, maxDelayMs: 60000, maxRetries: 5 },
    ];

    for (const d of defaults) {
      const existing = await this.retryPolicyRepository.findOne({ where: { name: d.name } });
      if (!existing) {
        await this.retryPolicyRepository.save(this.retryPolicyRepository.create(d));
      }
    }
  }

  async createQueue(
    projectId: string,
    name: string,
    priority: number,
    concurrencyLimit: number,
    retryPolicyId: string,
    rateLimitWindowMs?: number,
    rateLimitMaxJobs?: number
  ) {
    const project = await this.projectRepository.findOne({ where: { id: projectId } });
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const policy = await this.retryPolicyRepository.findOne({ where: { id: retryPolicyId } });
    if (!policy) {
      throw new NotFoundException('Retry policy not found');
    }

    const existing = await this.queueRepository.findOne({ where: { projectId, name } });
    if (existing) {
      throw new BadRequestException('A queue with this name already exists in this project');
    }

    const queue = this.queueRepository.create({
      projectId,
      name,
      priority,
      concurrencyLimit,
      retryPolicyId,
      rateLimitWindowMs,
      rateLimitMaxJobs,
      status: 'ACTIVE',
    });

    return this.queueRepository.save(queue);
  }

  async listProjectQueues(projectId: string) {
    return this.queueRepository.find({
      where: { projectId },
      relations: ['retryPolicy'],
    });
  }

  async getQueueDetails(queueId: string) {
    const queue = await this.queueRepository.findOne({
      where: { id: queueId },
      relations: ['retryPolicy'],
    });

    if (!queue) {
      throw new NotFoundException('Queue not found');
    }

    return queue;
  }

  async getQueueHealth(queueId: string) {
    const queue = await this.getQueueDetails(queueId);

    // Query job counts by status
    const statusCounts = await this.jobRepository
      .createQueryBuilder('job')
      .select('job.status', 'status')
      .addSelect('COUNT(job.id)', 'count')
      .where('job.queueId = :queueId', { queueId })
      .groupBy('job.status')
      .getRawMany();

    const counts: Record<string, number> = {
      QUEUED: 0,
      SCHEDULED: 0,
      CLAIMED: 0,
      RUNNING: 0,
      COMPLETED: 0,
      FAILED: 0,
      RETRYING: 0,
      DLQ: 0,
    };

    for (const row of statusCounts) {
      counts[row.status] = parseInt(row.count, 10);
    }

    // Calculate latency metrics from executions
    // Let's get average duration of completed jobs
    const durationRes = await this.jobRepository.query(
      `SELECT AVG(durationMs) as avgDuration FROM job_executions 
       INNER JOIN jobs ON job_executions.jobId = jobs.id 
       WHERE jobs.queueId = ? AND job_executions.status = 'COMPLETED'`,
      [queueId]
    );

    const averageDurationMs = Math.round(parseFloat(durationRes[0]?.avgDuration || '0'));

    return {
      queueId: queue.id,
      name: queue.name,
      status: queue.status,
      concurrencyLimit: queue.concurrencyLimit,
      priority: queue.priority,
      jobCounts: counts,
      metrics: {
        averageDurationMs,
      },
    };
  }

  async updateQueue(
    queueId: string,
    attrs: {
      priority?: number;
      concurrencyLimit?: number;
      retryPolicyId?: string;
      status?: 'ACTIVE' | 'PAUSED';
      rateLimitWindowMs?: number;
      rateLimitMaxJobs?: number;
    }
  ) {
    const queue = await this.getQueueDetails(queueId);

    if (attrs.retryPolicyId) {
      const policy = await this.retryPolicyRepository.findOne({ where: { id: attrs.retryPolicyId } });
      if (!policy) {
        throw new NotFoundException('Retry policy not found');
      }
    }

    Object.assign(queue, attrs);
    return this.queueRepository.save(queue);
  }

  async getRetryPolicies() {
    return this.retryPolicyRepository.find();
  }

  async createRetryPolicy(name: string, strategy: 'FIXED' | 'LINEAR' | 'EXPONENTIAL', baseDelayMs: number, maxDelayMs: number, maxRetries: number) {
    const policy = this.retryPolicyRepository.create({
      name,
      strategy,
      baseDelayMs,
      maxDelayMs,
      maxRetries,
    });
    return this.retryPolicyRepository.save(policy);
  }
}
