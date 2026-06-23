# notation-converter — v1 design spec

- **Date:** 2026-06-23
- **Status:** Draft for review
- **Ticket:** [NH-209](https://leocaseiro.atlassian.net/browse/NH-209) (universal in-browser notation converter)
- **Grounding:** NH-205 spike `2026-06-22-music21-midi-to-notation-pipeline.md` + plan `2026-06-22-midi-to-notation-implementation-plan.md`; PR #65; handoff `2026-06-23-nh-209-converter-app-handoff.md`. The end-to-end pipeline is **validated** there.

---

## 1. Overview

A **$0, fully in-browser** music-notation **converter**, shipped as a **reusable React component + headless library**, with a **demo app on GitHub Pages**. No backend — all conversion runs on the visitor's device, so hosting scales for free.

### Goals
- Convert between **MIDI** (`.mid`), **MusicXML** (`.xml`/`.musicxml`), **Guitar Pro** (`.gp`/`.gpx`/`.gp3-5`).
- Ship a **headless engine** (framework-agnostic) and a **React layer** (hook + drop-in component) that other apps can embed.
- Correct **drum** notation (drum-focused product): MIDI numbers survive end-to-end into Guitar Pro.
- A compelling **GitHub Pages demo** with a dual-pane before/after preview.

### Non-goals (v1)
- No backend / no server-side conversion.
- No `GP→MusicXML` (deferred to v2 — no direct path; see §4).
- No audio playback / wav/mp3 export (deferred to v1.2).
- No token/settings editing (deferred to v2).

---

## 2. Architecture

A **3-layer monorepo** (pnpm workspaces):

```
notation-converter/                 (repo)
├── packages/
│   ├── core/      → notation-converter         (headless engine; no React/DOM)
│   └── react/     → notation-converter-react   (hook + <NotationConverter/>)
├── apps/
│   └── demo/      → Vite + React demo → GitHub Pages
└── docs/
```

- **`notation-converter`** — the framework-agnostic engine (the standalone lib). Owns the Pyodide+music21 path, the AlphaTab path, the pitch-keyed **drum-map**, the bundled **GP articulation kit**, format auto-detection, engine loading + caching. Pure async API; **zero React/DOM deps** — usable from React, Vue, vanilla, Node (for tests).
- **`notation-converter-react`** — thin bindings: `useNotationConverter()` hook + a styled-but-overridable `<NotationConverter/>` component (file input, From→To dropdowns, convert, download, dual-pane AlphaTab preview).
- **`apps/demo`** — consumes the React package only; proves embeddability; deployed to GitHub Pages.

**Why this split:** the core is headless-testable (golden-file conversions in Node) and reusable beyond React; the React layer stays thin; the demo proves the library is genuinely embeddable. Matches the handoff's "npm library **and** app, embeddable, plays well with AlphaTab."

---

## 3. Conversion matrix (v1)

Rows = **From**, columns = **To**. 🐍 = needs Pyodide+music21 (~18 MB heavy download). 🪶 = AlphaTab-only (~1 MB, light).

| From ↓ \ To → | **MIDI** | **MusicXML** | **Guitar Pro** |
|---|---|---|---|
| **MIDI** | — (skip) | 🐍 music21 | 🐍 music21→AlphaTab |
| **MusicXML** | 🪶 AlphaTab | — (skip) | 🪶 AlphaTab |
| **Guitar Pro** | 🪶 AlphaTab | 🔴 deferred v2 | 🪶 AlphaTab (version→gp7) |

**v1 routes (6):** `MIDI→MusicXML` 🐍 · `MIDI→GP` 🐍 · `MusicXML→GP` 🪶 · `MusicXML→MIDI` 🪶 · `GP→MIDI` 🪶 · `GP→GP` 🪶.

**Key property:** the heavy Pyodide engine is needed **only when MIDI is the input**. Every other route runs on AlphaTab's importer + MIDI generator + `Gp7Exporter`, so it's light and instant. This drives the lazy-load-by-route loading UX (§7).

**Engine notes:**
- 🟢 spike-validated: `MIDI→MusicXML`, `MIDI→GP` (full chain, drums incl.), `MusicXML→GP`.
- 🟡 to validate during build: `MusicXML→MIDI`, `GP→MIDI` (both via AlphaTab's MIDI generator), `GP→GP` (import gp3-5 → export gp7).
- 🔴 `GP→MusicXML` deferred (v2): only via `GP→MIDI→music21→MusicXML` — needs both engines chained and the MIDI hop discards notation detail (lossy). See future-work MuseScore spike.

---

## 4. Drum handling (from the spike — must carry over)

This is the hard-won part of NH-205; the converter must preserve it:

1. **music21 must emit `<midi-unpitched>` per drum** — give each distinct MIDI pitch its own `UnpitchedPercussion` instrument with `percMapPitch` = the raw note (incl. ride 51, which music21 otherwise loses to issue #1659). Without this, AlphaTab→GP yields note `0`.
2. **Pitch-keyed drum-map layer** — key the staff line + notehead off the **raw MIDI pitch number** (not music21's instrument name), and emit a percussion clef. Table lives in the spike (`PITCH_MAP`); productionize the full GM table.
3. **JS-layer GP kit-swap** — after AlphaTab imports the MusicXML, **swap the drum track to AlphaTab's standard ~95-entry GM articulation kit** and remap each note to the articulation whose **`id` == its MIDI number** (mapping by `outputMidiNumber` picks wrong variants — open-hat→92, ride→93). **Bundle the kit**; do not read a reference `.gp` at runtime.

Validated end-to-end (input notes == GP output) in Guitar Pro **and** AlphaTab with AlphaTab 1.8.3 `Gp7Exporter`.

---

## 5. Core API (`notation-converter`)

```ts
export type Format = 'midi' | 'musicxml' | 'gp';
export type ConvertInput = File | ArrayBuffer | Uint8Array;

export interface LoadProgress {
  phase: 'engine-download' | 'engine-init' | 'converting';
  engine?: 'pyodide' | 'alphatab';
  loaded?: number;   // bytes (downloads)
  total?: number;    // bytes when known
  ratio?: number;    // 0..1 when computable
  message?: string;
}

export interface ConvertOptions {
  to: Format;
  from?: Format;                 // omit → auto-detect (extension + magic bytes)
  signal?: AbortSignal;          // cancellation
  onProgress?: (p: LoadProgress) => void;
}

export interface ConvertResult {
  data: Uint8Array;
  format: Format;
  mimeType: string;              // e.g. 'application/vnd.recordare.musicxml+xml'
  filename: string;              // suggested, e.g. 'song.musicxml'
  warnings: string[];            // quantization notes, dropped detail, etc.
}

export interface RouteInfo {
  from: Format; to: Format;
  engine: 'pyodide' | 'alphatab';
  heavy: boolean;                // true → needs the ~18 MB download
  lossy: boolean;
  supported: boolean;            // false for v1-deferred routes
}

export interface ConverterConfig {
  engineBaseUrl?: string;        // where Pyodide + wheels are served (default: same-origin)
  cache?: boolean;               // cache-first via Cache Storage API (default: true)
}

export function createConverter(config?: ConverterConfig): Converter;

export interface Converter {
  convert(input: ConvertInput, opts: ConvertOptions): Promise<ConvertResult>;
  detectFormat(input: ConvertInput): Promise<Format | null>;
  getMatrix(): RouteInfo[];
  canConvert(from: Format, to: Format): boolean;
  preloadEngine(engine: 'pyodide' | 'alphatab', onProgress?: (p: LoadProgress) => void): Promise<void>;
}
```

- Engine loading is **lazy/automatic** inside `convert()` (Pyodide loads only for 🐍 routes). `preloadEngine()` lets a consumer warm it up behind their own confirm UI.
- The drum-map and GP kit are **internal** to the engine — not part of the public surface.

---

## 6. React API (`notation-converter-react`)

```tsx
export function useNotationConverter(config?: ConverterConfig): {
  convert(input: ConvertInput, opts: ConvertOptions): Promise<ConvertResult>;
  detectFormat(input: ConvertInput): Promise<Format | null>;
  status: 'idle' | 'loading-engine' | 'converting' | 'done' | 'error';
  progress: LoadProgress | null;
  result: ConvertResult | null;
  error: Error | null;
  matrix: RouteInfo[];
  needsHeavyEngine(from: Format, to: Format): boolean;  // drive a confirm dialog
  reset(): void;
};

export interface NotationConverterProps {
  defaultFrom?: Format;
  defaultTo?: Format;
  formats?: Format[];                       // restrict the matrix shown
  view?: 'source' | 'result' | 'both';      // default 'both'
  autoDetect?: boolean;                     // default true
  confirmHeavyLoad?: (info: { sizeMB: number; engine: string }) => Promise<boolean>;
  config?: ConverterConfig;
  onConvert?(result: ConvertResult): void;
  onError?(error: Error): void;
  className?: string;
  unstyled?: boolean;                       // skip default styles
}

export function NotationConverter(props: NotationConverterProps): JSX.Element;
```

---

## 7. UX

### 7.1 Core flow
`load file (or drag-drop) → auto-detect From (override allowed) → pick To → convert → download` (+ live preview).

### 7.2 Preview — dual-pane before/after
- Renders **source | result** side by side via AlphaTab. The `view` prop toggles `source` / `result` / `both` (default `both`).
- AlphaTab renders a **Score** (notation), never MIDI bytes. So:
  - `→ MusicXML/GP`, `GP→GP`: result pane renders the converted score; source pane renders the source (if MusicXML/GP).
  - `→ MIDI` routes: the MIDI **result** pane can't render → **placeholder + download**; source pane renders the source notation.
  - `MIDI → X` routes: the MIDI **source** pane can't render pre-conversion → **placeholder**; result pane renders the converted score.
- **MIDI panes are placeholder + download in v1.** Filling them (render MIDI as notation via `@tonejs/midi`/Tone.js → VexFlow) is post-v1 (see §11).

### 7.3 Loading UX (Pyodide)
- **Skeleton-first:** no WASM on initial load. The app is fully interactive immediately; light 🪶 routes work with no heavy download.
- The ~18 MB heavy load fires **only on 🐍 routes**, behind a **built-in confirm dialog** (size estimate, "one-time, cached after", Wi-Fi/mobile note). Overridable via `confirmHeavyLoad`; the headless hook exposes `needsHeavyEngine` + `preloadEngine` for custom UIs.
- **Delivery:** Pyodide (+ vendored music21 wheels) is **self-hosted same-origin** via a **build-time copy** from the `pyodide` npm package into `dist/engines/` (**not committed to git**). `engineBaseUrl` is configurable so consumers can host elsewhere.
- **Caching:** cache-first via the **Cache Storage API** (no service worker — keeps the library well-behaved inside host apps). The demo may add a service worker later for full offline.
- **Progress** is surfaced via `onProgress` / the hook's `progress`.

---

## 8. Tooling

- **Language:** TypeScript (strict).
- **Monorepo:** pnpm workspaces.
- **Library build:** tsup (ESM + CJS + d.ts) for `core` and `react`.
- **Demo:** Vite + React.
- **Tests:** Vitest.
- **Lint/format:** ESLint + Prettier.
- **Versioning/publish:** Changesets.

---

## 9. CI/CD (GitHub Actions)

- **`ci.yml`** (PR + push): pnpm install → lint → typecheck → test → build all packages + demo. Required for merge.
- **`deploy-pages.yml`** (push to `main`): build the demo (runs the build-time Pyodide copy into `dist/engines/`) → deploy to **GitHub Pages**.
- **`release.yml`** (Changesets): on version PR merge, **publish `notation-converter` + `notation-converter-react` to npm** (with provenance; `NPM_TOKEN` secret).

---

## 10. Testing strategy

- **Core (headless, Node):** golden-file conversions over a small corpus (reuse the spike's `twinkle.mid`, a real multitrack, a drum kit). Assert well-formed MusicXML 4.0; assert **drum MIDI numbers survive** MIDI→MusicXML→AlphaTab→GP (the round-trip that previously dropped to `0`).
- **Engine routing:** unit tests for `getMatrix()` / `canConvert()` / `detectFormat()`.
- **React:** smoke tests (React Testing Library) for the hook states and the component (file in → convert → result/download); AlphaTab render mocked.
- **Quantization:** a known-good quantized MIDI in the corpus; note human-performance MIDI as a quality risk (pre-quantize is future work).

---

## 11. Suggested build order (the plan will refine)

1. **Scaffold + CI** — monorepo, tooling, `ci.yml` (lint/test/build green on an empty skeleton).
2. **Core — light 🪶 routes first** — AlphaTab wrapper: `MusicXML→GP`, `GP→GP`, `GP→MIDI`, `MusicXML→MIDI`. Deployable converter with **no** 18 MB dependency.
3. **Core — heavy 🐍 routes** — Pyodide loader + Cache API + the drum-map + GP kit-swap: `MIDI→MusicXML`, `MIDI→GP`. (Highest-risk; reuse validated spike code.)
4. **React layer** — hook + `<NotationConverter/>` + auto-detect + dual-pane preview + confirm dialog.
5. **Demo + deploy** — `apps/demo`, GitHub Pages deploy, npm publish via Changesets.

---

## 12. License

**MPL-2.0** — matches AlphaTab (MPL-2.0); compatible with music21 (BSD-3). File-level copyleft: embeddable, but conversion improvements stay open.

---

## 13. Future work (tracked)

- **v1.2 — audio:** AlphaTab player (play/pause/cursor) + lazy soundfont → WAV (Web Audio) + MP3 (WASM encoder).
- **v2 — `GP→MusicXML`:** revisit the gap; **spike MuseScore** as a GP importer / GP→MusicXML path and measure loss vs the GP→MIDI→music21 chain (MuseScore is GPL C++/Qt — assess $0 in-browser WASM feasibility vs offline-CI use).
- **v2 — token/settings editing.**
- **MIDI preview:** render MIDI panes as notation via `@tonejs/midi`/Tone.js → VexFlow (AlphaTab can't render MIDI).
- **ABC** notation as a future batch.
- **Upstream:** music21 issue #1659 (preserve `percMapPitch`) + propose the drum-layout map.

---

## 14. Open questions / to-confirm on review

- **Package naming (decided)** — core-first, unscoped: `notation-converter` = standalone engine, `notation-converter-react` = React bindings.
- **Spec location** — currently `docs/superpowers/specs/` (brainstorming-skill default). Move to `docs/specs/` or `docs/plans/` if you prefer.
- **Git strategy** — repo is empty (no commits). Bootstrap on a branch (honoring "never touch master") then PR once a GitHub remote exists, or initial commit on `master`?
- **`vectors/` dir** — stray Lance/tfidf skills-index artifact in the repo root; gitignore (planned) or delete?
