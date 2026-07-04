import { describe, it, expect, vi } from 'vitest';

// Simple mockup of dependency resolver logic for testing
interface JobMock {
  id: string;
  status: 'QUEUED' | 'SCHEDULED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'DLQ';
  payload: string;
  queueId: string;
}

class DependencyResolver {
  constructor(private jobs: JobMock[]) {}

  async resolveDependentJobs(completedJobId: string): Promise<string[]> {
    const activatedJobIds: string[] = [];

    // Find jobs in SCHEDULED state
    const scheduled = this.jobs.filter((j) => j.status === 'SCHEDULED');

    for (const job of scheduled) {
      try {
        const payload = JSON.parse(job.payload);
        if (payload._parentJobIds && Array.isArray(payload._parentJobIds)) {
          if (payload._parentJobIds.includes(completedJobId)) {
            // Check if all parent jobs are completed now
            const parents = this.jobs.filter((p) => payload._parentJobIds.includes(p.id));
            const uncompleted = parents.filter((p) => p.status !== 'COMPLETED');
            
            if (uncompleted.length === 0) {
              job.status = 'QUEUED';
              activatedJobIds.push(job.id);
            }
          }
        }
      } catch (err) {
        // ignore
      }
    }

    return activatedJobIds;
  }
}

describe('Workflow Dependency Engine', () => {
  it('should not activate a dependent job if parent jobs are not completed', async () => {
    const jobs: JobMock[] = [
      { id: 'parent-1', status: 'RUNNING', payload: '{}', queueId: 'q-1' },
      { id: 'parent-2', status: 'COMPLETED', payload: '{}', queueId: 'q-1' },
      { 
        id: 'child-1', 
        status: 'SCHEDULED', 
        payload: JSON.stringify({ _parentJobIds: ['parent-1', 'parent-2'] }), 
        queueId: 'q-1' 
      },
    ];

    const resolver = new DependencyResolver(jobs);
    
    // Parent-2 completes (Parent-1 is still RUNNING)
    const activated = await resolver.resolveDependentJobs('parent-2');
    
    expect(activated).not.toContain('child-1');
    expect(jobs.find(j => j.id === 'child-1')?.status).toBe('SCHEDULED');
  });

  it('should activate a dependent job once ALL parent jobs are completed', async () => {
    const jobs: JobMock[] = [
      { id: 'parent-1', status: 'COMPLETED', payload: '{}', queueId: 'q-1' },
      { id: 'parent-2', status: 'COMPLETED', payload: '{}', queueId: 'q-1' },
      { 
        id: 'child-1', 
        status: 'SCHEDULED', 
        payload: JSON.stringify({ _parentJobIds: ['parent-1', 'parent-2'] }), 
        queueId: 'q-1' 
      },
    ];

    const resolver = new DependencyResolver(jobs);
    
    // Parent-2 completes and was the last pending parent
    const activated = await resolver.resolveDependentJobs('parent-2');
    
    expect(activated).toContain('child-1');
    expect(jobs.find(j => j.id === 'child-1')?.status).toBe('QUEUED');
  });
});
