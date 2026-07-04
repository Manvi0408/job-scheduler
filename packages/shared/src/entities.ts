import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
  PrimaryColumn,
} from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  @Index('idx_user_email')
  email!: string;

  @Column()
  passwordHash!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @OneToMany(() => OrganizationMember, (member) => member.user)
  memberships!: OrganizationMember[];
}

@Entity('organizations')
export class Organization {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column()
  ownerId!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @OneToMany(() => OrganizationMember, (member) => member.organization)
  members!: OrganizationMember[];

  @OneToMany(() => Project, (project) => project.organization)
  projects!: Project[];
}

@Entity('organization_members')
@Index('idx_user_org_unique', ['userId', 'organizationId'], { unique: true })
export class OrganizationMember {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  userId!: string;

  @Column()
  organizationId!: string;

  @Column({ type: 'varchar', length: 50, default: 'MEMBER' })
  role!: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';

  @ManyToOne(() => User, (user) => user.memberships, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @ManyToOne(() => Organization, (org) => org.members, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizationId' })
  organization!: Organization;
}

@Entity('projects')
export class Project {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  organizationId!: string;

  @Column()
  name!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @ManyToOne(() => Organization, (org) => org.projects, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizationId' })
  organization!: Organization;

  @OneToMany(() => Queue, (queue) => queue.project)
  queues!: Queue[];
}

@Entity('retry_policies')
export class RetryPolicy {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  name!: string;

  @Column({ type: 'varchar', length: 50, default: 'FIXED' })
  strategy!: 'FIXED' | 'LINEAR' | 'EXPONENTIAL';

  @Column({ default: 1000 })
  baseDelayMs!: number;

  @Column({ default: 60000 })
  maxDelayMs!: number;

  @Column({ default: 3 })
  maxRetries!: number;

  @OneToMany(() => Queue, (queue) => queue.retryPolicy)
  queues!: Queue[];
}

@Entity('queues')
@Index('idx_project_queue_name', ['projectId', 'name'], { unique: true })
export class Queue {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  projectId!: string;

  @Column()
  name!: string;

  @Column({ default: 0 })
  priority!: number;

  @Column({ default: 5 })
  concurrencyLimit!: number;

  @Column()
  retryPolicyId!: string;

  @Column({ type: 'varchar', length: 50, default: 'ACTIVE' })
  status!: 'ACTIVE' | 'PAUSED';

  @Column({ nullable: true })
  rateLimitWindowMs!: number;

  @Column({ nullable: true })
  rateLimitMaxJobs!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @ManyToOne(() => Project, (project) => project.queues, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'projectId' })
  project!: Project;

  @ManyToOne(() => RetryPolicy, (policy) => policy.queues, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'retryPolicyId' })
  retryPolicy!: RetryPolicy;

  @OneToMany(() => Job, (job) => job.queue)
  jobs!: Job[];

  @OneToMany(() => ScheduledJob, (sj) => sj.queue)
  scheduledJobs!: ScheduledJob[];
}

@Entity('jobs')
@Index('idx_job_status_runat_priority', ['status', 'runAt', 'priority'])
@Index('idx_job_queue_status', ['queueId', 'status'])
export class Job {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  queueId!: string;

  @Column({ type: 'varchar', length: 50 })
  type!: 'IMMEDIATE' | 'DELAYED' | 'SCHEDULED' | 'RECURRING' | 'BATCH';

  @Column({ type: 'text' })
  payload!: string; // JSON payload

  @Column({ default: 0 })
  priority!: number;

  @Column({ type: 'varchar', length: 50, default: 'QUEUED' })
  status!: 'QUEUED' | 'SCHEDULED' | 'CLAIMED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'RETRYING' | 'DLQ';

  @Column()
  runAt!: Date;

  @Column({ nullable: true })
  @Index('idx_job_batch_id')
  batchId!: string;

  @Column({ nullable: true, unique: true })
  idempotencyKey!: string;

  @Column({ default: 0 })
  attempt!: number;

  @Column({ default: 3 })
  maxRetries!: number;

