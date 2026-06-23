# notation-converter — Walking Skeleton (Plan 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a deployed GitHub Pages demo where a user uploads a MusicXML file, converts it to Guitar Pro (`.gp`), and downloads it — proving the full `monorepo → core → react → demo → CI/CD` toolchain end-to-end.

**Architecture:** A 3-layer pnpm monorepo. `notation-converter` (headless core) exposes `createConverter()` with a route registry; the first registered route `musicxml→gp` runs headless via AlphaTab's `ScoreLoader` + `Gp7Exporter`. `notation-converter-react` wraps the core in a `useNotationConverter()` hook. `apps/demo` (Vite+React) uses the hook for upload→convert→download. GitHub Actions runs CI (typecheck/test/build) and deploys the demo to Pages.

**Tech Stack:** TypeScript (strict), pnpm workspaces, tsup (lib build), Vite (demo), Vitest (tests), React 18, `@coderline/alphatab` (AlphaTab), GitHub Actions.

## Plan series (context)

This is **Plan 1 of a phased series** (walking skeleton). Later plans (written when reached):
- **Plan 2 — core light routes:** `MusicXML→MIDI`, `GP→MIDI`, `GP→GP` via AlphaTab.
- **Plan 3 — core heavy routes:** Pyodide loader + Cache API + drum-map + GP kit-swap → `MIDI→MusicXML`, `MIDI→GP`.
- **Plan 4 — React UI:** `<NotationConverter/>` component + dual-pane before/after AlphaTab preview + view toggle.
- **Plan 5 — release:** npm publish via Changesets; ESLint hardening; demo polish.

This plan covers spec §2 (architecture skeleton), §3 (the `musicxml→gp` cell + matrix machinery), §5 (core API surface), §6 (hook only), §7.1 (core flow, no preview yet), §8 (tooling baseline), §9 (CI + Pages CD; npm deferred to Plan 5), §10 (core + hook tests), §12 (MPL-2.0).

## Global Constraints

- **License:** MPL-2.0 (file headers not required; root `LICENSE` file).
- **Hosting:** $0, fully client-side. No backend. No server-side conversion.
- **Package names:** core = `notation-converter`; React = `notation-converter-react` (unscoped, core-first). Core has **zero React/DOM dependencies**.
- **Language:** TypeScript `strict: true`.
- **Package manager:** pnpm (workspaces). Node 20 LTS.
- **AlphaTab:** `@coderline/alphatab` (spike validated `1.8.3`; pin `^1.8.3`).
- **Formats (this plan):** input `musicxml` (`.musicxml`/`.xml`), output `gp` (`.gp`).
- **Commits:** Conventional Commits. Never `--no-verify`. Commit after each task's tests pass.

## Manual prerequisites (the human does these; not agent-automatable)

These are needed only for the **deploy** to go live (Tasks 9). Code/tests (Tasks 1–8) need none of them.
1. Create the GitHub repo: `gh repo create notation-converter --public --source . --remote origin` (or via the web UI), then push the working branch.
2. Repo **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. (Plan 5, not now) add `NPM_TOKEN` secret for npm publish.

---

## File structure (created by this plan)

```
notation-converter/
├── package.json                     # root: workspace + scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── .gitignore                       # incl. vectors/, node_modules, dist
├── .npmrc
├── LICENSE                          # MPL-2.0
├── README.md
├── TODO.md                          # future spikes (MuseScore, VexFlow)
├── .github/workflows/
│   ├── ci.yml
│   └── deploy-pages.yml
├── packages/
│   ├── core/                        # → notation-converter
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── tsup.config.ts
│   │   ├── vitest.config.ts
│   │   ├── src/
│   │   │   ├── index.ts             # public exports
│   │   │   ├── types.ts             # Format, Convert*, RouteInfo, ...
│   │   │   ├── io.ts                # readInput() normalizer
│   │   │   ├── detect.ts            # detectFormat()
│   │   │   ├── matrix.ts            # ROUTES (full v1 + deferred)
│   │   │   ├── converter.ts         # createConverter(): registry + convert()
│   │   │   └── engines/
│   │   │       └── alphatab.ts      # musicxmlToGp()
│   │   └── test/
│   │       ├── fixtures/twinkle.musicxml
│   │       ├── detect.test.ts
│   │       ├── converter.test.ts
│   │       └── musicxml-to-gp.test.ts
│   └── react/                       # → notation-converter-react
│       ├── package.json
│       ├── tsconfig.json
│       ├── tsup.config.ts
│       ├── vitest.config.ts
│       ├── src/
│       │   ├── index.ts
│       │   └── useNotationConverter.ts
│       └── test/useNotationConverter.test.tsx
└── apps/
    └── demo/
        ├── package.json
        ├── index.html
        ├── vite.config.ts
        ├── tsconfig.json
        └── src/
            ├── main.tsx
            └── App.tsx
```

