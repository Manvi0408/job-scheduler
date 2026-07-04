import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { TelemetryService } from './telemetry.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../org/rbac.guard';
import { Roles } from '../org/roles.decorator';

@ApiTags('Telemetry')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Controller({ path: '', version: '1' })
export class TelemetryController {
  constructor(private readonly telemetryService: TelemetryService) {}

  @Get('projects/:projectId/metrics')
  @Roles('OWNER', 'ADMIN', 'MEMBER', 'VIEWER')
  @ApiOperation({ summary: 'Get aggregate dashboard metrics for a project' })
  @ApiParam({ name: 'projectId', type: 'string' })
  @ApiResponse({ status: 200, description: 'Success' })
  async getProjectMetrics(@Param('projectId') projectId: string) {
    return this.telemetryService.getProjectMetrics(projectId);
  }

  @Get('queues/:queueId/metrics')
  @Roles('OWNER', 'ADMIN', 'MEMBER', 'VIEWER')
  @ApiOperation({ summary: 'Get chart timeline metrics for a specific queue' })
  @ApiParam({ name: 'queueId', type: 'string' })
  @ApiResponse({ status: 200, description: 'Success' })
  async getQueueMetrics(@Param('queueId') queueId: string) {
    return this.telemetryService.getQueueChartMetrics(queueId);
  }
}
