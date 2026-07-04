import { z } from 'zod';

export const SignupSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters long"),
});

export const LoginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string(),
});

export const CreateOrgSchema = z.object({
  name: z.string().min(1, "Organization name is required"),
});

export const CreateProjectSchema = z.object({
  name: z.string().min(1, "Project name is required"),
});

export const CreateQueueSchema = z.object({
  name: z.string().min(1, "Queue name is required").regex(/^[a-zA-Z0-9-_]+$/, "Only alphanumeric characters, dashes, and underscores allowed"),
  priority: z.number().int().nonnegative().optional().default(0),
  concurrencyLimit: z.number().int().positive().optional().default(5),
  retryPolicyId: z.string().min(1, "Retry policy ID is required"),
});

export const UpdateQueueSchema = z.object({
  priority: z.number().int().nonnegative().optional(),
  concurrencyLimit: z.number().int().positive().optional(),
  retryPolicyId: z.string().min(1).optional(),
  status: z.enum(['ACTIVE', 'PAUSED']).optional(),
});

export const CreateRetryPolicySchema = z.object({
  name: z.string().min(1, "Retry policy name is required"),
  strategy: z.enum(['FIXED', 'LINEAR', 'EXPONENTIAL']),
  baseDelayMs: z.number().int().nonnegative().optional().default(1000),
  maxDelayMs: z.number().int().nonnegative().optional().default(60000),
  maxRetries: z.number().int().nonnegative().optional().default(3),
});

export const SubmitJobSchema = z.object({
  type: z.enum(['IMMEDIATE', 'DELAYED', 'SCHEDULED', 'RECURRING', 'BATCH']),
  payload: z.record(z.any()), // JSON payload
  priority: z.number().int().optional(), // optional override
  runAt: z.string().datetime().optional(), // ISO datetime string for scheduled
  delayMs: z.number().int().nonnegative().optional(), // delay in ms for delayed
  cronExpression: z.string().optional(), // cron tab format for recurring
  batchId: z.string().optional(), // batch group ID
  idempotencyKey: z.string().optional(),
  maxRetries: z.number().int().nonnegative().optional(),
});

export const SubmitBatchJobSchema = z.object({
  batchId: z.string().min(1, "Batch ID is required"),
  jobs: z.array(z.object({
    payload: z.record(z.any()),
    priority: z.number().int().optional(),
    idempotencyKey: z.string().optional(),
    maxRetries: z.number().int().nonnegative().optional(),
  })).min(1, "Batch must contain at least 1 job"),
});
