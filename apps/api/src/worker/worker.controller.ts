import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsNumber } from 'class-validator';
import { WorkerService } from './worker.service';
import { AuthGuard } from '../auth/auth.guard';

export class RegisterWorkerDto {
  @IsString()
  @IsNotEmpty()
  id!: string;

  @IsString()
  @IsNotEmpty()
  hostname!: string;
}

export class HeartbeatDto {
  @IsNumber()
  currentLoad!: number;
}

@ApiTags('Workers')
@Controller({ path: 'workers', version: '1' })
export class WorkerController {
  constructor(private readonly workerService: WorkerService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new worker node' })
  @ApiResponse({ status: 201, description: 'Worker registered successfully' })
  async register(@Body() dto: RegisterWorkerDto) {
    return this.workerService.registerWorker(dto.id, dto.hostname);
  }

  @Post(':id/heartbeat')
  @ApiOperation({ summary: 'Submit worker heartbeat' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiResponse({ status: 200, description: 'Heartbeat registered' })
  async heartbeat(@Param('id') id: string, @Body() dto: HeartbeatDto) {
    await this.workerService.heartbeat(id, dto.currentLoad);
    return { success: true };
  }

  @Get()
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'List all registered workers' })
  @ApiResponse({ status: 200, description: 'Success' })
  async list() {
    return this.workerService.listWorkers();
  }
}
