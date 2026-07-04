import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Project } from 'shared';
import { ProjectService } from './project.service';
import { ProjectController } from './project.controller';
import { OrgModule } from '../org/org.module';

@Module({
  imports: [TypeOrmModule.forFeature([Project]), OrgModule],
  controllers: [ProjectController],
  providers: [ProjectService],
  exports: [ProjectService],
})
export class ProjectModule {}
