import * as alphaTab from '@coderline/alphatab';
import { unzipSync, zipSync } from 'fflate';
import { GP_BOILERPLATE_BASE64 } from './gp-boilerplate';

// AlphaTab's model graph is operated on structurally; the exported types are
// deep, so we use `any` for the score/track/note nodes here.

function eachNote(track: any, fn: (note: any) => void): void {
  for (const staff of track.staves)
    for (const bar of staff.bars)
      for (const voice of bar.voices)
        for (const beat of voice.beats)
          for (const note of beat.notes ?? []) fn(note);
}

let cachedKit: any[] | null = null;

/**
 * AlphaTab's standard ~95-entry GP7 percussion kit. Obtained at runtime via an
 * in-process round-trip: exporting a percussion track whose custom articulation
 * list is emptied, then re-importing, repopulates AlphaTab's full standard kit.
 * Cached because the kit is static across scores.
 */
function standardPercussionKit(score: any): any[] {
  if (cachedKit && cachedKit.length) return cachedKit;
  const clone = alphaTab.importer.ScoreLoader.loadScoreFromBytes(
    new alphaTab.exporter.Gp7Exporter().export(score),
  );
  let hasPercussion = false;
  for (const t of clone.tracks)
    if ((t.percussionArticulations ?? []).length) {
      t.percussionArticulations = [];
      hasPercussion = true;
    }
  if (!hasPercussion) return [];
  const reimported = alphaTab.importer.ScoreLoader.loadScoreFromBytes(
    new alphaTab.exporter.Gp7Exporter().export(clone),
  );
  for (const t of reimported.tracks) {
    const kit = t.percussionArticulations ?? [];
    if (kit.length >= 90) {
      cachedKit = kit;
      return kit;
    }
  }
  return [];
}

/**
 * Swap a drum track to the standard GP7 kit and remap each note to the kit slot
 * whose `id` equals the source articulation's drum number. Without this, AlphaTab
 * exports "bare" articulations (noteHead=-1) that show no noteheads, are misread
 * as pitched (Soundslice plays piano), and crash Guitar Pro.
 *
 * Note: `percussionArticulation` is an INDEX into the kit, not the drum number —
 * mapping by id avoids picking wrong variants (e.g. kit[42] is "Agogo Low").
 */
function applyDrumKitSwap(track: any, kit: any[]): number {
  const source = (track.percussionArticulations ?? []).slice();
  if (!source.length || !kit.length) return 0;
  const idToIndex = new Map<number, number>();
  kit.forEach((a, i) => {
    if (!idToIndex.has(a.id)) idToIndex.set(a.id, i);
  });
  let remapped = 0;
  eachNote(track, (note) => {
    const src = source[note.percussionArticulation];
    const index = src ? idToIndex.get(src.id) : undefined;
    if (index !== undefined) {
      note.percussionArticulation = index;
      remapped++;
    }
  });
  track.percussionArticulations = kit.slice();
  return remapped;
}

/**
 * Repair invalid tab notes. A note with a string assigned but `fret < 0` is an
 * unplaceable tab note (Guitar Pro's own MusicXML export sometimes writes
 * `<fret>-1</fret>`, which is invalid per the schema). Clearing the string turns
 * it into a valid pitch-based notation note; valid tab notes are untouched.
 */
function sanitizeFrets(track: any): number {
  let fixed = 0;
  eachNote(track, (note) => {
    if (typeof note.fret === 'number' && note.fret < 0 && note.string >= 0) {
      note.string = -1;
      fixed++;
    }
  });
  return fixed;
}

/**
 * Inject the GP archive files AlphaTab's Gp7Exporter omits (ScoreViews,
 * Stylesheets, Preferences.json, meta.json). Guitar Pro the app crashes without
 * them; AlphaTab/Soundslice tolerate their absence.
 */
function injectBoilerplate(gp: Uint8Array): Uint8Array<ArrayBuffer> {
  const files = unzipSync(gp);
  for (const [path, base64] of Object.entries(GP_BOILERPLATE_BASE64)) {
    if (!(path in files)) {
      files[path] = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    }
  }
  return zipSync(files) as Uint8Array<ArrayBuffer>;
}

/**
 * Apply all robustness transforms to an imported score, export to GP7, and inject
 * the boilerplate so the resulting `.gp` opens in Guitar Pro the app.
 */
export function robustExportGp(score: any): Uint8Array<ArrayBuffer> {
  const hasPercussion = score.tracks.some(
    (t: any) => (t.percussionArticulations ?? []).length,
  );
  const kit = hasPercussion ? standardPercussionKit(score) : [];
  for (const track of score.tracks) {
    if ((track.percussionArticulations ?? []).length && kit.length) {
      applyDrumKitSwap(track, kit);
    } else {
      sanitizeFrets(track);
    }
  }
  const gp = new alphaTab.exporter.Gp7Exporter().export(score);
  return injectBoilerplate(gp);
}
