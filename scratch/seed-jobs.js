const http = require('http');

const API_BASE = 'http://localhost:3000/api/v1';
const DEFAULT_PROJECT_ID = '00000000-0000-0000-0000-000000000000';

function apiRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = `${API_BASE}${path}`;
    const parsedUrl = new URL(url);
    
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer bypass-token'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 400) {
            reject({ status: res.statusCode, error: parsed });
          } else {
            resolve(parsed);
          }
        } catch (e) {
          resolve(data);
        }
      });
    });

    req.on('error', (err) => { reject(err); });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function run() {
  console.log('Starting seed process via API...');

  try {
    // 1. Fetch retry policies
    console.log('Fetching retry policies...');
    const policies = await apiRequest('GET', '/retry-policies');
    const fixedPolicy = policies.find(p => p.name === 'Default Fixed') || policies[0];
    const exponentialPolicy = policies.find(p => p.name === 'Default Exponential') || policies[0];
    
    console.log(`Using Retry Policies: Fixed(${fixedPolicy.id}), Exponential(${exponentialPolicy.id})`);

    // 2. Create queues
    const queuesToCreate = [
      { name: 'data-ingestion', priority: 10, concurrencyLimit: 3, retryPolicyId: fixedPolicy.id },
      { name: 'heavy-computations', priority: 5, concurrencyLimit: 2, retryPolicyId: exponentialPolicy.id },
      { name: 'image-resizing', priority: 8, concurrencyLimit: 4, retryPolicyId: fixedPolicy.id }
    ];

    const activeQueues = {};

    for (const qDef of queuesToCreate) {
      console.log(`Creating/Verifying queue: ${qDef.name}...`);
      try {
        const queue = await apiRequest('POST', `/projects/${DEFAULT_PROJECT_ID}/queues`, qDef);
        console.log(`Created queue: ${queue.name} (${queue.id})`);
        activeQueues[qDef.name] = queue;
      } catch (err) {
        if (err.status === 400) {
          // already exists, fetch list to find its ID
          console.log(`Queue ${qDef.name} already exists. Fetching existing queues...`);
          const existingQueues = await apiRequest('GET', `/projects/${DEFAULT_PROJECT_ID}/queues`);
          const found = existingQueues.find(eq => eq.name === qDef.name);
          if (found) {
            console.log(`Found existing queue: ${found.name} (${found.id})`);
            activeQueues[qDef.name] = found;
          }
        } else {
          throw err;
        }
      }
    }

    // 3. Submit Immediate Success Jobs to 'data-ingestion'
    console.log('\nSubmitting immediate success jobs to data-ingestion...');
    for (let i = 1; i <= 5; i++) {
      const job = await apiRequest('POST', `/queues/${activeQueues['data-ingestion'].id}/jobs`, {
        type: 'IMMEDIATE',
        payload: {
          taskName: `Ingest User File #${i}`,
          durationMs: 800 + Math.floor(Math.random() * 400),
          simulateFailure: false
        },
        idempotencyKey: `ingest-key-unique-${Date.now()}-${i}`
      });
      console.log(`Submitted Job ID: ${job.id}`);
    }

    // 4. Submit Jobs that fail (Simulate error to put them in Dead Letter Queue)
    console.log('\nSubmitting failing jobs to heavy-computations (will end up in DLQ)...');
    for (let i = 1; i <= 2; i++) {
      const job = await apiRequest('POST', `/queues/${activeQueues['heavy-computations'].id}/jobs`, {
        type: 'IMMEDIATE',
        payload: {
          taskName: `Calculate Prime Orbitals #${i}`,
          durationMs: 500,
          simulateFailure: true,
          simulateErrorMsg: `Stack Overflow: Connection timed out in calculation cycle #${i}`
        },
        maxRetries: 2, // Retries are low so they go to DLQ quickly
        idempotencyKey: `fail-key-unique-${Date.now()}-${i}`
      });
      console.log(`Submitted Failing Job ID: ${job.id}`);
    }

    // 5. Submit Delayed Jobs (30 seconds delay)
    console.log('\nSubmitting delayed jobs to image-resizing...');
    const delayedJob = await apiRequest('POST', `/queues/${activeQueues['image-resizing'].id}/jobs`, {
      type: 'DELAYED',
      payload: {
        taskName: 'Resize Hero Banner JPG',
        durationMs: 1200
      },
      delayMs: 30000,
      idempotencyKey: `delayed-key-unique-${Date.now()}`
    });
    console.log(`Submitted Delayed Job ID: ${delayedJob.id} (runs in 30s)`);

    // 6. Submit Recurring (Cron) Jobs
    console.log('\nSubmitting recurring Cron job to background-reports...');
    const cronJob = await apiRequest('POST', `/queues/${activeQueues['data-ingestion'].id}/jobs`, {
      type: 'RECURRING',
      payload: {
        taskName: 'Database Vacuum & Log Rotate',
        durationMs: 1500
      },
      cronExpression: '*/2 * * * *',
      idempotencyKey: `cron-key-unique-${Date.now()}`
    });
    console.log(`Submitted Recurring Job ID: ${cronJob.id}`);

    // 7. Submit Batch Jobs
    console.log('\nSubmitting batch of jobs to data-ingestion...');
    const batchId = `batch-${Math.random().toString(36).substring(2, 9)}`;
    const batchJobs = await apiRequest('POST', `/queues/${activeQueues['data-ingestion'].id}/batches`, {
      batchId: batchId,
      jobs: [
        { payload: { taskName: 'Sync Contacts Chunk 1', durationMs: 600 } },
        { payload: { taskName: 'Sync Contacts Chunk 2', durationMs: 400 } },
        { payload: { taskName: 'Sync Contacts Chunk 3', durationMs: 800 } }
      ]
    });
    console.log(`Submitted Batch ${batchId} containing ${batchJobs.length} jobs.`);

    // 8. Submit Dependent Jobs Workflow (A completes -> B runs -> C runs)
    console.log('\nSubmitting dependent job workflows...');
    
    // Parent Job
    const parentJob = await apiRequest('POST', `/queues/${activeQueues['data-ingestion'].id}/jobs`, {
      type: 'IMMEDIATE',
      payload: {
        taskName: 'Workflow Parent Task: Download Raw Images Archive',
        durationMs: 2000
      },
      idempotencyKey: `wf-parent-${Date.now()}`
    });
    console.log(`Created Parent Job ID: ${parentJob.id}`);

    // Child Job (depends on Parent Completing)
    const childJob = await apiRequest('POST', `/queues/${activeQueues['image-resizing'].id}/jobs`, {
      type: 'SCHEDULED', // set type as SCHEDULED/delayed for waiting
      payload: {
        taskName: 'Workflow Child Task: Extract Images & Resize'
      },
      parentJobIds: [parentJob.id],
      idempotencyKey: `wf-child-${Date.now()}`
    });
    console.log(`Created Dependent Child Job ID: ${childJob.id} (waiting on ${parentJob.id})`);

    console.log('\nSeed successfully completed!');
  } catch (err) {
    console.error('Seed execution failed:', err);
  }
}

run();
