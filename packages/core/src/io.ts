import type { ConvertInput } from './types';

export async function readInput(
  input: ConvertInput,
): Promise<{ bytes: Uint8Array; filename?: string }> {
  if (input instanceof Uint8Array) return { bytes: input };
  if (input instanceof ArrayBuffer) return { bytes: new Uint8Array(input) };
  // File / Blob
  const buf = await input.arrayBuffer();
  const filename = 'name' in input ? (input as File).name : undefined;
  return { bytes: new Uint8Array(buf), filename };
}
