import { CircuitBreaker } from './circuit-breaker';

describe('CircuitBreaker', () => {
  it('allows only one half-open probe and closes after success', () => {
    let now = 1_000;
    const breaker = new CircuitBreaker({
      failureThreshold: 1,
      openTimeoutMs: 30_000,
      probeIntervalMs: 30_000,
      now: () => now,
    });

    expect(breaker.isAllowed()).toBe(true);
    breaker.onFailure();
    expect(breaker.getState()).toBe('open');

    now += 30_000;
    expect(breaker.isAllowed()).toBe(true);
    expect(breaker.getState()).toBe('half_open');
    expect(breaker.isAllowed()).toBe(false);

    breaker.onSuccess();
    expect(breaker.getState()).toBe('closed');
    expect(breaker.isAllowed()).toBe(true);
  });
});