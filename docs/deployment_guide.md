# Deployment and Setup Guide

This guide details how to launch and configure the Distributed Job Scheduler Platform on your environment.

## 1. Option A: Local Run (Recommended for Immediate Testing)

Since your system currently has **MySQL running on port 3306** and does not have a native Redis server, the platform is pre-configured to fall back to an **in-memory Redis Mock (`ioredis-mock`)** and connect to your local MySQL database.

### Step 1: Set up the environment file
Verify the `.env` file at the project root contains the correct database credentials:
```env
DATABASE_URL="mysql://root:SchedulerSecure123!@127.0.0.1:3306/distributed_job_scheduler"
JWT_SECRET="JWT_Super_Secret_Key_For_Job_Scheduler_2026_!"
PORT=3000
NODE_ENV="development"
```

### Step 2: Install dependencies
If you haven't already, install the monorepo workspace packages:
```bash
pnpm install
```

### Step 3: Run the database schema initialization
Build the shared package:
```bash
pnpm --filter shared build
```
Since TypeORM is configured with `synchronize: true` in development, starting the API will automatically create all tables, indexes, and primary keys inside your local MySQL `distributed_job_scheduler` database!
*(Make sure the database `distributed_job_scheduler` exists in your MySQL instance. You can create it using a client or by running `CREATE DATABASE distributed_job_scheduler;` in MySQL command line).*

### Step 4: Run the API, Worker, and Web applications in parallel
Run the unified start command:
```bash
pnpm run dev
```
This triggers:
1. **NestJS API** on `http://localhost:3000` (Swagger docs on `http://localhost:3000/docs`).
2. **NestJS Worker** in the background, polling database queues.
3. **Next.js Web Dashboard** on `http://localhost:3001` (or `3000` depending on port availability; default dev script will list it. Typically next dev launches on `http://localhost:3000` but since NestJS API claims `3000`, Next.js will automatically fall back to `http://localhost:3001` or you can access the frontend web).

---

## 2. Option B: Running with Docker Compose (Production Staging)

To deploy the entire stack inside container isolated pods containing native **PostgreSQL** and **Redis** servers:

### Step 1: Start the containers
Execute the following command at the project root:
```bash
docker-compose up --build
```
This command builds and orchestrates:
- **`scheduler_postgres`**: PostgreSQL database at port `5432` with persistent volume storage.
- **`scheduler_redis`**: Redis server at port `6379`.
- **`scheduler_api`**: NestJS API on `http://localhost:3000`.
- **`scheduler_worker`**: Background worker pulling tasks.
- **`scheduler_web`**: Next.js 15 frontend panel mapped to port `80` (accessible at `http://localhost`).

### Step 2: Accessing portals
- **Dashboard**: `http://localhost` (or `http://localhost:3000` inside node runner configurations).
- **API Swagger Documentation**: `http://localhost:3000/docs`.

---

## 3. Running Automated Tests

Run the Vitest test suite covering scheduler calculations and dependency check algorithms:
```bash
pnpm run test
```
To run tests with coverage reporting:
```bash
pnpm --filter api test
```