---

## Task 1: Monorepo scaffold + tooling baseline

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.gitignore`, `.npmrc`, `LICENSE`, `README.md`, `TODO.md`

**Interfaces:**
- Produces: workspace globs `packages/*` + `apps/*`; root scripts `build`/`test`/`typecheck`/`dev`; shared `tsconfig.base.json` (strict).

- [ ] **Step 1: Create `pnpm-workspace.yaml`**

```yaml
packages:
  - 'packages/*'
  - 'apps/*'
```

- [ ] **Step 2: Create root `package.json`**

```json
{
  "name": "notation-converter-monorepo",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "engines": { "node": ">=20" },
  "scripts": {
    "build": "pnpm -r --filter \"./packages/*\" run build",
    "test": "pnpm -r run test",
    "typecheck": "pnpm -r run typecheck",
    "dev": "pnpm --filter demo run dev"
  },
  "devDependencies": {
    "typescript": "^5.5.0"
  },
  "packageManager": "pnpm@9.7.0"
}
```

- [ ] **Step 3: Create `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

- [ ] **Step 4: Create `.gitignore`**

```gitignore
node_modules/
dist/
*.tsbuildinfo
.DS_Store
# stray vector-DB artifact present in repo root
vectors/
# build-time engine assets (Plan 3+)
apps/demo/public/engines/
```

- [ ] **Step 5: Create `.npmrc`**

```ini
auto-install-peers=true
```

- [ ] **Step 6: Create `LICENSE` (MPL-2.0)**

Run: `npx --yes spdx-license-list-full >/dev/null 2>&1 || true` then write the full MPL-2.0 text. Concretely, fetch and save it:

```bash
curl -fsSL https://www.mozilla.org/media/MPL/2.0/index.815ca599c9df.txt -o LICENSE
```
Expected: `LICENSE` exists and begins with `Mozilla Public License Version 2.0`. (If offline, paste the MPL-2.0 text manually — it is a fixed, well-known document.)

- [ ] **Step 7: Create `README.md`**

```markdown
# notation-converter

A $0, fully in-browser music-notation converter — convert between MIDI, MusicXML,
and Guitar Pro. Shipped as a headless library (`notation-converter`) + React
bindings (`notation-converter-react`), with a demo on GitHub Pages.

- Design spec: `docs/superpowers/specs/2026-06-23-notation-converter-design.md`
- Future work: `TODO.md`

## License

[MPL-2.0](./LICENSE).
```

- [ ] **Step 8: Create `TODO.md` (captures the tracked future spikes)**

```markdown
# TODO / future spikes

- [ ] **GP→MusicXML (v2):** no direct path today. Spike **MuseScore** as a Guitar Pro
  importer / GP→MusicXML path and measure conversion loss vs the GP→MIDI→music21 chain.
  MuseScore imports GP and exports MusicXML (likely higher fidelity), but is GPL C++/Qt —
  assess $0 in-browser (WASM) feasibility vs offline-CI use.
- [ ] **MIDI preview:** AlphaTab can't render MIDI. Render the dual-pane MIDI panes as
  notation via `@tonejs/midi` (or Tone.js) → VexFlow (post-v1).
- [ ] **v1.2 audio:** AlphaTab player + lazy soundfont → WAV (Web Audio) + MP3 (WASM encoder).
- [ ] **Upstream:** music21 issue #1659 (preserve `percMapPitch`) + propose a drum-layout map.
```

- [ ] **Step 9: Verify install + clean tree**

Run: `pnpm install`
Expected: completes without error; creates `pnpm-lock.yaml`.

Run: `git status --short`
Expected: `vectors/` does NOT appear (ignored); only the new files show as untracked.

- [ ] **Step 10: Commit**

```bash
git add package.json pnpm-workspace.yaml tsconfig.base.json .gitignore .npmrc LICENSE README.md TODO.md pnpm-lock.yaml
git commit -m "chore: scaffold pnpm monorepo + tooling baseline (MPL-2.0)"
```

---

## Task 2: Core package — types + matrix

**Files:**
- Create: `packages/core/package.json`, `packages/core/tsconfig.json`, `packages/core/tsup.config.ts`, `packages/core/vitest.config.ts`, `packages/core/src/types.ts`, `packages/core/src/matrix.ts`
- Test: `packages/core/test/matrix.test.ts`

**Interfaces:**
- Produces: `Format`, `ConvertInput`, `ConvertOptions`, `ConvertResult`, `RouteInfo`, `LoadProgress`, `ConverterConfig` (types.ts); `ROUTES: RouteInfo[]` (matrix.ts).

- [ ] **Step 1: Create `packages/core/package.json`**

```json
{
  "name": "notation-converter",
  "version": "0.0.0",
  "description": "Headless, in-browser music-notation converter (MIDI / MusicXML / Guitar Pro).",
  "license": "MPL-2.0",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js", "require": "./dist/index.cjs" }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsup",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@coderline/alphatab": "^1.8.3"
  },
  "devDependencies": {
    "tsup": "^8.2.0",
    "vitest": "^2.0.0",
    "typescript": "^5.5.0"
  }
}
```

- [ ] **Step 2: Create `packages/core/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "." },
  "include": ["src", "test"]
}
```

- [ ] **Step 3: Create `packages/core/tsup.config.ts`**

```ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
});
```

- [ ] **Step 4: Create `packages/core/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { environment: 'node', include: ['test/**/*.test.ts'] },
});
```

- [ ] **Step 5: Create `packages/core/src/types.ts`**

```ts
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
  data: Uint8Array;
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
```

- [ ] **Step 6: Create `packages/core/src/matrix.ts`**

```ts
import type { Format, RouteInfo } from './types';

