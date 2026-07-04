import { Controller, Get, Delete, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { ProjectService } from './project.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../org/rbac.guard';
import { Roles } from '../org/roles.decorator';

@ApiTags('Projects')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Controller({ path: 'projects', version: '1' })
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  @Get(':projectId')
  @Roles('OWNER', 'ADMIN', 'MEMBER', 'VIEWER')
  @ApiOperation({ summary: 'Get details and queues of a project' })
  @ApiParam({ name: 'projectId', type: 'string' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async getProject(@Param('projectId') projectId: string) {
    return this.projectService.getProjectDetails(projectId);
  }

  @Delete(':projectId')
  @Roles('OWNER')
  @ApiOperation({ summary: 'Delete a project' })
  @ApiParam({ name: 'projectId', type: 'string' })
  @ApiResponse({ status: 200, description: 'Project successfully deleted' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async deleteProject(@Param('projectId') projectId: string) {
    return this.projectService.deleteProject(projectId);
  }
}
