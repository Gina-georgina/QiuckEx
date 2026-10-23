import {
  CORRELATION_ID_HEADER,
  getCurrentCorrelationId,
  generateCorrelationId,
  isValidCorrelationId,
  runWithCorrelationId,
} from './correlation.context';

describe('CorrelationContext', () => {
  it('exposes the canonical correlation ID header', () => {
    expect(CORRELATION_ID_HEADER).toBe('X-Correlation-ID');
  });

  it('generates a non-empty UUIDv4 correlation ID', () => {
    const id = generateCorrelationId();
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(generateCorrelationId()).not.toBe(id);
  });

  it('returns undefined outside of a request scope', () => {
    expect(getCurrentCorrelationId()).toBeUndefined();
  });

  it('scopes the correlation ID to the async context', async () => {
    let inside: string | undefined;
    let captured: string | undefined;

    await runWithCorrelationId('corr-123', async () => {
      captured = getCurrentCorrelationId();
      // Simulate async work that inherits the scope.
      await new Promise((resolve) => setTimeout(resolve, 5));
      inside = getCurrentCorrelationId();
    });

    expect(captured).toBe('corr-123');
    expect(inside).toBe('corr-123');
    // Not leaked beyond the scope.
    expect(getCurrentCorrelationId()).toBeUndefined();
  });

  describe('isValidCorrelationId', () => {
    it('accepts well-formed correlation IDs', () => {
      expect(isValidCorrelationId('corr-123')).toBe(true);
      expect(isValidCorrelationId('abc')).toBe(true);
      expect(isValidCorrelationId(generateCorrelationId())).toBe(true);
      expect(isValidCorrelationId('a'.repeat(128))).toBe(true);
    });

    it('rejects empty or whitespace-only IDs', () => {
      expect(isValidCorrelationId('')).toBe(false);
      expect(isValidCorrelationId('   ')).toBe(false);
      expect(isValidCorrelationId('\t')).toBe(false);
    });

    it('rejects oversized IDs', () => {
      expect(isValidCorrelationId('a'.repeat(129))).toBe(false);
      expect(isValidCorrelationId('a'.repeat(1024))).toBe(false);
    });

    it('rejects malformed IDs', () => {
      expect(isValidCorrelationId('bad id')).toBe(false);
      expect(isValidCorrelationId('bad\nid')).toBe(false);
      expect(isValidCorrelationId('bad/id')).toBe(false);
      expect(isValidCorrelationId('bad;id')).toBe(false);
      expect(isValidCorrelationId('bad,id')).toBe(false);
    });

    it('rejects non-string values', () => {
      expect(isValidCorrelationId(undefined as unknown as string)).toBe(false);
      expect(isValidCorrelationId(null as unknown as string)).toBe(false);
      expect(isValidCorrelationId(123 as unknown as string)).toBe(false);
      expect(isValidCorrelationId({} as unknown as string)).toBe(false);
    });

    it('confirms the generated fallback is a UUIDv4', () => {
      expect(generateCorrelationId()).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
      expect(isValidCorrelationId(generateCorrelationId())).toBe(true);
    });
  });
});