// Full v1 design matrix. `supported: false` = deferred to v2.
export const ROUTES: RouteInfo[] = [
  { from: 'midi',     to: 'musicxml', engine: 'pyodide',  heavy: true,  lossy: false, supported: true  },
  { from: 'midi',     to: 'gp',       engine: 'pyodide',  heavy: true,  lossy: false, supported: true  },
  { from: 'musicxml', to: 'gp',       engine: 'alphatab', heavy: false, lossy: false, supported: true  },
  { from: 'musicxml', to: 'midi',     engine: 'alphatab', heavy: false, lossy: false, supported: true  },
  { from: 'gp',       to: 'midi',     engine: 'alphatab', heavy: false, lossy: false, supported: true  },
  { from: 'gp',       to: 'gp',       engine: 'alphatab', heavy: false, lossy: false, supported: true  },
  { from: 'gp',       to: 'musicxml', engine: 'pyodide',  heavy: true,  lossy: true,  supported: false }, // v2
];

export function routeKey(from: Format, to: Format): string {
  return `${from}>${to}`;
}
```

- [ ] **Step 7: Write the failing test `packages/core/test/matrix.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { ROUTES, routeKey } from '../src/matrix';

describe('matrix', () => {
  it('marks musicxml->gp as a supported, light route', () => {
    const r = ROUTES.find((x) => x.from === 'musicxml' && x.to === 'gp');
    expect(r).toBeDefined();
    expect(r?.supported).toBe(true);
    expect(r?.heavy).toBe(false);
    expect(r?.engine).toBe('alphatab');
  });

  it('marks gp->musicxml as deferred (not supported in v1)', () => {
    const r = ROUTES.find((x) => x.from === 'gp' && x.to === 'musicxml');
    expect(r?.supported).toBe(false);
  });

  it('builds a route key', () => {
    expect(routeKey('musicxml', 'gp')).toBe('musicxml>gp');
  });
});
```

- [ ] **Step 8: Run test to verify it fails**

Run: `pnpm --filter notation-converter test`
Expected: FAIL — cannot find `../src/matrix` (not created yet)? It IS created in Step 6, so this should PASS once deps are installed. If it FAILS on missing deps, run `pnpm install` first, then re-run; expected PASS.

- [ ] **Step 9: Run test to verify it passes**

Run: `pnpm install && pnpm --filter notation-converter test`
Expected: PASS (3 tests).

- [ ] **Step 10: Commit**

```bash
git add packages/core
git commit -m "feat(core): add types + conversion matrix"
```

---

## Task 3: Core — input normalizer + format detection

**Files:**
- Create: `packages/core/src/io.ts`, `packages/core/src/detect.ts`
- Test: `packages/core/test/detect.test.ts`

**Interfaces:**
- Consumes: `Format` (types.ts).
- Produces: `readInput(input: ConvertInput): Promise<{ bytes: Uint8Array; filename?: string }>` (io.ts); `detectFormat(input: ConvertInput): Promise<Format | null>` (detect.ts).

- [ ] **Step 1: Create `packages/core/src/io.ts`**

```ts
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
```

- [ ] **Step 2: Write the failing test `packages/core/test/detect.test.ts`**

```ts
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
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter notation-converter test detect`
Expected: FAIL — `../src/detect` does not exist.

- [ ] **Step 4: Create `packages/core/src/detect.ts`**

```ts
import type { ConvertInput, Format } from './types';
import { readInput } from './io';

