import { describe, it, expect } from 'vitest';
import { computeDiff } from '@acp/core';

describe('computeDiff', () => {
  it('detects changed values', () => {
    const prev = { measures: { arr: 480000 } };
    const curr = { measures: { arr: 500000 } };
    const changes = computeDiff(prev, curr);
    expect(changes).toEqual([
      { path: 'measures.arr', previous: 480000, current: 500000 },
    ]);
  });

  it('detects added fields', () => {
    const prev = { measures: { arr: 480000 } };
    const curr = { measures: { arr: 480000, nps: 42 } };
    const changes = computeDiff(prev, curr);
    expect(changes).toEqual([
      { path: 'measures.nps', previous: undefined, current: 42 },
    ]);
  });

  it('detects removed fields', () => {
    const prev = { measures: { arr: 480000, nps: 42 } };
    const curr = { measures: { arr: 480000 } };
    const changes = computeDiff(prev, curr);
    expect(changes).toEqual([
      { path: 'measures.nps', previous: 42, current: undefined },
    ]);
  });

  it('returns empty array for identical objects', () => {
    const obj = { measures: { arr: 480000 }, attributes: { name: 'Acme' } };
    const changes = computeDiff(obj, { ...obj });
    expect(changes).toEqual([]);
  });

  it('detects deeply nested changes', () => {
    const prev = { attributes: { contact: { name: 'John', email: 'john@acme.com' } } };
    const curr = { attributes: { contact: { name: 'John', email: 'john@newacme.com' } } };
    const changes = computeDiff(prev, curr);
    expect(changes).toHaveLength(1);
    expect(changes[0].path).toBe('attributes.contact.email');
    expect(changes[0].previous).toBe('john@acme.com');
    expect(changes[0].current).toBe('john@newacme.com');
  });

  it('detects array changes', () => {
    const prev = { attributes: { flags: ['vip'] } };
    const curr = { attributes: { flags: ['vip', 'at-risk'] } };
    const changes = computeDiff(prev, curr);
    expect(changes).toHaveLength(1);
    expect(changes[0].path).toBe('attributes.flags');
  });

  it('generates correct dot-notation paths', () => {
    const prev = { measures: { health: 87 }, intents: { risk: 'low' } };
    const curr = { measures: { health: 42 }, intents: { risk: 'high' } };
    const changes = computeDiff(prev, curr);
    const paths = changes.map((c) => c.path);
    expect(paths).toContain('measures.health');
    expect(paths).toContain('intents.risk');
  });

  it('handles changes across multiple dimensions', () => {
    const prev = { measures: { arr: 100 }, actors: { owner: 'A' }, temporals: { date: '2026-01-01' } };
    const curr = { measures: { arr: 200 }, actors: { owner: 'B' }, temporals: { date: '2026-01-01' } };
    const changes = computeDiff(prev, curr);
    expect(changes).toHaveLength(2);
  });
});
