import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as alphaTab from '@coderline/alphatab';
import { musicxmlToGp } from '../src/engines/alphatab';

const here = dirname(fileURLToPath(import.meta.url));
const xml = new Uint8Array(readFileSync(join(here, 'fixtures/twinkle.musicxml')));

describe('musicxmlToGp', () => {
  it('produces non-empty Guitar Pro bytes', () => {
    const gp = musicxmlToGp(xml);
    expect(gp).toBeInstanceOf(Uint8Array);
    expect(gp.length).toBeGreaterThan(0);
  });

  it('round-trips: exported GP re-imports to a score with notes', () => {
    const gp = musicxmlToGp(xml);
    const score = alphaTab.importer.ScoreLoader.loadScoreFromBytes(gp);
    expect(score.tracks.length).toBeGreaterThan(0);
    // 4 quarter notes in one 4/4 measure
    const beats = score.tracks[0].staves[0].bars[0].voices[0].beats.length;
    expect(beats).toBe(4);
  });
});
