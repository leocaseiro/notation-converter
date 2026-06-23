import { describe, it, expect } from 'vitest';
import { ROUTES, routeKey } from '../src/matrix';

describe('matrix', () => {
  it('marks musicxml->gp as a supported, light route', () => {
    const r = ROUTES.find((x) => x.from === 'musicxml' && x.to === 'gp');
    expect(r).toBeDefined();
    expect(r?.supported).toBe(true);
    expect(r?.heavy).toBe(false);
    expect(r?.engine).toBe('alphatab');
  });

  it('marks gp->musicxml as deferred (not supported in v1)', () => {
    const r = ROUTES.find((x) => x.from === 'gp' && x.to === 'musicxml');
    expect(r?.supported).toBe(false);
  });

  it('builds a route key', () => {
    expect(routeKey('musicxml', 'gp')).toBe('musicxml>gp');
  });
});
