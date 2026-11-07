# Công cụ chung

Direct routes: `/common-tools`, `/common-tools/search?q=...&page=1`,
`/common-tools/reports`, `/common-tools/progress`, `/common-tools/settings`.
Shared sidebar/mobile navigation integration belongs to foundation.

Search reads active vocabulary, kanji and grammar through authenticated
`withContentDatabase`. NFC input, Vietnamese accent removal (including đ), kana
and local wanakana romaji matching require no migration or external service.
Only current selected Vietnamese translations participate. Results retain actual
source/model provenance and canonical detail links. The shared AddToReview button
uses the existing authenticated API. Details own example/report interactions.
No raw database or private file is sent to the browser.

Search is a normalized scan, with 24 results per page. No FTS table is created.
The <200 ms target must be measured on the owner's imported snapshot; demo timings
cannot establish production performance. Clip sentences, arbitrary-text popup
tokenization and external dictionaries are deferred because their lookup contract
is absent. No private dictionary samples are committed.

The read-only report queue joins `translation_reports` (open) and translations
with `needs_review`/`needs_refresh`, including stale or inactive targets explicitly
labeled. Vocab/kanji/grammar report owners all write that existing table; there is
no private report-file writer in this revision. It shows actual release model
metadata, never infers models from provider names. Up to 300 report/flag rows are
shown; no resolve, editing, bulk translation or automatic repair action exists.

Settings reexports the shared `/settings` page and uses its existing API. Progress
counts real `srs_reviews`, per-local-day 14-day review counts and distinct active
content with saved/reviewed cards. Reviewed does not claim mastery. Shadowing is
read through the existing roadmap validator and labeled manually confirmed.
No page-open timers, fingerprinting, fake schedules, or microphone metrics.

Verification (Node >=24, existing dependencies, production build):

```powershell
npm run check
node ../ci-scope-g1/tools/check-route-scope.mjs origin/master g1/common-tools
node --import tsx 'src/app/(study)/common-tools/browser-check.ts'
```

The sibling scope guard is the pending shared registry update; this branch never
copies shared files. Browser checks create an isolated demo DB, synthetic MT
release and credentials, use installed Chrome on Windows (`CHROME_PATH` override)
or Playwright Chromium, and clean up afterward. Checks cover authentication,
search/provenance, actual enqueue/report flow, desktop/mobile widths and overflow.
Screenshots and JSON reports remain gitignored under `data/reports/`. Physical
phone, home-host Tailscale HTTPS and off-machine backups require deployment checks.
TTS is deferred.
