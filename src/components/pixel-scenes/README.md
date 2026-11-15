# Approved pixel scenes in the app

Adapted from the owner-approved `Nihon Nihon HTML/scenes` renderer and four scenes.
No external assets, network weather, runtime eval, extra dependencies or private data.
The standalone originals are unchanged.

- `/` and `/today-roadmap`: home-tokyo. Both Today entry points share one scene.
- `/srs` (including quick mode): review-koi. Server-supported due count, capped at
  twelve koi; local reviews subtract only IDs in the fresh server-due cards, never
  the stale cached session's due total.
- `/kanji`: kanji-himeji. Distinct active kanji with at least one actual SRS review,
  matching the existing JLPT learned criterion. Queuing a card does not count as learned.
  The numeric parameter keeps the actual count; the eight visual lamps saturate at 100.
- `/shadowing`: shadowing-inari. Current cookie/session/day progress from the existing
  store: min(15-minute time fraction, best complete-clip recording fraction), or 1 if
  today's session is already awarded. Only server-acknowledged progress moves the fox.
  Demo playback contributes nothing, and audio remains in the browser as before.

Server `sceneClock` uses Asia/Ho_Chi_Minh including the local month at UTC date
boundaries. Seasons: Mar–May spring, Jun–Aug summer, Sep–Nov autumn, Dec–Feb winter.
The original date hash selects weather deterministically, shared across all four scenes.
Preview query parameters do not override production state.

`PixelCanvas` is client-only; engine and each renderer are dynamic imports in its
mount effect. Other routes do not load the engine. The approved native raster is
384×216, integer scaled with a per-scene focal crop (Tokyo .55, koi/Himeji .5,
Inari .52). Hidden/out-of-viewport canvases cancel rAF. The engine draws at most
30fps; reduced motion and Settings → Chuyển động off draw one static frame.
Observers, event handlers and pending imports are disposed on navigation.

Koi keep a mild continuous body bend and an attached tail through heading changes;
pads use a displaced, water-colored shadow/slit rather than a black cutout.

Validation: `tests/pixel-scenes.test.ts` checks clock/seasons, real learned count,
progress, stale SRS IDs, 96 connected fish poses and a 40KiB source gzip limit.
`src/app/(study)/appearance/pixel-scenes/browser-check.ts` runs after build, checks
compiled lazy-chunk gzip plus a conservative upper bound for duplicated client wiring
against 40KiB, route-local loading, capped real due data, learned/progress data,
30fps, hidden/offscreen/static settings and live updates. It captures all four scenes
at 390/1440px for morning/day/sunset/night (32 screenshots) under
`data/reports/pixel-scenes/`. The existing appearance/browser suite stays in place.
Desktop browser checks do not establish iPhone GPU/battery behavior; physical-device
review remains necessary. Engine statistics are exposed only on the canvas host for
these checks and contain no learner content or credentials.
