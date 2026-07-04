import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { OnEvent } from '@nestjs/event-emitter';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: 'telemetry',
})
export class TelemetryGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(TelemetryGateway.name);

  @WebSocketServer()
  server!: Server;

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  // Subscribe to custom client events if needed
  @SubscribeMessage('ping')
  handlePing(client: Socket) {
    client.emit('pong');
  }

  // Listen to application events and broadcast them to Socket.IO clients
  @OnEvent('job.status')
  handleJobStatusEvent(data: { jobId: string; queueId: string; status: string; attempt: number }) {
    this.logger.debug(`Broadcasting job status changed: ${data.jobId} -> ${data.status}`);
    this.server.emit('job_status_changed', data);
  }

  @OnEvent('worker.heartbeat')
  handleWorkerHeartbeatEvent(data: { workerId: string; currentLoad: number; lastSeenAt: Date }) {
    this.logger.debug(`Broadcasting worker heartbeat: ${data.workerId}`);
    this.server.emit('worker_heartbeat', data);
  }

  @OnEvent('queue.metrics')
  handleQueueMetricsEvent(data: { queueId: string; throughputCompleted: number; throughputFailed: number }) {
    this.logger.debug(`Broadcasting queue metrics: ${data.queueId}`);
    this.server.emit('queue_metrics', data);
  }
}
