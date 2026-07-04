import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { OrgService } from './org.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from './rbac.guard';
import { Roles } from './roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { User } from 'shared';

export class CreateOrgDto {
  @IsString()
  @IsNotEmpty()
  name!: string;
}

export class CreateProjectDto {
  @IsString()
  @IsNotEmpty()
  name!: string;
}

@ApiTags('Organizations')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller({ path: '', version: '1' })
export class OrgController {
  constructor(private readonly orgService: OrgService) {}

  @Get('organizations')
  @ApiOperation({ summary: 'List all organizations the user belongs to' })
  @ApiResponse({ status: 200, description: 'Success' })
  async listOrgs(@CurrentUser() user: User) {
    return this.orgService.listUserOrgs(user.id);
  }

  @Post('organizations')
  @ApiOperation({ summary: 'Create a new organization' })
  @ApiResponse({ status: 201, description: 'Organization created successfully' })
  async createOrg(@CurrentUser() user: User, @Body() dto: CreateOrgDto) {
    return this.orgService.createOrg(dto.name, user.id);
  }

  @Get('organizations/:orgId/projects')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN', 'MEMBER', 'VIEWER')
  @ApiOperation({ summary: 'List all projects in an organization' })
  @ApiParam({ name: 'orgId', type: 'string' })
  @ApiResponse({ status: 200, description: 'Success' })
  async listProjects(@Param('orgId') orgId: string) {
    return this.orgService.listOrgProjects(orgId);
  }

  @Post('organizations/:orgId/projects')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Create a new project in an organization' })
  @ApiParam({ name: 'orgId', type: 'string' })
  @ApiResponse({ status: 201, description: 'Project created successfully' })
  async createProject(@Param('orgId') orgId: string, @Body() dto: CreateProjectDto) {
    return this.orgService.createProject(orgId, dto.name);
  }
}
