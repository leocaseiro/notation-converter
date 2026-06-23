import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createConverter } from '../src/converter';

const here = dirname(fileURLToPath(import.meta.url));
const xml = new Uint8Array(readFileSync(join(here, 'fixtures/twinkle.musicxml')));

describe('createConverter', () => {
  it('canConvert reflects implemented routes', () => {
    const c = createConverter();
    expect(c.canConvert('musicxml', 'gp')).toBe(true);
    expect(c.canConvert('gp', 'midi')).toBe(false); // not implemented in skeleton
  });

  it('getMatrix flags musicxml->gp as implemented', () => {
    const c = createConverter();
    const r = c.getMatrix().find((x) => x.from === 'musicxml' && x.to === 'gp');
    expect(r?.implemented).toBe(true);
    const other = c.getMatrix().find((x) => x.from === 'gp' && x.to === 'midi');
    expect(other?.implemented).toBe(false);
  });

  it('converts musicxml -> gp with a sensible result', async () => {
    const c = createConverter();
    const file = new File([xml], 'twinkle.musicxml');
    const res = await c.convert(file, { to: 'gp' });
    expect(res.format).toBe('gp');
    expect(res.filename).toBe('twinkle.gp');
    expect(res.data.length).toBeGreaterThan(0);
    expect(res.mimeType).toContain('gp');
  });

  it('throws on an unimplemented route', async () => {
    const c = createConverter();
    await expect(c.convert(xml, { from: 'gp', to: 'midi' })).rejects.toThrow();
  });
});
