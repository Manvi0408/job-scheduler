import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { OrganizationMember, Project, Queue, Job } from 'shared';

type Role = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';

/**
 * Enforces multi-tenant access control.
 *
 * For every guarded route it (1) resolves which organization the target resource
 * belongs to (from the route params, walking job -> queue -> project -> org as
 * needed), (2) verifies the authenticated user is actually a member of that
 * organization (tenant isolation), and (3) checks the member's real role against
 * the roles required by the @Roles() decorator.
 *
 * Must run AFTER AuthGuard, which populates request.user.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly dataSource: DataSource
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles =
      this.reflector.getAllAndOverride<Role[]>('roles', [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user?.id) {
      throw new UnauthorizedException('Authentication required');
    }

    const organizationId = await this.resolveOrganizationId(request.params ?? {});
    if (!organizationId) {
      throw new ForbiddenException(
        'Could not resolve the organization for this resource'
      );
    }

    const membership = await this.dataSource
      .getRepository(OrganizationMember)
      .findOne({ where: { userId: user.id, organizationId } });

    if (!membership) {
      // Tenant isolation: not a member of the owning organization.
      throw new ForbiddenException('You do not have access to this organization');
    }

    if (requiredRoles.length > 0 && !requiredRoles.includes(membership.role)) {
      throw new ForbiddenException(
        `This action requires one of the following roles: ${requiredRoles.join(', ')}`
      );
    }

    // Expose the verified context to downstream handlers.
    request.organizationId = organizationId;
    request.userRole = membership.role;
    return true;
  }

  /** Walk the resource hierarchy to find the owning organization id. */
  private async resolveOrganizationId(params: Record<string, string>): Promise<string | null> {
    if (params.orgId) {
      return params.orgId;
    }
    if (params.projectId) {
      return this.orgFromProject(params.projectId);
    }
    if (params.queueId) {
      const queue = await this.dataSource
        .getRepository(Queue)
        .findOne({ where: { id: params.queueId } });
      return queue ? this.orgFromProject(queue.projectId) : null;
    }
    if (params.jobId) {
      const job = await this.dataSource
        .getRepository(Job)
        .findOne({ where: { id: params.jobId } });
      if (!job) return null;
      const queue = await this.dataSource
        .getRepository(Queue)
        .findOne({ where: { id: job.queueId } });
      return queue ? this.orgFromProject(queue.projectId) : null;
    }
    return null;
  }

  private async orgFromProject(projectId: string): Promise<string | null> {
    const project = await this.dataSource
      .getRepository(Project)
      .findOne({ where: { id: projectId } });
    return project?.organizationId ?? null;
  }
}
