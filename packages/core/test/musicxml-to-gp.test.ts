import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { unzipSync } from 'fflate';
import * as alphaTab from '@coderline/alphatab';
import { musicxmlToGp } from '../src/engines/alphatab';

const here = dirname(fileURLToPath(import.meta.url));
const xml = new Uint8Array(readFileSync(join(here, 'fixtures/twinkle.musicxml')));
const drumXml = new Uint8Array(readFileSync(join(here, 'fixtures/drum-1beat.musicxml')));

const firstNote = (track: any): any => {
  for (const staff of track.staves)
    for (const bar of staff.bars)
      for (const voice of bar.voices)
        for (const beat of voice.beats) if (beat.notes?.length) return beat.notes[0];
  return undefined;
};

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

  it('injects the GP boilerplate files Guitar Pro requires to open the file', () => {
    const files = unzipSync(musicxmlToGp(xml));
    expect(Object.keys(files)).toEqual(
      expect.arrayContaining([
        'meta.json',
        'Content/Preferences.json',
        'Content/ScoreViews/1.gpsv',
        'Content/Stylesheets/score.gpss',
      ]),
    );
  });

  it('drum track: notes map to the standard GP7 kit with real noteheads', () => {
    const gp = musicxmlToGp(drumXml);
    const score = alphaTab.importer.ScoreLoader.loadScoreFromBytes(gp);
    const drum = score.tracks[0];
    // Swapped to AlphaTab's full standard kit (~95 entries), not a bare custom list.
    expect(drum.percussionArticulations.length).toBeGreaterThanOrEqual(90);
    const note = firstNote(drum);
    expect(note).toBeDefined();
    const art = drum.percussionArticulations[note.percussionArticulation];
    // A real notehead glyph (not the "bare" -1 that made AlphaTab show nothing).
    expect(art.noteHeadDefault).not.toBe(-1);
  });
});
