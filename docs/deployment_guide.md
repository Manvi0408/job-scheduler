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

---

## 4. Cloud Production Deployment

Because this is a distributed system containing persistent processes (the API's WebSockets and the Worker's background loops), **you cannot run the entire platform on Vercel alone**. Instead, deploy the components to specialized cloud hosts.

### Production Architecture
```mermaid
graph TD
    User([User Browser]) -->|HTTPS| Web[Next.js Frontend on Vercel]
    Web -->|HTTP / WebSockets| API[NestJS API on Render/Railway]
    Worker[NestJS Worker on Render/Railway] -->|MySQL/PostgreSQL| DB[(Managed Database Neon/Aiven)]
    API -->|MySQL/PostgreSQL| DB
    API -->|TCP / Redis Protocol| Redis[(Managed Redis Upstash/RedisCloud)]
    Worker -->|TCP / Redis Protocol| Redis
```

---

### Step 1: Managed Database & Redis (Data Tier)
1. **Database**: Provision a managed database (PostgreSQL on [Neon](https://neon.tech) or MySQL on [Aiven](https://aiven.io)). Keep the connection URI.
2. **Redis**: Provision a managed Redis database on [Upstash](https://upstash.com) or [Redis Labs](https://redis.com). Keep the connection URI/details.

---

### Step 2: Deploy Backend API & Worker (Render/Railway)
Deploy the API and Worker to platforms supporting long-running Node.js processes, such as **Render** or **Railway**.

#### A. NestJS API (Web Service)
- **Deployment Type**: Web Service (or Docker container using [`apps/api/Dockerfile`](file:///C:/Users/Manvi/.gemini/antigravity-ide/scratch/distributed-job-scheduler/apps/api/Dockerfile))
- **Build Command**: `pnpm install && pnpm --filter shared build && pnpm --filter api build`
- **Start Command**: `pnpm --filter api start`
- **Port**: `3000` (mapped to external HTTP/HTTPS traffic)
- **Environment Variables**:
  ```env
  DATABASE_URL="your-managed-db-connection-string"
  REDIS_HOST="your-redis-host"
  REDIS_PORT="your-redis-port"
  REDIS_PASSWORD="your-redis-password"
  JWT_SECRET="generate-a-strong-random-key"
  PORT=3000
  NODE_ENV="production"
  ```

#### B. NestJS Worker (Background Worker / Private Service)
- **Deployment Type**: Background Worker (does not need open ports)
- **Build Command**: `pnpm install && pnpm --filter shared build && pnpm --filter worker build`
- **Start Command**: `pnpm --filter worker start`
- **Environment Variables**: Same as the API (`DATABASE_URL`, `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `NODE_ENV`).

---

### Step 3: Deploy Next.js Web Dashboard (Vercel)
Vercel is perfect for the frontend application.

1. **Import the repository** into Vercel.
2. **Framework Preset**: Next.js.
3. **Root Directory**: `apps/web` (or root path if configured in monorepo with Vercel's build settings).
4. **Build & Development Settings**:
   - **Build Command**: `cd ../.. && pnpm install && pnpm --filter shared build && pnpm --filter web build` (Vercel overrides this automatically in monorepos if "pnpm" is detected).
5. **Environment Variables**:
   - `NEXT_PUBLIC_API_URL`: Set this to your deployed **NestJS API** production domain (e.g. `https://scheduler-api.onrender.com`).
6. Click **Deploy**. Vercel will build and serve your beautiful dark-themed dashboard.

