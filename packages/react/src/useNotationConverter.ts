import { useCallback, useMemo, useState } from 'react';
import {
  createConverter,
  type ConvertInput, type ConvertOptions, type ConvertResult,
  type ConverterConfig, type ConvertStatus, type Format, type LoadProgress, type RouteInfo,
} from 'notation-converter';

export function useNotationConverter(config?: ConverterConfig) {
  // Stringify config for a stable dependency (skeleton: config is small + static).
  const configKey = JSON.stringify(config ?? {});
  const converter = useMemo(() => createConverter(config), [configKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const [status, setStatus] = useState<ConvertStatus>('idle');
  const [progress, setProgress] = useState<LoadProgress | null>(null);
  const [result, setResult] = useState<ConvertResult | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const convert = useCallback(
    async (input: ConvertInput, opts: ConvertOptions): Promise<ConvertResult> => {
      setError(null);
      setStatus('converting');
      try {
        const r = await converter.convert(input, { ...opts, onProgress: setProgress });
        setResult(r);
        setStatus('done');
        return r;
      } catch (e) {
        setError(e as Error);
        setStatus('error');
        throw e;
      }
    },
    [converter],
  );

  const matrix = useMemo<RouteInfo[]>(() => converter.getMatrix(), [converter]);
  const needsHeavyEngine = useCallback(
    (from: Format, to: Format) => matrix.some((r) => r.from === from && r.to === to && r.heavy),
    [matrix],
  );
  const reset = useCallback(() => {
    setStatus('idle');
    setProgress(null);
    setResult(null);
    setError(null);
  }, []);

  return {
    convert,
    detectFormat: converter.detectFormat,
    status,
    progress,
    result,
    error,
    matrix,
    needsHeavyEngine,
    reset,
  };
}
