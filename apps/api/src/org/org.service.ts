import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Organization, OrganizationMember, Project, User } from 'shared';

@Injectable()
export class OrgService {
  constructor(
    @InjectRepository(Organization)
    private readonly orgRepository: Repository<Organization>,
    @InjectRepository(OrganizationMember)
    private readonly memberRepository: Repository<OrganizationMember>,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    private readonly dataSource: DataSource
  ) {}

  async listUserOrgs(userId: string) {
    const memberships = await this.memberRepository.find({
      where: { userId },
      relations: ['organization'],
    });

    return memberships.map((m) => ({
      id: m.organization.id,
      name: m.organization.name,
      role: m.role,
      createdAt: m.organization.createdAt,
    }));
  }

  async createOrg(name: string, userId: string) {
    return this.dataSource.transaction(async (manager) => {
      const org = manager.create(Organization, {
        name,
        ownerId: userId,
      });
      const savedOrg = await manager.save(Organization, org);

      const member = manager.create(OrganizationMember, {
        userId,
        organizationId: savedOrg.id,
        role: 'OWNER',
      });
      const savedMember = await manager.save(OrganizationMember, member);

      return {
        id: savedOrg.id,
        name: savedOrg.name,
        role: savedMember.role,
        createdAt: savedOrg.createdAt,
      };
    });
  }

  async listOrgProjects(orgId: string) {
    return this.projectRepository.find({
      where: { organizationId: orgId },
    });
  }

  async createProject(orgId: string, name: string) {
    const project = this.projectRepository.create({
      name,
      organizationId: orgId,
    });
    return this.projectRepository.save(project);
  }
}
