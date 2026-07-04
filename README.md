# Distributed Job Scheduler Platform

A production-grade, distributed background job processing platform inspired by BullMQ, Sidekiq, Celery, and AWS SQS, built with Node.js, TypeScript, NestJS, TypeORM, PostgreSQL/MySQL, Redis, Socket.IO, Next.js 15, Tailwind CSS, and Docker.

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

---

## Core Platform Features

1. **Layered Dark Developer-Tool Theme**: Beautiful, premium theme using HSL `#0A0A0F` dark layout background, semi-transparent `#12121A` borders, `#1A1A24` glass cards, and amber accent `#F59E0B` interactive glow cues.
2. **Dashboard Overview Workspace**: Real-time widgets displaying total job counts, active workers, average execution times, network throughput area charts, and system uptime rates.
3. **Advanced Queue Management**: Visual tables showing health status (Healthy / Warning / Critical states), inline pause/resume controls, edit forms, clear queue triggers, and delete buttons.
4. **Queue Details Sub-page**: Specific sub-navigation views for Overview parameters, historical throughput Recharts, worker node assignments, and queue job logs.
5. **Real-time Live Activity Events Feed**: Collapsible right-hand panel connected to Socket.IO telemetry gateways streaming status shifts (crashes, retries, completions, heartbeats) live.
6. **Keyboard Shortcuts Command Palette**: Press `Ctrl + K` to display the modal overlay for shortcut actions (create queues, submit jobs, navigate tabs).
7. **Search Everywhere Header**: Instant search filter dynamically matching job IDs, queues, workers, and project parameters.
8. **Interactive Job Explorer & Details Drawer**: Slide-out pane showing job metadata, syntax-highlighted JSON task parameters, vertical stepper timelines (Created -> Queued -> Running -> Completed), and individual execution logs.
9. **Dead Letter Queue dedicated console**: View crashed jobs, trace log diagnostics, requeue tasks immediately, or clone payloads to submit new ones.
10. **System Health Status Board**: Operational monitoring showing online/offline status lights for Rest API Gateways, Redis nodes (real/mock), local databases, Socket.IO channels, and worker instances.
11. **Logs Explorer Console**: Terminal-themed logs dashboard filtering entries by level (INFO/WARN/ERROR), with quick clip-to-copy and logs download actions.
12. **Scheduler Calendar View**: Central monitor displaying recurring Cron expressions (e.g. `*/5 * * * *`), cron explanations, delayed offset lists, and next planned runs.
13. **Workflow Dependency DAG visualization**: Hierarchical task pipeline diagrams illustrating parent-child workflow dependencies (e.g. Ingest -> Process -> Report).
14. **Worker Clusters Monitor**: Live stats for each worker instance showing heartbeat telemetry logs, system CPU loads, RAM usage percentages, and average durations.
15. **Retry Policies Manager**: View strategy mappings (Fixed, Linear, Exponential backoff calculations) governing queue failures.
16. **AI Failure summary and diagnostics**: Automatic diagnostics modal detailing failed runs, likely root causes, and remediation advice.
17. **Toast Event Notifications**: Banner system notifications showing success, warning, info, and error status transitions.
18. **Polished Empty States**: Custom graphic placeholders with quick-action CTAs for newly created projects.
19. **Mobile Responsiveness**: Designed from the ground up to render beautifully on mobile, tablet, and widescreen developer screens.
20. **Under-the-hood Redis Fallback Direct Polling**: Automatic transition to Mysql-based polling in the background if a local Redis server is missing, avoiding Lua-based container blockages.

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
