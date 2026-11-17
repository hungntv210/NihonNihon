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
Server `dailyWeather(date, period)` selects one offline weather state shared by all nine scenes.
The engine honors that state; it calls the same selector only when no state was supplied.
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


## Daily weather (illustrative Tokyo seasons, not a live forecast)

Vietnam calendar date, not the device timezone, seeds a stable versioned date hash.
Weights are percentages before the two safety/calendar rules below. They model the
requested seasonal atmosphere; they are design probabilities, not measured climate data.
No weather service, location permission, network request or new package is used.

| Month | 晴れ clear | 曇り cloudy | 小雨 drizzle | 大雨 heavy | 雪 snow | 霧 morning fog | 風 wind |
|---|---:|---:|---:|---:|---:|---:|---:|
|1|55|18|5|1|9|5|7|
|2|50|18|7|1|8|6|10|
|3|43|18|10|2|0|7|20|
|4|40|20|12|3|0|5|20|
|5|40|22|15|4|0|5|14|
|6|32|23|24|10|0|4|7|
|7|35|21|23|11|0|3|7|
|8|58|16|9|4|0|3|10|
|9|35|19|18|14|0|3|11|
|10|43|21|12|5|0|7|12|
|11|50|20|8|2|0|9|11|
|12|56|17|5|1|7|6|8|
|Tsuyu 15/6–15/7 (inclusive override)|24|22|32|13|0|3|6|

- Fog is displayed only 05:00–10:59 Vietnam time; afterwards the same day's
  fog state becomes cloudy. Snow is sampled only December–February.
- A fourth consecutive raw extreme (heavy rain/snow) becomes clear. Heavy rain
  on any active festival date becomes clear **on every route**, rather than
  changing weather only in the festival's scene. Snow/cloud/drizzle keep festivals.
- The 2000–2029 distribution test compares observed monthly counts with the table
  (including each day's tsuyu/festival adjustment). Tolerance is a four-sigma
  binomial band +0.5 percentage point, minimum2.5 points; extreme respite shifts
  are negligible. Clear must also be the most frequent state across all30years.
- Query strings never participate. Only the explicit isolated browser-test preload
  can enable NIHON_UI_WEATHER_FIXTURE; the env var alone has no production effect.
- Weather uses the existing30fps/visibility/motion lifecycle, maximum36 particles
  per visible tile (15drizzle/20snow/8wind). It adds no animation loop. Still mode
  keeps cloud banks, haze, pools, ice/snow caps and a frozen sparse particle frame.
- Native exposure rectangles avoid roofs/timbers/interior floors. Fog is composited
  by layer depth; indoor palettes stay warm and only window pixels are misted.
  Snow caps are placed on fixed roof/stone/branch coordinates, never creature bounds.
  Rain never adds lightning. The login tea/cushions/sleeping cat remain indoors.
- Weather browser proof:9scenes ×7day/morning states +heavy/snow at night,
 390px contact sheet, clear1440 pixel comparison against27db394, static controls,
 server/client agreement, query tampering, and FPS. Physical iPhone battery/GPU
 behavior still needs device review.


### Rain clarity follow-up

Tokyo uses a grey overcast horizon, a rain plane behind the station canopy/signs,
and a separate bounded wind-blown foreground strip beside wet platform reflections.
Login rain darkens only the garden, suppresses incoming room petals/leaves, and
retains the paper lamp,tea,cat and dry form/floor. Rain circles use3–6native-pixel
radii so they remain visible at390px. Market precipitation stays beyond the roof;
the entry floor is wet, a visitor carries a closed umbrella, and snow sits on the
visible arcade roof edge. Inari's accepted heavy-rain palette/streak opacity remains
the reference. Drizzle has32legible thin streaks; cloudy has no weather particles.

Browser proof isolates cloudy/drizzle/heavy at the **same date,time,season and
static animation frame**. The composite is cropped to the390px visible scene;
each scene must differ by at least120native pixels (480CSS pixels at2x) between
cloud and drizzle. It stores exact counts and a27-photo rain-contact-390.png,
alongside all81weather cases and clear1440 zero-difference guard against0addddf.
Incremental compiled-JS limit for this follow-up is5,000gzip bytes abovePR56.
