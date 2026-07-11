# Distributed Job Scheduler Platform

A production-grade, distributed background job processing platform inspired by BullMQ, Sidekiq, Celery, and AWS SQS, built with Node.js, TypeScript, NestJS, TypeORM, PostgreSQL/MySQL, Redis, Socket.IO, Next.js 15, Tailwind CSS, and Docker.

## 📸 Screenshots

<table>
  <tr>
    <td align="center">
      <img src="login.png" width="450"/>
      <br/>
      <sub><b>Authentication & Cluster Setup</b></sub>
    </td>
    <td align="center">
      <img src="dashboard.png" width="450"/>
      <br/>
      <sub><b>Real-Time Dashboard Overview</b></sub>
    </td>
  </tr>

  <tr>
    <td align="center">
      <img src="queue.png" width="450"/>
      <br/>
      <sub><b>Queue Management</b></sub>
    </td>
    <td align="center">
      <img src="job explorer.png" width="450"/>
      <br/>
      <sub><b>Job Explorer & Task Tracking</b></sub>
    </td>
  </tr>

  <tr>
    <td align="center">
      <img src="workers.png" width="450"/>
      <br/>
      <sub><b>Worker Monitoring</b></sub>
    </td>
    <td align="center">
      <img src="analytics.png" width="450"/>
      <br/>
      <sub><b>Analytics Dashboard</b></sub>
    </td>
  </tr>
</table>
---

---

## Entity-Relationship (ER) Database Schema

The following entity-relationship diagram maps out the normalized schema of the Distributed Job Scheduler:

```mermaid
erDiagram
    ORGANIZATION {
        string id PK
        string name
        datetime createdAt
        datetime updatedAt
    }

    PROJECT {
        string id PK
        string orgId FK
        string name
        datetime createdAt
        datetime updatedAt
    }

    RETRY_POLICY {
        string id PK
        string name
        string strategy "FIXED | LINEAR | EXPONENTIAL"
        int maxRetries
        int baseDelayMs
        int maxDelayMs
        datetime createdAt
    }

    QUEUE {
        string id PK
        string projectId FK
        string name
        int priority
        int concurrencyLimit
        string retryPolicyId FK
        string status "ACTIVE | PAUSED"
        int rateLimitWindowMs
        int rateLimitMaxJobs
        datetime createdAt
    }

    JOB {
        string id PK
        string queueId FK
        string status "QUEUED | RUNNING | COMPLETED | FAILED | DLQ | RETRYING | SCHEDULED"
        int priority
        string type "IMMEDIATE | DELAYED | SCHEDULED | RECURRING | BATCH"
        text payload "JSON payload parameters"
        int attempt
        int maxRetries
        datetime runAt
        string claimedBy
        datetime claimedAt
        datetime startedAt
        datetime completedAt
        datetime failedAt
        string idempotencyKey
        string batchId
        datetime createdAt
        datetime updatedAt
    }

    JOB_EXECUTION {
        string id PK
        string jobId FK
        string workerId FK
        int attemptNumber
        string status "RUNNING | COMPLETED | FAILED"
        datetime startedAt
        datetime finishedAt
        int durationMs
        text error
    }

    JOB_LOG {
        string id PK
        string jobExecutionId FK
        string level "INFO | WARN | ERROR"
        text message
        datetime timestamp
    }

    DEAD_LETTER_QUEUE_ENTRY {
        string id PK
        string jobId FK
        text finalError
        text failureHistory "JSON array of attempt stats"
        datetime movedAt
    }

    WORKER {
        string id PK
        string hostname
        string status "ACTIVE | DEAD | SHUTDOWN"
        datetime registeredAt
        datetime lastHeartbeatAt
    }

    WORKER_HEARTBEAT {
        string id PK
        string workerId FK
        int currentLoad
        datetime lastSeenAt
    }

    ORGANIZATION ||--o{ PROJECT : contains
    PROJECT ||--o{ QUEUE : owns
    RETRY_POLICY ||--o{ QUEUE : governs
    QUEUE ||--o{ JOB : processes
    JOB ||--o{ JOB_EXECUTION : runs
    JOB_EXECUTION ||--o{ JOB_LOG : traces
    JOB ||--o{ DEAD_LETTER_QUEUE_ENTRY : redirects
    WORKER ||--o{ WORKER_HEARTBEAT : reports
```
## Database Architecture
```mermaid
erDiagram

    ORGANIZATION ||--o{ PROJECT : contains
    PROJECT ||--o{ QUEUE : owns
    RETRY_POLICY ||--o{ QUEUE : governs

    QUEUE ||--o{ JOB : processes

    JOB ||--o{ JOB_EXECUTION : runs
    WORKER ||--o{ JOB_EXECUTION : executes

    JOB_EXECUTION ||--o{ JOB_LOG : generates

    JOB ||--o| DEAD_LETTER_QUEUE_ENTRY : moved_to

    WORKER ||--o{ WORKER_HEARTBEAT : reports

    
```

