# notation-converter

A $0, fully in-browser music-notation converter — convert between MIDI, MusicXML,
and Guitar Pro. Shipped as a headless library (`notation-converter`) + React
bindings (`notation-converter-react`), with a demo on GitHub Pages.

- Design spec: `docs/superpowers/specs/2026-06-23-notation-converter-design.md`
- Future work: `TODO.md`

## Known limitations

- **Guitar-Pro-exported MusicXML** writes each track as two identical staves
  (notation + tab). The converted `.gp` opens and plays, but shows those staves
  duplicated. MusicXML from other sources (Finale, Sibelius, MuseScore, music21)
  converts with correct structure; drum files are single-staff and unaffected.
  Details: `docs/superpowers/debug/2026-06-24-musicxml-to-gp-crash-rootcause.md`.

## License

[MPL-2.0](./LICENSE).
