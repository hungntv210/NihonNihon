# Additional study scenes

Four approved local renderers are ported as ES modules. Shared SceneCraft imports the existing engine sprite catalog; source artwork outside the repo is unchanged. No runtime requests or new dependencies.

- Market: distinct active vocabulary with an actual SRS review; five stock levels at250-word intervals. Queued-only cards do not count. People have18% alpha,4×1px close foot shadows.
- JLPT: persisted attempts for the Vietnam date, capped by the renderer at10; successful answers update the scene locally. No fabricated attempts or API generation on page open.
- Journey: existing todayPlan.week (including delays) on the87-week roadmap. The1920×216 native panorama has four384px regions and three128px joins, each rendered by the same engine. Native focusable horizontal scroll stays inside the scene; initial camera centers the real train. Manual swipe yields camera, Theo tàu resumes. Only intersecting tiles animate, no second rAF loop.
- Grammar: approved Kinkaku-ji scene, no invented progress metric.

Server supplies Vietnam date/time/season, day-seeded weather. URL query parameters cannot override production counts or clock. All scenes lazy-load on their routes, share30fps/visibility/reduced-motion/settings lifecycle. Tests preserve the original four-scene40KiB gate and separately cap this PR's added renderers/shared wiring and compiled lazy chunks at40KiB. Browser fixture fixes Date on both server and browser, leaves timers real, and captures32screenshots at390/1440 across four times. Physical phone GPU/battery performance still requires hardware review.
