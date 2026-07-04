import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { IsNotEmpty, IsEnum, IsObject, IsOptional, IsNumber, IsString, IsArray } from 'class-validator';
import { JobService } from './job.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../org/rbac.guard';
import { Roles } from '../org/roles.decorator';

export class SubmitJobDto {
  @IsEnum(['IMMEDIATE', 'DELAYED', 'SCHEDULED', 'RECURRING', 'BATCH'])
  type!: 'IMMEDIATE' | 'DELAYED' | 'SCHEDULED' | 'RECURRING' | 'BATCH';

  @IsObject()
  payload!: any;

  @IsNumber()
  @IsOptional()
  priority?: number;

  @IsString()
  @IsOptional()
  runAt?: string;

  @IsNumber()
  @IsOptional()
  delayMs?: number;

  @IsString()
  @IsOptional()
  cronExpression?: string;

  @IsString()
  @IsOptional()
  batchId?: string;

  @IsString()
  @IsOptional()
  idempotencyKey?: string;

  @IsNumber()
  @IsOptional()
  maxRetries?: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  parentJobIds?: string[];
}

export class SubmitBatchDto {
  @IsString()
  @IsNotEmpty()
  batchId!: string;

  @IsArray()
  @IsNotEmpty()
  jobs!: {
    payload: any;
    priority?: number;
    idempotencyKey?: string;
    maxRetries?: number;
  }[];
}

@ApiTags('Jobs')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller({ path: '', version: '1' })
export class JobController {
  constructor(private readonly jobService: JobService) {}

  @Post('queues/:queueId/jobs')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN', 'MEMBER')
  @ApiOperation({ summary: 'Submit a new job' })
  @ApiParam({ name: 'queueId', type: 'string' })
  @ApiResponse({ status: 201, description: 'Job submitted successfully' })
  async submitJob(@Param('queueId') queueId: string, @Body() dto: SubmitJobDto) {
    return this.jobService.submitJob(queueId, dto);
  }

  @Post('queues/:queueId/batches')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN', 'MEMBER')
  @ApiOperation({ summary: 'Submit a batch of jobs' })
  @ApiParam({ name: 'queueId', type: 'string' })
  @ApiResponse({ status: 201, description: 'Batch submitted successfully' })
  async submitBatch(@Param('queueId') queueId: string, @Body() dto: SubmitBatchDto) {
    return this.jobService.submitBatch(queueId, dto.batchId, dto.jobs);
  }

  @Get('queues/:queueId/jobs')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN', 'MEMBER', 'VIEWER')
  @ApiOperation({ summary: 'List jobs in a queue' })
  @ApiParam({ name: 'queueId', type: 'string' })
  @ApiQuery({ name: 'status', type: 'string', required: false })
  @ApiResponse({ status: 200, description: 'Success' })
  async listJobs(@Param('queueId') queueId: string, @Query('status') status?: string) {
    return this.jobService.listQueueJobs(queueId, status);
  }

  @Get('queues/:queueId/dlq')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN', 'MEMBER', 'VIEWER')
  @ApiOperation({ summary: 'List Dead Letter Queue entries' })
  @ApiParam({ name: 'queueId', type: 'string' })
  @ApiResponse({ status: 200, description: 'Success' })
  async listDlq(@Param('queueId') queueId: string) {
    return this.jobService.listDlq(queueId);
  }

  @Get('jobs/:jobId')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN', 'MEMBER', 'VIEWER')
  @ApiOperation({ summary: 'Get details of a job' })
  @ApiParam({ name: 'jobId', type: 'string' })
  @ApiResponse({ status: 200, description: 'Success' })
  async getJob(@Param('jobId') jobId: string) {
    return this.jobService.getJobDetails(jobId);
  }

  @Get('jobs/:jobId/logs')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN', 'MEMBER', 'VIEWER')
  @ApiOperation({ summary: 'Get execution logs of a job' })
  @ApiParam({ name: 'jobId', type: 'string' })
  @ApiResponse({ status: 200, description: 'Success' })
  async getLogs(@Param('jobId') jobId: string) {
    return this.jobService.getJobLogs(jobId);
  }

  @Post('jobs/:jobId/requeue')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN', 'MEMBER')
  @ApiOperation({ summary: 'Requeue a permanently failed job from the Dead Letter Queue' })
  @ApiParam({ name: 'jobId', type: 'string' })
  @ApiResponse({ status: 200, description: 'Job successfully requeued' })
  async requeueJob(@Param('jobId') jobId: string) {
    return this.jobService.requeueJob(jobId);
  }
}
