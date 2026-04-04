import { describe, it, expect } from 'vitest';
import { deepMergeContext } from '@acp/core';

describe('deepMergeContext', () => {
  it('merges new keys into existing context', () => {
    const existing = { attributes: { name: 'Acme' } };
    const update = { measures: { arr: 500000 } };
    const result = deepMergeContext(existing, update);
    expect(result).toEqual({ attributes: { name: 'Acme' }, measures: { arr: 500000 } });
  });

  it('preserves existing keys not in the update', () => {
    const existing = { measures: { arr: 480000, nps: 42 }, actors: { owner: 'Sarah' } };
    const update = { measures: { arr: 500000 } };
    const result = deepMergeContext(existing, update);
    expect(result.measures).toEqual({ arr: 500000, nps: 42 });
    expect(result.actors).toEqual({ owner: 'Sarah' });
  });

  it('recursively merges nested objects', () => {
    const existing = { attributes: { name: 'Acme', industry: 'Mfg' } };
    const update = { attributes: { industry: 'Tech' } };
    const result = deepMergeContext(existing, update);
    expect(result.attributes).toEqual({ name: 'Acme', industry: 'Tech' });
  });

  it('replaces arrays entirely', () => {
    const existing = { attributes: { flags: ['vip', 'enterprise'] } };
    const update = { attributes: { flags: ['at-risk'] } };
    const result = deepMergeContext(existing, update);
    expect((result.attributes as Record<string, unknown>).flags).toEqual(['at-risk']);
  });

  it('sets null fields to null (signals deletion)', () => {
    const existing = { measures: { arr: 480000, nps: 42 } };
    const update = { measures: { nps: null } } as unknown as typeof existing;
    const result = deepMergeContext(existing, update);
    expect((result.measures as Record<string, unknown>).arr).toBe(480000);
    expect((result.measures as Record<string, unknown>).nps).toBeNull();
  });

  it('does not mutate the original objects', () => {
    const existing = { measures: { arr: 480000 } };
    const update = { measures: { arr: 500000 } };
    const existingCopy = JSON.parse(JSON.stringify(existing));
    deepMergeContext(existing, update);
    expect(existing).toEqual(existingCopy);
  });

  it('handles empty update', () => {
    const existing = { attributes: { name: 'Acme' }, measures: { arr: 100 } };
    const result = deepMergeContext(existing, {});
    expect(result).toEqual(existing);
  });

  it('handles empty existing', () => {
    const update = { attributes: { name: 'Acme' } };
    const result = deepMergeContext({}, update);
    expect(result).toEqual(update);
  });

  it('handles partial dimension updates', () => {
    const existing = {
      attributes: { name: 'Acme', industry: 'Mfg' },
      measures: { arr: 480000, nps: 42 },
      actors: { owner: 'Sarah' },
    };
    const update = { measures: { arr: 500000 } };
    const result = deepMergeContext(existing, update);
    expect(result.attributes).toEqual({ name: 'Acme', industry: 'Mfg' });
    expect(result.measures).toEqual({ arr: 500000, nps: 42 });
    expect(result.actors).toEqual({ owner: 'Sarah' });
  });
});
