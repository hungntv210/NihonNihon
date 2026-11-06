# SRS route

Scope: only this directory plus append-only verification log. FSRS/wanakana
dependencies come from merged foundation PR#2. No schema changes.

- 20-card normal sessions,15-card quick sessions, four actual FSRS-6 previews at
  retention90%, reading input with romaji conversion, seven-day forecast, pause/resume.
- Quick mode excludes grammar/listening; no autoplay. Swiping is opt-in to avoid
  grading during ordinary scrolling. Browser speech requires an installed local
  Japanese voice. No cloud TTS/API key.
- Native IndexedDB outbox stores each review before advancing; sync sends one
  event per authenticated same-origin request. Review UUID is the existing
  srs_reviews primary key, so retries are idempotent. Optimistic state checks
  retain conflicts without overwriting history or resetting schedules.
- Existing unknown scheduler states are excluded with a visible notice. New
  pending:g1/srs cards initialize on the first rating, not merely on page view.

Limitations: open a session while online. Active sessions can grade offline and
sync after reconnect/relogin; a cold offline app load needs the future foundation
PWA shell. Audio/shadow clips and cloze cards remain visibly unsupported until
their respective feature contracts exist. No claim of physical-device timing or
full G0 dataset coverage. G0 is not merged by this work.

Verification: root npm run check plus route-local tests. Run the browser smoke
with `npx tsx "src/app/(study)/srs/browser-check.ts"` after a production build.
