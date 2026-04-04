import { describe, it, expect } from 'vitest';
import { generateSnapshot } from '@acp/core';

describe('generateSnapshot', () => {
  it('includes measures in snapshot', () => {
    const context = { measures: { arr: 480000, nps: 42 } };
    const snapshot = generateSnapshot(context);
    expect(snapshot.measures).toEqual({ arr: 480000, nps: 42 });
  });

  it('includes temporals in snapshot', () => {
    const context = { temporals: { renewal_date: '2026-06-01' } };
    const snapshot = generateSnapshot(context);
    expect(snapshot.temporals).toEqual({ renewal_date: '2026-06-01' });
  });

  it('includes flags from attributes', () => {
    const context = { attributes: { name: 'Acme', flags: ['vip', 'enterprise'] } };
    const snapshot = generateSnapshot(context);
    expect(snapshot.flags).toEqual(['vip', 'enterprise']);
  });

  it('excludes attributes other than flags', () => {
    const context = { attributes: { name: 'Acme', industry: 'Tech' } };
    const snapshot = generateSnapshot(context);
    expect(snapshot.attributes).toBeUndefined();
    expect(snapshot.flags).toBeUndefined();
  });

  it('includes changed fields when paths provided', () => {
    const context = {
      measures: { arr: 500000 },
      actors: { owner: 'Sarah' },
    };
    const snapshot = generateSnapshot(context, ['actors.owner']);
    expect(snapshot.changedFields).toEqual({ 'actors.owner': 'Sarah' });
  });

  it('handles empty context', () => {
    const snapshot = generateSnapshot({});
    expect(snapshot).toEqual({});
  });

  it('handles missing nested paths gracefully', () => {
    const context = { measures: { arr: 100 } };
    const snapshot = generateSnapshot(context, ['actors.owner']);
    expect(snapshot.changedFields).toEqual({});
  });

  it('includes both measures and temporals when present', () => {
    const context = {
      measures: { arr: 480000 },
      temporals: { renewal_date: '2026-06-01' },
      actors: { owner: 'Sarah' },
    };
    const snapshot = generateSnapshot(context);
    expect(snapshot.measures).toBeDefined();
    expect(snapshot.temporals).toBeDefined();
    expect(snapshot.actors).toBeUndefined();
  });
});
