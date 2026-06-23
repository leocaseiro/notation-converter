import type {
  Converter, ConvertInput, ConvertOptions, ConvertResult, ConverterConfig, Format, LoadProgress,
} from './types';
import { readInput } from './io';
import { detectFormat, detectFormatFromBytes } from './detect';
import { ROUTES, routeKey } from './matrix';
import { musicxmlToGp } from './engines/alphatab';

type ConvertFn = (bytes: Uint8Array, opts: ConvertOptions) => Promise<Uint8Array> | Uint8Array;

const MIME: Record<Format, string> = {
  midi: 'audio/midi',
  musicxml: 'application/vnd.recordare.musicxml+xml',
  gp: 'application/gpx',
};
const EXT: Record<Format, string> = { midi: 'mid', musicxml: 'musicxml', gp: 'gp' };

export function createConverter(_config: ConverterConfig = {}): Converter {
  const registry = new Map<string, ConvertFn>();
  registry.set(routeKey('musicxml', 'gp'), (bytes) => musicxmlToGp(bytes));

  const canConvert = (from: Format, to: Format) => registry.has(routeKey(from, to));

  return {
    canConvert,
    detectFormat,
    getMatrix() {
      return ROUTES.filter((r) => r.supported).map((r) => ({
        ...r,
        implemented: registry.has(routeKey(r.from, r.to)),
      }));
    },
    async preloadEngine(engine: 'pyodide' | 'alphatab', onProgress?: (p: LoadProgress) => void) {
      if (engine === 'alphatab') {
        onProgress?.({ phase: 'engine-init', engine: 'alphatab', ratio: 1 });
        return;
      }
      throw new Error(`Engine "${engine}" is not available in this build yet`);
    },
    async convert(input: ConvertInput, opts: ConvertOptions): Promise<ConvertResult> {
      const { bytes, filename } = await readInput(input);
      const from = opts.from ?? detectFormatFromBytes(bytes, filename);
      if (!from) throw new Error('Could not detect source format; pass opts.from');
      const fn = registry.get(routeKey(from, opts.to));
      if (!fn) throw new Error(`Conversion ${from} -> ${opts.to} is not supported`);
      opts.onProgress?.({ phase: 'converting', engine: 'alphatab' });
      const data = await fn(bytes, opts);
      const base = filename?.replace(/\.[^.]+$/, '') ?? 'output';
      return { data, format: opts.to, mimeType: MIME[opts.to], filename: `${base}.${EXT[opts.to]}`, warnings: [] };
    },
  };
}
