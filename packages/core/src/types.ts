export type Format = 'midi' | 'musicxml' | 'gp';
export type ConvertInput = File | ArrayBuffer | Uint8Array;

export interface LoadProgress {
  phase: 'engine-download' | 'engine-init' | 'converting';
  engine?: 'pyodide' | 'alphatab';
  loaded?: number;
  total?: number;
  ratio?: number;
  message?: string;
}

export interface ConvertOptions {
  to: Format;
  from?: Format;
  signal?: AbortSignal;
  onProgress?: (p: LoadProgress) => void;
}

export interface ConvertResult {
  // Uint8Array<ArrayBuffer> (not the broader ArrayBufferLike) so consumers can
  // pass `result.data` directly to `new Blob([...])` without an unsafe cast.
  data: Uint8Array<ArrayBuffer>;
  format: Format;
  mimeType: string;
  filename: string;
  warnings: string[];
}

export interface RouteInfo {
  from: Format;
  to: Format;
  engine: 'pyodide' | 'alphatab';
  heavy: boolean;
  lossy: boolean;
  supported: boolean;      // part of the v1 design (not deferred to v2)
  implemented?: boolean;   // wired up in the current build (set at runtime)
}

export interface ConverterConfig {
  engineBaseUrl?: string;
  cache?: boolean;
}

export type ConvertStatus = 'idle' | 'loading-engine' | 'converting' | 'done' | 'error';

export interface Converter {
  convert(input: ConvertInput, opts: ConvertOptions): Promise<ConvertResult>;
  detectFormat(input: ConvertInput): Promise<Format | null>;
  getMatrix(): RouteInfo[];
  canConvert(from: Format, to: Format): boolean;
  preloadEngine(engine: 'pyodide' | 'alphatab', onProgress?: (p: LoadProgress) => void): Promise<void>;
}
