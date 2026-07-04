import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Organization, OrganizationMember, Project } from 'shared';
import { OrgService } from './org.service';
import { OrgController } from './org.controller';
import { RolesGuard } from './rbac.guard';

@Module({
  imports: [TypeOrmModule.forFeature([Organization, OrganizationMember, Project])],
  controllers: [OrgController],
  providers: [OrgService, RolesGuard],
  exports: [OrgService, RolesGuard],
})
export class OrgModule {}
