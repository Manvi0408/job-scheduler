import { describe, it, expect } from 'vitest';
import { RetryPolicy } from 'shared';

function calculateBackoff(policy: Partial<RetryPolicy>, attempt: number): number {
  const base = policy.baseDelayMs ?? 1000;
  const max = policy.maxDelayMs ?? 60000;

  let delay = base;
  if (policy.strategy === 'LINEAR') {
    delay = base * attempt;
  } else if (policy.strategy === 'EXPONENTIAL') {
    delay = base * Math.pow(2, attempt - 1);
  }

  return Math.min(delay, max);
}

describe('Retry Backoff Calculations', () => {
  it('should calculate FIXED backoff correctly', () => {
    const policy: Partial<RetryPolicy> = {
      strategy: 'FIXED',
      baseDelayMs: 2000,
      maxDelayMs: 10000,
    };

    expect(calculateBackoff(policy, 1)).toBe(2000);
    expect(calculateBackoff(policy, 2)).toBe(2000);
    expect(calculateBackoff(policy, 3)).toBe(2000);
  });

  it('should calculate LINEAR backoff correctly', () => {
    const policy: Partial<RetryPolicy> = {
      strategy: 'LINEAR',
      baseDelayMs: 2000,
      maxDelayMs: 10000,
    };

    expect(calculateBackoff(policy, 1)).toBe(2000);
    expect(calculateBackoff(policy, 2)).toBe(4000);
    expect(calculateBackoff(policy, 3)).toBe(6000);
    expect(calculateBackoff(policy, 6)).toBe(10000); // capped at maxDelayMs
  });

  it('should calculate EXPONENTIAL backoff correctly', () => {
    const policy: Partial<RetryPolicy> = {
      strategy: 'EXPONENTIAL',
      baseDelayMs: 1000,
      maxDelayMs: 10000,
    };

    expect(calculateBackoff(policy, 1)).toBe(1000); // 1000 * 2^0
    expect(calculateBackoff(policy, 2)).toBe(2000); // 1000 * 2^1
    expect(calculateBackoff(policy, 3)).toBe(4000); // 1000 * 2^2
    expect(calculateBackoff(policy, 4)).toBe(8000); // 1000 * 2^3
    expect(calculateBackoff(policy, 5)).toBe(10000); // capped at maxDelayMs (16000 -> 10000)
  });
});
