import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildLocalLinkContext, LINK_CONTEXT_VERSION } from '../linkContext';

describe('linkContext', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-25T12:00:00.000Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('buildLocalLinkContext define version, linkId, supplierId, clientId e associatedAt (ISO)', () => {
    const ctx = buildLocalLinkContext('sup-1', 'cli-1');
    expect(ctx.version).toBe(LINK_CONTEXT_VERSION);
    expect(ctx.linkId).toBe('sup-1__cli-1');
    expect(ctx.supplierId).toBe('sup-1');
    expect(ctx.clientId).toBe('cli-1');
    expect(ctx.associatedAt).toBe('2026-04-25T12:00:00.000Z');
  });
});
