import * as alphaTab from '@coderline/alphatab';
import { robustExportGp } from './gp-robust';

/**
 * Convert MusicXML bytes to a Guitar Pro 7 (.gp) file that opens in Guitar Pro
 * the app — headless. Beyond AlphaTab's import + Gp7Exporter, this applies the
 * drum kit-swap, fret sanitization, and GP-boilerplate injection required for
 * real-world (often messy) input (see docs/superpowers/debug).
 */
export function musicxmlToGp(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const score = alphaTab.importer.ScoreLoader.loadScoreFromBytes(bytes);
  return robustExportGp(score);
}