# 🎯 Core Features

## 🚀 Distributed Job Processing

- Immediate Jobs
- Delayed Jobs
- Scheduled Jobs
- Recurring Cron Jobs
- Batch Jobs
- Queue Priorities
- Idempotency Keys
- Workflow Dependency DAGs

---

## 🛡 Reliability & Fault Tolerance

- Atomic Job Claiming
- Fixed Retry Strategy
- Linear Retry Strategy
- Exponential Retry Strategy
- Dead Letter Queue (DLQ)
- Full Execution History
- Failure Tracking
- Graceful Shutdown
- Crash Recovery

---

## ⚙️ Distributed Worker Infrastructure

- Multiple Concurrent Workers
- Worker Heartbeats
- Load Monitoring
- Worker Registration
- Independent Worker Scaling
- Queue Concurrency Limits
- Scheduler Isolation

---

## 📦 Queue Management

- Queue Creation
- Pause / Resume Queues
- Rate Limiting
- Retry Policies
- Throughput Monitoring
- Queue Analytics
- Health Monitoring

---

## 📡 Real-Time Monitoring

- Socket.IO Live Events
- Job Status Updates
- Worker Activity Feed
- Throughput Analytics
- System Health Monitoring
- Execution Timeline Tracking

---

## 🔍 Observability

- Structured Job Logs
- Execution Logs
- Retry History
- Failure Diagnostics
- Worker Telemetry
- Searchable Log Explorer
- AI Failure Summaries

---

## 🔐 Security

- JWT Authentication
- Password Hashing
- Multi-Tenant Organizations
- RBAC Authorization

### Supported Roles

- OWNER
- ADMIN
- MEMBER
- VIEWER

---

## 🛠 Developer Experience

- Turborepo Monorepo
- Shared TypeScript Types
- Shared Zod Validation
- OpenAPI / Swagger Documentation
- Docker Compose Support
- Hot Reload Development
- PostgreSQL Support
- MySQL Support
- Redis Fallback Mechanism
---

# 🏗 System Architecture

