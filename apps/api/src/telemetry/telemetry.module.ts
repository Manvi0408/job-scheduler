import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Metric, JobExecution, Queue, Job } from 'shared';
import { TelemetryService } from './telemetry.service';
import { TelemetryController } from './telemetry.controller';
import { TelemetryGateway } from './telemetry.gateway';
import { OrgModule } from '../org/org.module';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([Metric, JobExecution, Queue, Job]),
    OrgModule,
  ],
  controllers: [TelemetryController],
  providers: [TelemetryService, TelemetryGateway],
  exports: [TelemetryService, TelemetryGateway],
})
export class TelemetryModule {}
