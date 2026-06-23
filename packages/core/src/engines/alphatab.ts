import * as alphaTab from '@coderline/alphatab';

/** Convert MusicXML bytes to Guitar Pro 7 (.gp) bytes, headless. */
export function musicxmlToGp(bytes: Uint8Array): Uint8Array {
  const score = alphaTab.importer.ScoreLoader.loadScoreFromBytes(bytes);
  const exporter = new alphaTab.exporter.Gp7Exporter();
  return exporter.export(score, new alphaTab.Settings());
}
