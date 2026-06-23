# TODO / future spikes

- [ ] **GP→MusicXML (v2):** no direct path today. Spike **MuseScore** as a Guitar Pro
  importer / GP→MusicXML path and measure conversion loss vs the GP→MIDI→music21 chain.
  MuseScore imports GP and exports MusicXML (likely higher fidelity), but is GPL C++/Qt —
  assess $0 in-browser (WASM) feasibility vs offline-CI use.
- [ ] **MIDI preview:** AlphaTab can't render MIDI. Render the dual-pane MIDI panes as
  notation via `@tonejs/midi` (or Tone.js) → VexFlow (post-v1).
- [ ] **v1.2 audio:** AlphaTab player + lazy soundfont → WAV (Web Audio) + MP3 (WASM encoder).
- [ ] **Upstream:** music21 issue #1659 (preserve `percMapPitch`) + propose a drum-layout map.
