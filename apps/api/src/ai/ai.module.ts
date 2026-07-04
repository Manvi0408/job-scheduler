import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Job, JobExecution } from 'shared';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { OrgModule } from '../org/org.module';

@Module({
  imports: [TypeOrmModule.forFeature([Job, JobExecution]), OrgModule],
  controllers: [AiController],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
