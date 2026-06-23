import type { ConvertInput, Format } from './types';
import { readInput } from './io';

export async function detectFormat(input: ConvertInput): Promise<Format | null> {
  const { bytes, filename } = await readInput(input);
  const ext = filename?.toLowerCase().split('.').pop();

  if (ext === 'mid' || ext === 'midi') return 'midi';
  if (ext === 'musicxml' || ext === 'xml' || ext === 'mxl') return 'musicxml';
  if (ext === 'gp' || ext === 'gpx' || /^gp[3-5]$/.test(ext ?? '')) return 'gp';

  // magic-byte fallback
  if (bytes.length >= 4 && bytes[0] === 0x4d && bytes[1] === 0x54 && bytes[2] === 0x68 && bytes[3] === 0x64) {
    return 'midi'; // "MThd"
  }
  const head = new TextDecoder().decode(bytes.slice(0, 512));
  if (head.includes('<score-partwise') || head.includes('<score-timewise')) return 'musicxml';

  return null;
}
