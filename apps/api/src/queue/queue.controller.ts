import { Controller, Get, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsNumber, IsOptional, IsEnum, Min } from 'class-validator';
import { QueueService } from './queue.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../org/rbac.guard';
import { Roles } from '../org/roles.decorator';

export class CreateQueueDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsNumber()
  @IsOptional()
  priority?: number;

  @IsNumber()
  @IsOptional()
  concurrencyLimit?: number;

  @IsString()
  @IsNotEmpty()
  retryPolicyId!: string;

  @IsNumber()
  @IsOptional()
  rateLimitWindowMs?: number;

  @IsNumber()
  @IsOptional()
  rateLimitMaxJobs?: number;
}

export class UpdateQueueDto {
  @IsNumber()
  @IsOptional()
  priority?: number;

  @IsNumber()
  @IsOptional()
  concurrencyLimit?: number;

  @IsString()
  @IsOptional()
  retryPolicyId?: string;

  @IsEnum(['ACTIVE', 'PAUSED'])
  @IsOptional()
  status?: 'ACTIVE' | 'PAUSED';

  @IsNumber()
  @IsOptional()
  rateLimitWindowMs?: number;

  @IsNumber()
  @IsOptional()
  rateLimitMaxJobs?: number;
}

export class CreateRetryPolicyDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEnum(['FIXED', 'LINEAR', 'EXPONENTIAL'])
  strategy!: 'FIXED' | 'LINEAR' | 'EXPONENTIAL';

  @IsNumber()
  @Min(0)
  baseDelayMs!: number;

  @IsNumber()
  @Min(0)
  maxDelayMs!: number;

  @IsNumber()
  @Min(0)
  maxRetries!: number;
}

@ApiTags('Queues')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller({ path: '', version: '1' })
export class QueueController {
  constructor(private readonly queueService: QueueService) {}

  @Get('retry-policies')
  @ApiOperation({ summary: 'List all retry policies' })
  @ApiResponse({ status: 200, description: 'Success' })
  async getRetryPolicies() {
    return this.queueService.getRetryPolicies();
  }

  @Post('retry-policies')
  @ApiOperation({ summary: 'Create a new retry policy' })
  @ApiResponse({ status: 201, description: 'Retry policy created' })
  async createRetryPolicy(@Body() dto: CreateRetryPolicyDto) {
    return this.queueService.createRetryPolicy(
      dto.name,
      dto.strategy,
      dto.baseDelayMs,
      dto.maxDelayMs,
      dto.maxRetries
    );
  }

  @Post('projects/:projectId/queues')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Create a new queue in a project' })
  @ApiParam({ name: 'projectId', type: 'string' })
  @ApiResponse({ status: 201, description: 'Queue created' })
  async createQueue(@Param('projectId') projectId: string, @Body() dto: CreateQueueDto) {
    return this.queueService.createQueue(
      projectId,
      dto.name,
      dto.priority ?? 0,
      dto.concurrencyLimit ?? 5,
      dto.retryPolicyId,
      dto.rateLimitWindowMs,
      dto.rateLimitMaxJobs
    );
  }

  @Get('projects/:projectId/queues')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN', 'MEMBER', 'VIEWER')
  @ApiOperation({ summary: 'List all queues of a project' })
  @ApiParam({ name: 'projectId', type: 'string' })
  @ApiResponse({ status: 200, description: 'Success' })
  async listQueues(@Param('projectId') projectId: string) {
    return this.queueService.listProjectQueues(projectId);
  }

  @Get('queues/:queueId')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN', 'MEMBER', 'VIEWER')
  @ApiOperation({ summary: 'Get details of a queue' })
  @ApiParam({ name: 'queueId', type: 'string' })
  @ApiResponse({ status: 200, description: 'Success' })
  async getQueue(@Param('queueId') queueId: string) {
    return this.queueService.getQueueDetails(queueId);
  }

  @Get('queues/:queueId/health')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN', 'MEMBER', 'VIEWER')
  @ApiOperation({ summary: 'Get health metrics and job counts of a queue' })
  @ApiParam({ name: 'queueId', type: 'string' })
  @ApiResponse({ status: 200, description: 'Success' })
  async getQueueHealth(@Param('queueId') queueId: string) {
    return this.queueService.getQueueHealth(queueId);
  }

  @Patch('queues/:queueId')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Update configuration of a queue' })
  @ApiParam({ name: 'queueId', type: 'string' })
  @ApiResponse({ status: 200, description: 'Queue updated successfully' })
  async updateQueue(@Param('queueId') queueId: string, @Body() dto: UpdateQueueDto) {
    return this.queueService.updateQueue(queueId, dto);
  }
}
