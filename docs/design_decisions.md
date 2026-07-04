# Design Decision Document - Distributed Job Scheduler Platform

This document describes the architectural decisions, database models, ER diagrams, and system designs applied in building the Distributed Job Scheduler Platform.

## 1. System Architecture Diagram

Below is the high-level architecture diagram detailing the relationships between Next.js control panel clients, NestJS API gateways, PostgreSQL, Redis, and the worker cluster.

```mermaid
graph TD
    Client[Next.js Web Dashboard] -- "HTTPS REST API" --> API[NestJS API Gateway]
    Client -- "WebSockets (Socket.IO)" --> WS[Socket.IO Gateway]
    API -- "Decoupled Event Emitter" --> WS
    
    API -- "Read/Write Queries" --> DB[(PostgreSQL Database)]
    API -- "Schedules & Pushes Jobs" --> Redis[(Redis Cache / BullMQ)]
    
    Worker1[Worker Node A] -- "Atomically Claims / Locks" --> DB
    Worker1 -- "Polls & Updates Queue States" --> Redis
    Worker1 -- "Pushes Execution Logs" --> DB
    
    Worker2[Worker Node B] -- "Atomically Claims / Locks" --> DB
    Worker2 -- "Polls & Updates Queue States" --> Redis
    Worker2 -- "Pushes Execution Logs" --> DB
```

---

## 2. Entity-Relationship (ER) Diagram

The PostgreSQL schema is highly normalized to model organizational contexts, projects, queues, retries, and comprehensive worker heartbeat history.

```mermaid
erDiagram
    USERS {
        uuid id PK
        string email
        string passwordHash
        timestamp createdAt
    }
    ORGANIZATIONS {
        uuid id PK
        string name
        uuid ownerId
        timestamp createdAt
    }
    ORGANIZATION_MEMBERS {
        uuid id PK
        uuid userId FK
        uuid organizationId FK
        string role
    }
    PROJECTS {
        uuid id PK
        uuid organizationId FK
        string name
        timestamp createdAt
    }
    QUEUES {
        uuid id PK
        uuid projectId FK
        string name
        int priority
        int concurrencyLimit
        uuid retryPolicyId FK
        string status
        int rateLimitWindowMs
        int rateLimitMaxJobs
        timestamp createdAt
    }
    RETRY_POLICIES {
        uuid id PK
        string name
        string strategy
        int baseDelayMs
        int maxDelayMs
        int maxRetries
    }
    JOBS {
        uuid id PK
        uuid queueId FK
        string type
        text payload
        int priority
        string status
        timestamp runAt
        string batchId
        string idempotencyKey
        int attempt
        int maxRetries
        string claimedBy
        timestamp createdAt
        timestamp claimedAt
        timestamp startedAt
        timestamp completedAt
        timestamp failedAt
      }
      JOB_EXECUTIONS {
          uuid id PK
          uuid jobId FK
          string workerId
          int attemptNumber
          string status
          timestamp startedAt
          timestamp finishedAt
          text error
          int durationMs
      }
      JOB_LOGS {
          uuid id PK
          uuid jobExecutionId FK
          string level
          text message
          timestamp timestamp
      }
      SCHEDULED_JOBS {
          uuid id PK
          uuid queueId FK
          string cronExpression
          text payloadTemplate
          timestamp lastRunAt
          timestamp nextRunAt
          boolean active
      }
      WORKERS {
          string id PK
          string hostname
          string status
          timestamp startedAt
          timestamp lastHeartbeatAt
      }
      WORKER_HEARTBEATS {
          uuid id PK
          string workerId FK
          int currentLoad
          timestamp lastSeenAt
      }
      METRICS {
          uuid id PK
          uuid queueId FK
          timestamp timestamp
          int throughputCompleted
          int throughputFailed
          int averageDurationMs
      }

      USERS ||--o{ ORGANIZATION_MEMBERS : memberships
      ORGANIZATIONS ||--o{ ORGANIZATION_MEMBERS : members
      ORGANIZATIONS ||--o{ PROJECTS : projects
      PROJECTS ||--o{ QUEUES : queues
      QUEUES }|--|| RETRY_POLICIES : retryPolicy
      QUEUES ||--o{ JOBS : jobs
      QUEUES ||--o{ SCHEDULED_JOBS : scheduledJobs
      JOBS ||--o{ JOB_EXECUTIONS : executions
      JOBS ||--o{ DEAD_LETTER_QUEUE_ENTRIES : dlqEntries
      JOB_EXECUTIONS ||--o{ JOB_LOGS : logs
      WORKERS ||--o{ WORKER_HEARTBEATS : heartbeats
      
      DEAD_LETTER_QUEUE_ENTRIES {
          uuid id PK
          uuid jobId FK
          text finalError
          text failureHistory
          timestamp movedAt
      }
```

---

## 3. Scalability and Reliability Decisions

### 3.1 double-Execution Avoidance (Atomic Claiming)
To prevent two distributed workers from picking up and executing the same background job concurrently under peak load conditions, we use a database-level row lock. When a worker polls for a job, it executes the query within a database transaction using **Pessimistic Write Locking** (`FOR UPDATE` statement):
```sql
SELECT * FROM jobs WHERE id = :jobId AND status IN ('QUEUED', 'RETRYING') FOR UPDATE;
```
If the row is returned, the worker atomically changes its status to `RUNNING` and sets `claimedBy = workerId`. This row-locking mechanism ensures strict mutual exclusion at the database layer.

### 3.2 Dead Worker Failover Detection
If a worker process crashes abruptly (e.g. out of memory, network interface card failure, hardware reboot), any jobs it had claimed would remain stuck in the `RUNNING` state indefinitely. 
To resolve this, workers periodically write to a `worker_heartbeats` table (every 5 seconds) and update their `lastHeartbeatAt` timestamp. The API gateway runs a periodic background task (cron job every 10 seconds) that scans for workers whose `lastHeartbeatAt` is older than 30 seconds.
When a dead worker is detected:
1. Its status is marked `INACTIVE`.
2. All jobs claimed by this worker that are in `RUNNING` state are fetched.
3. For each job, we check if it has remaining retries. If yes, the status is reverted to `QUEUED`, its attempt count is incremented, and it is pushed back to the BullMQ processing queue. If no retries remain, it is moved to the **Dead Letter Queue (DLQ)**.

### 3.3 Dynamic Queue Synchronization
Instead of hardcoding queues in worker configuration files, workers periodically query the database for active queues (`status = 'ACTIVE'`). For any new queue created via the dashboard, the worker dynamically instantiates a new BullMQ `Worker` instance with the designated `concurrencyLimit`. Similarly, if a queue is paused, the worker closes that BullMQ worker instance, stopping the ingestion pipeline instantly.
