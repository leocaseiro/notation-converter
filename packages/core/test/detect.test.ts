import { describe, it, expect } from 'vitest';
import { detectFormat } from '../src/detect';

const enc = (s: string) => new TextEncoder().encode(s);

describe('detectFormat', () => {
  it('detects MusicXML by content', async () => {
    const xml = enc('<?xml version="1.0"?><score-partwise version="4.0"></score-partwise>');
    expect(await detectFormat(xml)).toBe('musicxml');
  });

  it('detects MIDI by magic bytes (MThd)', async () => {
    const midi = new Uint8Array([0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6]);
    expect(await detectFormat(midi)).toBe('midi');
  });

  it('detects by File extension', async () => {
    const file = new File([enc('<score-partwise/>')], 'song.musicxml');
    expect(await detectFormat(file)).toBe('musicxml');
  });

  it('returns null for unknown', async () => {
    expect(await detectFormat(enc('hello world'))).toBeNull();
  });
});