```text
┌────────────────────────────────────────────┐
│              Next.js Dashboard             │
│  Queues │ Jobs │ Workers │ DLQ │ Metrics   │
└───────────────────┬────────────────────────┘
                    │
          REST + Socket.IO
                    │
                    ▼
┌────────────────────────────────────────────┐
│                NestJS API                  │
│                                            │
│ Authentication                             │
│ Organizations                              │
│ Projects                                   │
│ Queues                                     │
│ Jobs                                       │
│ Scheduler                                  │
│ Metrics                                    │
└───────────────────┬────────────────────────┘
                    │
                    ▼
┌────────────────────────────────────────────┐
│          MySQL / PostgreSQL                │
│                                            │
│ Organizations                              │
│ Projects                                   │
│ Queues                                     │
│ Jobs                                       │
│ Executions                                 │
│ Logs                                       │
│ DLQ                                        │
│ Workers                                    │
└──────────────┬─────────────────────────────┘
               │
               ▼
┌────────────────────────────────────────────┐
│               Worker Pool                  │
│                                            │
│ Polling Engine                             │
│ Retry Engine                               │
│ Scheduler Loop                             │
│ Heartbeats                                 │
│ Concurrent Executors                       │
└──────────────┬─────────────────────────────┘
               │
               ▼
┌────────────────────────────────────────────┐
│                  Redis                     │
│            Pub/Sub Signalling              │
└────────────────────────────────────────────┘

Fallback:
Workers automatically switch to direct
database polling if Redis becomes unavailable.
---

## 📁 Project Directory Structure

The platform is designed as a **pnpm monorepo workspace** separating concerns between frontend, REST API, background worker, and shared libraries:

```text
distributed-job-scheduler/
├── apps/
│   ├── api/                   # NestJS REST API & WebSockets Telemetry Gateway
│   │   ├── src/
│   │   │   ├── auth/          # Auth controllers, guards & JWT service
│   │   │   ├── org/           # Organization/RBAC logic
│   │   │   ├── queue/         # Queue definitions & retry policy seeding
│   │   │   ├── job/           # Job submission & detail endpoints
│   │   │   └── telemetry/     # Socket.IO Gateway for real-time dashboard events
│   │   └── Dockerfile
│   ├── web/                   # Next.js 16 Web Dashboard Panel (Tailwind CSS)
│   │   ├── src/app/
│   │   │   ├── page.tsx       # Root entry check & redirection
│   │   │   ├── login/         # Styled Login with quick admin autofill
│   │   │   ├── signup/        # Styled signup view
│   │   │   └── dashboard/     # Dynamic monitoring, charts, and metrics dashboard
│   │   └── Dockerfile
│   └── worker/                # NestJS Background Worker Process
│       ├── src/
│       │   └── worker.service.ts # Core polling engine, dependency DAG resolver & retry handler
│       └── Dockerfile
├── packages/
│   └── shared/                # Shared monorepo library (TypeScript workspace)
│       ├── src/
│       │   ├── entities/      # TypeORM Entity schemas (User, Org, Queue, Job, Log, etc.)
│       │   └── index.ts       # Main workspace entry exports
│       └── tsconfig.json
├── docs/                      # Technical guides and tutorials
│   └── deployment_guide.md    # Cloud production deployment reference
├── docker-compose.yml         # Dev staging orchestrator (MySQL, Redis, API, Worker, Web)
├── package.json               # Monorepo packages & workspace task pipelines
├── pnpm-workspace.yaml        # Workspace catalog layout
└── tsconfig.json              # Shared root TypeScript compiler config
```

---

## Quickstart (Local Dev Server)

To start the platform instantly outside Docker (using your active local MySQL on port 3306 and fallback mock Redis):

1. **Verify Database connection** inside the root `.env` file:
   ```env
   DATABASE_URL="mysql://root:SchedulerSecure123!@127.0.0.1:3306/distributed_job_scheduler"
   JWT_SECRET="JWT_Super_Secret_Key_For_Job_Scheduler_2026_!"
   PORT=3000
   ```
2. Make sure the database **`distributed_job_scheduler`** exists in your local MySQL instance.
3. Install and compile shared packages:
   ```bash
   pnpm install
   pnpm --filter shared build
   ```
4. Start all applications in dev watch mode:
   ```bash
   pnpm run dev
   ```
5. Access:
   - **Frontend Dashboard**: `http://localhost:3001`
   - **Backend OpenAPI docs**: `http://localhost:3000/docs`
  
# 👨‍💻 Author

<div align="center">

### Manvi Yadav

**Registration Number:** RA2311003030359  
**B.Tech Computer Science & Engineering**  
**SRM Institute of Science and Technology**
