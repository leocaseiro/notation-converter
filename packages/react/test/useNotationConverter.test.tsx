import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// Mock the core so the hook test stays fast + DOM-free of AlphaTab.
const fakeResult = {
  data: new Uint8Array([1, 2, 3]),
  format: 'gp' as const,
  mimeType: 'application/gpx',
  filename: 'song.gp',
  warnings: [] as string[],
};
vi.mock('notation-converter', () => ({
  createConverter: () => ({
    convert: vi.fn().mockResolvedValue(fakeResult),
    detectFormat: vi.fn().mockResolvedValue('musicxml'),
    canConvert: () => true,
    getMatrix: () => [
      { from: 'musicxml', to: 'gp', engine: 'alphatab', heavy: false, lossy: false, supported: true, implemented: true },
      { from: 'midi', to: 'gp', engine: 'pyodide', heavy: true, lossy: false, supported: true, implemented: false },
    ],
    preloadEngine: vi.fn().mockResolvedValue(undefined),
  }),
}));

import { useNotationConverter } from '../src/useNotationConverter';

describe('useNotationConverter', () => {
  beforeEach(() => vi.clearAllMocks());

  it('starts idle', () => {
    const { result } = renderHook(() => useNotationConverter());
    expect(result.current.status).toBe('idle');
    expect(result.current.result).toBeNull();
  });

  it('transitions to done and stores the result', async () => {
    const { result } = renderHook(() => useNotationConverter());
    await act(async () => {
      await result.current.convert(new Uint8Array([0]), { to: 'gp' });
    });
    await waitFor(() => expect(result.current.status).toBe('done'));
    expect(result.current.result?.filename).toBe('song.gp');
  });

  it('needsHeavyEngine reflects the matrix', () => {
    const { result } = renderHook(() => useNotationConverter());
    expect(result.current.needsHeavyEngine('midi', 'gp')).toBe(true);
    expect(result.current.needsHeavyEngine('musicxml', 'gp')).toBe(false);
  });
});