export async function detectFormat(input: ConvertInput): Promise<Format | null> {
  const { bytes, filename } = await readInput(input);
  const ext = filename?.toLowerCase().split('.').pop();

  if (ext === 'mid' || ext === 'midi') return 'midi';
  if (ext === 'musicxml' || ext === 'xml' || ext === 'mxl') return 'musicxml';
  if (ext === 'gp' || ext === 'gpx' || /^gp[3-5]$/.test(ext ?? '')) return 'gp';

  // magic-byte fallback
  if (bytes.length >= 4 && bytes[0] === 0x4d && bytes[1] === 0x54 && bytes[2] === 0x68 && bytes[3] === 0x44) {
    return 'midi'; // "MThd"
  }
  const head = new TextDecoder().decode(bytes.slice(0, 512));
  if (head.includes('<score-partwise') || head.includes('<score-timewise')) return 'musicxml';

  return null;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter notation-converter test detect`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/io.ts packages/core/src/detect.ts packages/core/test/detect.test.ts
git commit -m "feat(core): add input normalizer + format detection"
```

---

## Task 4: Core — AlphaTab engine (MusicXML → GP, headless)

**Files:**
- Create: `packages/core/src/engines/alphatab.ts`, `packages/core/test/fixtures/twinkle.musicxml`
- Test: `packages/core/test/musicxml-to-gp.test.ts`

**Interfaces:**
- Produces: `musicxmlToGp(bytes: Uint8Array): Uint8Array` (engines/alphatab.ts).

> **Note for implementer:** the spike validated `@coderline/alphatab@1.8.3` headless in Node via `ScoreLoader.loadScoreFromBytes` + `Gp7Exporter().export`. If the installed types differ, run `node -e "const a=require('@coderline/alphatab'); console.log(Object.keys(a.importer), Object.keys(a.exporter))"` to confirm the exported namespaces, and adjust the import accordingly. The test below is the source of truth.

- [ ] **Step 1: Create the fixture `packages/core/test/fixtures/twinkle.musicxml`**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="4.0">
  <part-list>
    <score-part id="P1"><part-name>Music</part-name></score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <key><fifths>0</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>G</sign><line>2</line></clef>
      </attributes>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>G</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>G</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
    </measure>
  </part>
</score-partwise>
```

- [ ] **Step 2: Write the failing test `packages/core/test/musicxml-to-gp.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as alphaTab from '@coderline/alphatab';
import { musicxmlToGp } from '../src/engines/alphatab';

const here = dirname(fileURLToPath(import.meta.url));
const xml = new Uint8Array(readFileSync(join(here, 'fixtures/twinkle.musicxml')));

describe('musicxmlToGp', () => {
  it('produces non-empty Guitar Pro bytes', () => {
    const gp = musicxmlToGp(xml);
    expect(gp).toBeInstanceOf(Uint8Array);
    expect(gp.length).toBeGreaterThan(0);
  });

  it('round-trips: exported GP re-imports to a score with notes', () => {
    const gp = musicxmlToGp(xml);
    const score = alphaTab.importer.ScoreLoader.loadScoreFromBytes(gp);
    expect(score.tracks.length).toBeGreaterThan(0);
    // 4 quarter notes in one 4/4 measure
    const beats = score.tracks[0].staves[0].bars[0].voices[0].beats.length;
    expect(beats).toBe(4);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter notation-converter test musicxml-to-gp`
Expected: FAIL — `../src/engines/alphatab` does not exist.

- [ ] **Step 4: Create `packages/core/src/engines/alphatab.ts`**

```ts
import * as alphaTab from '@coderline/alphatab';

/** Convert MusicXML bytes to Guitar Pro 7 (.gp) bytes, headless. */
export function musicxmlToGp(bytes: Uint8Array): Uint8Array {
  const score = alphaTab.importer.ScoreLoader.loadScoreFromBytes(bytes);
  const exporter = new alphaTab.exporter.Gp7Exporter();
  return exporter.export(score, new alphaTab.Settings());
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter notation-converter test musicxml-to-gp`
Expected: PASS (2 tests). If AlphaTab errors on `new alphaTab.Settings()` arity, try `exporter.export(score)`; re-run.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/engines packages/core/test/fixtures packages/core/test/musicxml-to-gp.test.ts
git commit -m "feat(core): MusicXML->GP conversion via AlphaTab (headless)"
```

---

## Task 5: Core — createConverter + public exports

**Files:**
- Create: `packages/core/src/converter.ts`, `packages/core/src/index.ts`
- Test: `packages/core/test/converter.test.ts`

**Interfaces:**
- Consumes: `readInput` (io.ts), `detectFormat` (detect.ts), `ROUTES`/`routeKey` (matrix.ts), `musicxmlToGp` (engines/alphatab.ts), all types.
- Produces: `createConverter(config?: ConverterConfig): Converter`; `index.ts` re-exports `createConverter` + all public types.

- [ ] **Step 1: Write the failing test `packages/core/test/converter.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createConverter } from '../src/converter';

const here = dirname(fileURLToPath(import.meta.url));
const xml = new Uint8Array(readFileSync(join(here, 'fixtures/twinkle.musicxml')));

describe('createConverter', () => {
  it('canConvert reflects implemented routes', () => {
    const c = createConverter();
    expect(c.canConvert('musicxml', 'gp')).toBe(true);
    expect(c.canConvert('gp', 'midi')).toBe(false); // not implemented in skeleton
  });

  it('getMatrix flags musicxml->gp as implemented', () => {
    const c = createConverter();
    const r = c.getMatrix().find((x) => x.from === 'musicxml' && x.to === 'gp');
    expect(r?.implemented).toBe(true);
    const other = c.getMatrix().find((x) => x.from === 'gp' && x.to === 'midi');
    expect(other?.implemented).toBe(false);
  });

  it('converts musicxml -> gp with a sensible result', async () => {
    const c = createConverter();
    const file = new File([xml], 'twinkle.musicxml');
    const res = await c.convert(file, { to: 'gp' });
    expect(res.format).toBe('gp');
    expect(res.filename).toBe('twinkle.gp');
    expect(res.data.length).toBeGreaterThan(0);
    expect(res.mimeType).toContain('gp');
  });

  it('throws on an unimplemented route', async () => {
    const c = createConverter();
    await expect(c.convert(xml, { from: 'gp', to: 'midi' })).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter notation-converter test converter`
Expected: FAIL — `../src/converter` does not exist.

- [ ] **Step 3: Create `packages/core/src/converter.ts`**

```ts
import type {
  Converter, ConvertInput, ConvertOptions, ConvertResult, ConverterConfig, Format, LoadProgress,
} from './types';
import { readInput } from './io';
import { detectFormat } from './detect';
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
      const from = opts.from ?? (await detectFormat(input));
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
```

- [ ] **Step 4: Create `packages/core/src/index.ts`**

```ts
export { createConverter } from './converter';
export { detectFormat } from './detect';
export { ROUTES, routeKey } from './matrix';
export type {
  Format, ConvertInput, ConvertOptions, ConvertResult, RouteInfo,
  LoadProgress, ConverterConfig, ConvertStatus, Converter,
} from './types';
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter notation-converter test`
Expected: PASS (all core tests).

- [ ] **Step 6: Verify the package builds + typechecks**

Run: `pnpm --filter notation-converter run build && pnpm --filter notation-converter run typecheck`
Expected: `dist/index.js`, `dist/index.cjs`, `dist/index.d.ts` created; typecheck clean.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/converter.ts packages/core/src/index.ts packages/core/test/converter.test.ts
git commit -m "feat(core): createConverter with route registry + public API"
```

---

## Task 6: React package — useNotationConverter hook

**Files:**
- Create: `packages/react/package.json`, `packages/react/tsconfig.json`, `packages/react/tsup.config.ts`, `packages/react/vitest.config.ts`, `packages/react/src/useNotationConverter.ts`, `packages/react/src/index.ts`
- Test: `packages/react/test/useNotationConverter.test.tsx`

**Interfaces:**
- Consumes: `createConverter`, `Converter`, `ConvertInput`, `ConvertOptions`, `ConvertResult`, `LoadProgress`, `RouteInfo`, `ConvertStatus`, `ConverterConfig`, `Format` from `notation-converter`.
- Produces: `useNotationConverter(config?: ConverterConfig)` returning `{ convert, detectFormat, status, progress, result, error, matrix, needsHeavyEngine, reset }`.

- [ ] **Step 1: Create `packages/react/package.json`**

```json
{
  "name": "notation-converter-react",
  "version": "0.0.0",
  "description": "React bindings for notation-converter.",
  "license": "MPL-2.0",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js", "require": "./dist/index.cjs" }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsup",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "notation-converter": "workspace:*"
  },
  "peerDependencies": {
    "react": ">=18"
  },
  "devDependencies": {
    "@testing-library/react": "^16.0.0",
    "@types/react": "^18.3.0",
    "jsdom": "^24.1.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "tsup": "^8.2.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: Create `packages/react/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist", "rootDir": ".", "jsx": "react-jsx" },
  "include": ["src", "test"]
}
```

- [ ] **Step 3: Create `packages/react/tsup.config.ts`**

```ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  external: ['react'],
});
```

- [ ] **Step 4: Create `packages/react/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { environment: 'jsdom', include: ['test/**/*.test.{ts,tsx}'] },
});
```

- [ ] **Step 5: Write the failing test `packages/react/test/useNotationConverter.test.tsx`**

```tsx
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
```

- [ ] **Step 6: Run test to verify it fails**

Run: `pnpm --filter notation-converter-react test`
Expected: FAIL — `../src/useNotationConverter` does not exist.

- [ ] **Step 7: Create `packages/react/src/useNotationConverter.ts`**

```ts
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
      setResult(null);
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
```

- [ ] **Step 8: Create `packages/react/src/index.ts`**

```ts
export { useNotationConverter } from './useNotationConverter';
export type {
  Format, ConvertInput, ConvertOptions, ConvertResult, RouteInfo,
  LoadProgress, ConverterConfig, ConvertStatus,
} from 'notation-converter';
```

- [ ] **Step 9: Run test to verify it passes**

Run: `pnpm install && pnpm --filter notation-converter-react test`
Expected: PASS (3 tests).

- [ ] **Step 10: Verify build + typecheck**

Run: `pnpm --filter notation-converter run build && pnpm --filter notation-converter-react run build && pnpm --filter notation-converter-react run typecheck`
Expected: react `dist` built; typecheck clean. (Core must be built first so its `dist` types resolve.)

- [ ] **Step 11: Commit**

```bash
git add packages/react
git commit -m "feat(react): useNotationConverter hook"
```

---

## Task 7: Demo app — upload → convert → download

**Files:**
- Create: `apps/demo/package.json`, `apps/demo/index.html`, `apps/demo/vite.config.ts`, `apps/demo/tsconfig.json`, `apps/demo/src/main.tsx`, `apps/demo/src/App.tsx`

**Interfaces:**
- Consumes: `useNotationConverter` from `notation-converter-react`.
- Produces: a buildable static site (`apps/demo/dist`) with the demo UI.

- [ ] **Step 1: Create `apps/demo/package.json`**

```json
{
  "name": "demo",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "test": "echo \"no demo tests yet\" && exit 0"
  },
  "dependencies": {
    "notation-converter-react": "workspace:*",
    "react": "^18.3.0",
    "react-dom": "^18.3.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "typescript": "^5.5.0",
    "vite": "^5.4.0"
  }
}
```

- [ ] **Step 2: Create `apps/demo/vite.config.ts`**

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base must match the GitHub Pages repo path: https://<user>.github.io/notation-converter/
export default defineConfig({
  base: '/notation-converter/',
  plugins: [react()],
});
```

- [ ] **Step 3: Create `apps/demo/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "jsx": "react-jsx", "noEmit": true },
  "include": ["src"]
}
```

- [ ] **Step 4: Create `apps/demo/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>notation-converter — demo</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Create `apps/demo/src/main.tsx`**

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 6: Create `apps/demo/src/App.tsx`**

```tsx
import { useState } from 'react';
import { useNotationConverter } from 'notation-converter-react';

export function App() {
  const { convert, status, result, error } = useNotationConverter();
  const [file, setFile] = useState<File | null>(null);

  const onConvert = async () => {
    if (file) await convert(file, { to: 'gp' });
  };

  const onDownload = () => {
    if (!result) return;
    const url = URL.createObjectURL(new Blob([result.data], { type: result.mimeType }));
    const a = document.createElement('a');
    a.href = url;
    a.download = result.filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main style={{ fontFamily: 'system-ui', maxWidth: 640, margin: '3rem auto', padding: '0 1rem' }}>
      <h1>notation-converter</h1>
      <p>Convert MusicXML → Guitar Pro, fully in your browser.</p>

      <input
        type="file"
        accept=".musicxml,.xml"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />
      <button onClick={onConvert} disabled={!file || status === 'converting'} style={{ marginLeft: 8 }}>
        {status === 'converting' ? 'Converting…' : 'Convert to .gp'}
      </button>

      {error && <p style={{ color: 'crimson' }}>Error: {error.message}</p>}

      {result && (
        <p>
          ✅ Converted <strong>{result.filename}</strong> ({result.data.length} bytes){' '}
          <button onClick={onDownload}>Download</button>
        </p>
      )}
    </main>
  );
}
```

- [ ] **Step 7: Verify the demo builds + typechecks**

Run: `pnpm --filter notation-converter run build && pnpm --filter notation-converter-react run build && pnpm --filter demo run typecheck && pnpm --filter demo run build`
Expected: `apps/demo/dist/index.html` produced with asset paths under `/notation-converter/`.

- [ ] **Step 8: Manual smoke (optional but recommended)**

Run: `pnpm --filter demo run dev`
Open the printed URL, upload `packages/core/test/fixtures/twinkle.musicxml`, click Convert, click Download.
Expected: a `twinkle.gp` downloads and opens in Guitar Pro / AlphaTab.

- [ ] **Step 9: Commit**

```bash
git add apps/demo
git commit -m "feat(demo): MusicXML->GP upload/convert/download UI"
```

---

## Task 8: CI workflow (typecheck + test + build)

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: root scripts `typecheck`, `test`, `build`.

- [ ] **Step 1: Create `.github/workflows/ci.yml`**

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm -r run build
      - run: pnpm -r run typecheck
      - run: pnpm -r run test
```

- [ ] **Step 2: Verify the CI steps pass locally (same commands)**

Run: `pnpm install --frozen-lockfile && pnpm -r run build && pnpm -r run typecheck && pnpm -r run test`
Expected: all green. (If `--frozen-lockfile` fails, run `pnpm install` once to refresh `pnpm-lock.yaml`, commit it, then retry.)

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml pnpm-lock.yaml
git commit -m "ci: typecheck + test + build on push/PR"
```

---

## Task 9: Deploy workflow (demo → GitHub Pages)

**Files:**
- Create: `.github/workflows/deploy-pages.yml`

**Interfaces:**
- Consumes: `apps/demo` build output (`apps/demo/dist`).

- [ ] **Step 1: Create `.github/workflows/deploy-pages.yml`**

```yaml
name: Deploy demo to Pages
on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm -r --filter "./packages/*" run build
      - run: pnpm --filter demo run build
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: apps/demo/dist
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Verify the build the workflow runs succeeds locally**

Run: `pnpm -r --filter "./packages/*" run build && pnpm --filter demo run build`
Expected: `apps/demo/dist` exists with `index.html`.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/deploy-pages.yml
git commit -m "ci: deploy demo to GitHub Pages on push to main"
```

- [ ] **Step 4: Go live (human, after the manual prerequisites)**

Push the branch and open a PR into `main` (or merge). On merge to `main`, the workflow deploys.
Expected: the Actions run succeeds and the demo is live at `https://<user>.github.io/notation-converter/`.

---

## Self-Review

**1. Spec coverage (this plan = walking skeleton):**
- §2 architecture skeleton ✓ (Tasks 1, 2, 6, 7). §3 matrix + `musicxml→gp` cell ✓ (Tasks 2, 4, 5). §5 core API surface ✓ (Task 5; `preloadEngine('pyodide')` intentionally throws until Plan 3). §6 hook ✓ (Task 6; `<NotationConverter/>` component deferred to Plan 4). §7.1 core flow ✓ (Task 7; dual-pane preview deferred to Plan 4). §8 tooling ✓ (ESLint deferred to Plan 5; typecheck/test/build present). §9 CI + Pages ✓ (Tasks 8, 9; npm publish deferred to Plan 5). §10 tests ✓ (core + hook). §12 MPL-2.0 ✓ (Task 1).
- Intentionally deferred to later plans (not gaps): light routes (Plan 2), Pyodide + drums (Plan 3), `<NotationConverter/>` + preview (Plan 4), npm publish + ESLint (Plan 5).

**2. Placeholder scan:** No TBD/TODO-as-code. The only "not implemented" is `preloadEngine('pyodide')`, which deliberately throws a clear error and is covered by a test asserting unimplemented routes reject.

**3. Type consistency:** `createConverter`/`Converter`/`ConvertOptions`/`ConvertResult`/`RouteInfo`/`ConvertStatus` are defined in Task 2 (types.ts) and consumed unchanged in Tasks 5 (converter), 6 (hook), 7 (demo). `routeKey()` defined in Task 2, used in Task 5. `readInput()` defined in Task 3, used in Tasks 3 + 5. `musicxmlToGp()` defined in Task 4, used in Task 5. Hook return shape matches the test in Task 6.

**Known risk flagged inline:** AlphaTab's exact export signature (Task 4) — the test is the source of truth; a fallback (`exporter.export(score)`) is noted if `Settings` arity differs.