  @Column({ nullable: true })
  claimedBy!: string; // worker ID

  @CreateDateColumn()
  createdAt!: Date;

  @Column({ nullable: true })
  claimedAt!: Date;

  @Column({ nullable: true })
  startedAt!: Date;

  @Column({ nullable: true })
  completedAt!: Date;

  @Column({ nullable: true })
  failedAt!: Date;

  @ManyToOne(() => Queue, (queue) => queue.jobs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'queueId' })
  queue!: Queue;

  @OneToMany(() => JobExecution, (exec) => exec.job)
  executions!: JobExecution[];

  @OneToMany(() => DeadLetterQueueEntry, (dlq) => dlq.job)
  dlqEntries!: DeadLetterQueueEntry[];
}

@Entity('job_executions')
@Index('idx_execution_job_id', ['jobId'])
export class JobExecution {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  jobId!: string;

  @Column()
  workerId!: string;

  @Column()
  attemptNumber!: number;

  @Column()
  status!: string; // COMPLETED, FAILED

  @CreateDateColumn()
  startedAt!: Date;

  @Column({ nullable: true })
  finishedAt!: Date;

  @Column({ type: 'text', nullable: true })
  error!: string;

  @Column({ nullable: true })
  durationMs!: number;

  @ManyToOne(() => Job, (job) => job.executions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'jobId' })
  job!: Job;

  @OneToMany(() => JobLog, (log) => log.execution)
  logs!: JobLog[];
}

@Entity('job_logs')
export class JobLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  jobExecutionId!: string;

  @Column()
  level!: string; // INFO, WARN, ERROR

  @Column({ type: 'text' })
  message!: string;

  @CreateDateColumn()
  timestamp!: Date;

  @ManyToOne(() => JobExecution, (exec) => exec.logs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'jobExecutionId' })
  execution!: JobExecution;
}

@Entity('scheduled_jobs')
export class ScheduledJob {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  queueId!: string;

  @Column()
  cronExpression!: string;

  @Column({ type: 'text' })
  payloadTemplate!: string;

  @Column({ nullable: true })
  lastRunAt!: Date;

  @Column()
  nextRunAt!: Date;

  @Column({ default: true })
  active!: boolean;

  @ManyToOne(() => Queue, (queue) => queue.scheduledJobs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'queueId' })
  queue!: Queue;
}

@Entity('dead_letter_queue_entries')
export class DeadLetterQueueEntry {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  jobId!: string;

  @Column({ type: 'text' })
  finalError!: string;

  @Column({ type: 'text' })
  failureHistory!: string; // JSON list of attempts

  @CreateDateColumn()
  movedAt!: Date;

  @ManyToOne(() => Job, (job) => job.dlqEntries, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'jobId' })
  job!: Job;
}

@Entity('workers')
export class Worker {
  @PrimaryColumn()
  id!: string; // Worker name/uuid

  @Column()
  hostname!: string;

  @Column({ default: 'ACTIVE' })
  status!: string; // ACTIVE, INACTIVE

  @CreateDateColumn()
  startedAt!: Date;

  @UpdateDateColumn()
  lastHeartbeatAt!: Date;

  @OneToMany(() => WorkerHeartbeat, (hb) => hb.worker)
  heartbeats!: WorkerHeartbeat[];
}

@Entity('worker_heartbeats')
@Index('idx_worker_hb_lastseen', ['workerId', 'lastSeenAt'])
export class WorkerHeartbeat {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  workerId!: string;

  @Column({ default: 0 })
  currentLoad!: number;

  @CreateDateColumn()
  lastSeenAt!: Date;

  @ManyToOne(() => Worker, (w) => w.heartbeats, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workerId' })
  worker!: Worker;
}

@Entity('metrics')
@Index('idx_metrics_queue_timestamp', ['queueId', 'timestamp'])
export class Metric {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  queueId!: string;

  @Column()
  timestamp!: Date;

  @Column({ default: 0 })
  throughputCompleted!: number;

  @Column({ default: 0 })
  throughputFailed!: number;

  @Column({ default: 0 })
  averageDurationMs!: number;
}
