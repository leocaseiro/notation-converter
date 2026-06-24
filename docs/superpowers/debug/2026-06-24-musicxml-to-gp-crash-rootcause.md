# MusicXML → GP: why Guitar Pro crashed (root cause + verified fix)

- **Date:** 2026-06-24
- **Reported by:** user testing the live demo with real files (`notation-hero-resources/_files-mid-gp-xml/`).
- **Status:** root cause found + fix verified in real apps (Guitar Pro + AlphaTab); implementation in progress.

## Symptoms

Converting real MusicXML → `.gp` via the skeleton's naive `ScoreLoader.loadScoreFromBytes → Gp7Exporter().export`:
- **Guitar Pro (desktop app) crashes** on load.
- **AlphaTab**: drum file plays correct sound but shows no noteheads.
- **Soundslice**: loads the GP but shows **piano** noteheads + plays piano (drum identity lost).
- Multi-track guitar file (`Coldplay-Yellow`): also "duplicated" tracks; MuseScore rejects the *source* `.xml` as invalid.

## Three independent root causes

### 1. AlphaTab's `Gp7Exporter` writes an INCOMPLETE `.gp` archive (the crash) ⭐
A `.gp` is a zip. A Guitar-Pro-authored `.gp` contains **10 files** incl. `Content/ScoreViews/*.gpsv`, `Content/Stylesheets/*.gpss`, `Content/Preferences.json`, `meta.json`. AlphaTab's `Gp7Exporter` writes only **5** (VERSION, BinaryStylesheet, PartConfiguration, LayoutConfiguration, score.gpif). AlphaTab can re-read its own minimal archive, **but Guitar Pro the app requires the full set and crashes without it.**

**Proof:** round-tripping a *known-good* GP file through AlphaTab (`import → Gp7Exporter`) shrank it 15,716 → 7,006 bytes, stripped to 5 files, and **crashed Guitar Pro** (user-confirmed). Independent of MusicXML.

**Fix (verified):** after export, inject the missing files into the `.gp` zip. They're **generic templates** (`meta.json` = `{}`, `1.gpsv` = "Full score", stylesheets use `%TITLE%` placeholders) — bundled in `packages/core/src/engines/gp-boilerplate.ts`. **User confirmed `/tmp/1-beat-PATCHED.gp` (our output + injected boilerplate) opens + plays in Guitar Pro.**

### 2. Drum percussion articulations import "bare" (no noteheads / wrong drum)
AlphaTab imports a percussion MusicXML with the correct articulation **`id`** (kick 36 / snare 38 / hat 42) but **empty `elementType` and `noteHeadDefault = -1`** → no notehead glyph (AlphaTab), unrecognized as drums (Soundslice → piano).

**Fix (verified):** swap the drum track to AlphaTab's standard ~95-entry GP7 kit and remap each note's `percussionArticulation` to the **index** in that kit where `kit[i].id === sourceArticulation.id`.
- **Gotcha:** `percussionArticulation` is an **index** into `track.percussionArticulations`, NOT the drum number. Setting it = drum number yields the wrong drum (`kit[42]` = "Agogo Low"). Must map id → index.
- The standard kit is obtained at runtime via an in-process round-trip (export with an emptied percussion kit → re-import → `track.percussionArticulations` is the populated 95-entry kit).
- Result: notes → "Charley"/"Kick Drum"/"Snare" with real noteheads, 0 misses.

### 3. GP-exported MusicXML can contain INVALID negative frets
Guitar Pro's *own* MusicXML export wrote `<fret>-1</fret>` / `<fret>-3</fret>` (816 in `Coldplay-Yellow.xml`) — invalid per the MusicXML schema (`fret` is `xs:nonNegativeInteger`); MuseScore rejects the file outright. AlphaTab tolerates it, and our export propagated 9,612 negative frets → invalid `.gp`.

**Fix (verified):** for any note with `fret < 0` **and** `string >= 0` (an unplaceable tab note), set `string = -1` → it becomes a pitch-based notation note (valid GP, like any standard-notation note). Valid tab notes are untouched. Drove invalid notes to **0**.

## The combined fix (applied in `musicxmlToGp`)
1. Import MusicXML → Score.
2. Per track: if percussion → **drum kit-swap** (#2); else → **fret sanitize** (#3).
3. `Gp7Exporter().export` → `.gp` bytes.
4. **Inject GP boilerplate** (#1) into the zip → GP-openable `.gp`.

## Open follow-ups (not in this fix)
- **Duplication:** GP-exported MusicXML uses `<staves>2</staves>` (notation staff + tab staff, different content) per track → lenient renderers show both. Collapsing the dual staves is a separate, tradeoff-laden step.
- **AlphaTab display:** user reports the fixed drum `.gp` plays but "can't see the tabs/notation" in AlphaTab — a rendering/display question to investigate.
- **Coldplay drums:** that file's drum track was exported as *pitched* in the MusicXML (no percussion articulations), so the kit-swap can't apply — its drums stay pitched.
- The naive skeleton converter assumed clean input; real GP exports are messy. Robustness is now a first-class concern.
