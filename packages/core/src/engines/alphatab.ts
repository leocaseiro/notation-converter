import * as alphaTab from '@coderline/alphatab';

/** Convert MusicXML bytes to Guitar Pro 7 (.gp) bytes, headless. */
export function musicxmlToGp(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const score = alphaTab.importer.ScoreLoader.loadScoreFromBytes(bytes);
  const exporter = new alphaTab.exporter.Gp7Exporter();
  // Gp7Exporter.export() takes only one argument; the second arg was silently ignored.
  // Cast to Uint8Array<ArrayBuffer>: AlphaTab always produces a fresh, full-buffer
  // array so this narrowing is safe and lets callers pass the result to `new Blob()`
  // without an unsafe `as unknown as BlobPart` double-cast.
  const out = exporter.export(score) as Uint8Array<ArrayBuffer>;
  return out;
}
