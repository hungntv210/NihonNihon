# Kanji route

Owns `/kanji`, `/kanji/[character]` and `/kanji/report`. Uses the foundation's
authenticated read-only DAL, selected-translation contract, text/source components,
and review insertion. It makes no schema, package, or G0 changes.

- Search character, HV candidates/primary, Vietnamese (accent-insensitive), English,
  On/Kun (katakana/hiragana/half-width), level, exact stroke count, and multiple
  radical/components (AND). Pagination is 18 entries; filters survive page links.
- Details distinguish selected primary HV from candidates, show actual source/model
  and `Tự chọn`, preserve English beside Vietnamese, and reject stale translations.
- Readings, grade/frequency/radicals/components and related words come from SQLite.
  Related words already in the review queue appear first, followed by the same level.
- Stroke player uses imported `kanji_strokes.path_d`, selects the canonical variant,
  supports replay/step/reset, and respects reduced motion. It displays the imported
  source/license. It does not download strokes or fabricate missing geometry.
- Audio uses a local Japanese browser voice on explicit click. No voice means a clear
  disabled state; no API key, autoplay, or external TTS request is introduced.
- Personal memo is NFC-normalized, limited to 500 characters and device-local storage.
  Translation reports require login, same Origin, and a still-current selected
  translation; identical open reports are idempotent in existing `translation_reports`.

The public sample has four kanji without HV/VI/strokes; those missing states are
intentional. Full 1,038-kanji coverage, original HV dictionary definitions and real
stroke coverage remain dependent on accepted G0 data. No private dictionary or
machine output is bundled in this route. Full vocabulary details require the sibling
`g1/vocab` PR to be merged. No physical-device animation benchmark has been claimed.

Route tests are discovered by `npm test`. After a production build, extra HTTP/Chrome
coverage can be run with:

```sh
node --import tsx "src/app/(study)/kanji/browser-check.ts"
```

This creates an isolated demo database plus explicitly synthetic translations/stroke
paths for loaded-data checks, then deletes it. Screenshots/report remain under
gitignored `data/reports/`; it never calls Gemini or accesses the live G0 database.
