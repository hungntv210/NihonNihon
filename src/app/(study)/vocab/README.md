# G1 vocab

Implemented within this route only:

- Search by written word, kana (including katakana input), romaji, original English
  and fresh selected Vietnamese meaning; Vietnamese accents are optional while
  kana voicing marks remain significant. JLPT and queued-word filters combine.
- Stable 12-word pagination and word detail URLs based on the complete content ID.
- Detail: reading/furigana, part-of-speech codes, selected Vietnamese and its
  source/model, expandable original English, existing word Hán Việt, linked kanji,
  linked examples with safe ruby rendering and selected translation provenance.
- Same written word with another reading is explicitly linked; meanings never
  join by spelling alone.
- Add to review reuses the foundation's idempotent authenticated writer. The
  queued-word filter persists across browsers because it reads existing cards.
- A small lesson presents up to five unqueued words, reveals meanings, offers
  explicit audio and lets the learner add a word to review. Viewing/revealing
  does not claim the word was learned or remembered.
- Browser speech is opt-in and enabled only when a Japanese voice is available;
  no external TTS provider or API key is configured here. Voice availability and
  offline support depend on the browser/OS.
- Báo sai stores an open report against a still-selected, fresh, related translation
  in the existing `translation_reports` table. It does not replace translations.

G0 has not merged. The current public fixture has eight vocabulary records and
no vocabulary example links or Vietnamese translations. These fields therefore
use honest empty/English states. Route tests attach public fixture examples and
synthetic translations in temporary databases to verify these data paths.
Full N5–N2 coverage, Reader/subtitle custom-word ingestion and imported TTS assets
remain dependent on the corresponding data and feature integrations; this PR
does not manufacture that content or add a personal-notebook schema.

Manual review after setup:

1. Open `/vocab`, search `gakusei`, `ガクセイ` or `student`; combine N5 and queued filters.
2. Open the student word. Confirm reading, English fallback and linked 学 kanji.
3. Add a word to review, revisit `/vocab?saved=1`, and repeat the add without a duplicate card.
4. Open `/vocab/lesson`, reveal a meaning and move through the small lesson. No audio autoplays.
5. On a DB snapshot with selected translations/examples, inspect provenance,
   other-reading links and Báo sai. Never point at G0's actively imported database.

`npm run check` covers the foundation plus these route unit tests. Before push,
also run `node tools/check-route-scope.mjs origin/master vocab` and append the
actual commit/time/results to the central verification log.

After the build, run the route-specific browser checks with:

```sh
node --import tsx "src/app/(study)/vocab/browser-check.ts"
```

It uses a temporary database with clearly synthetic Vietnamese translations,
verifies their source label and error reporting, and exercises search, queued
filter, lesson navigation and mobile overflow. Screenshots/reports remain local
under gitignored `data/reports/`.
