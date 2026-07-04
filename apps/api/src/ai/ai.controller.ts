import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { AiService } from './ai.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../org/rbac.guard';
import { Roles } from '../org/roles.decorator';

@ApiTags('AI Diagnostics')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Controller({ path: 'jobs', version: '1' })
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Get(':jobId/ai-summary')
  @Roles('OWNER', 'ADMIN', 'MEMBER', 'VIEWER')
  @ApiOperation({ summary: 'Generate an AI failure diagnostic report from execution logs' })
  @ApiParam({ name: 'jobId', type: 'string' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 404, description: 'Job not found' })
  async getSummary(@Param('jobId') jobId: string) {
    return this.aiService.generateFailureSummary(jobId);
  }
}
