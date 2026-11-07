# Today / roadmap

The route reads active OpenJLPT records from the existing content database. The 87-week plan shows the available catalog, not invented coverage. Missing frequency data uses stable source identifiers.

Progress is owner-only JSON in `data/private/today-roadmap.json` (`NIHON_ROADMAP_PATH` overrides it). Shadowing completion is explicitly manual: regular sessions require 15 minutes; makeup requires 25 minutes and two distinct clip references. This does not assess audio recordings or pronunciation. Missing previous-week sessions lock new lessons, while SRS remains available. Foundation owns enforcement outside this route.

The dashboard supports daytime quick recognition review, evening/20-minute plans, Sunday review, persisted resume, manual activity streaks, third-session freeze credits, recovery warnings and missed-week timeline estimates. Manual activity may differ from actual learning activity. Freeze credits are shown as accumulated credits; automatic freeze consumption is not implemented.

JLPT exercises/weekly tests, audio capture and background notification delivery depend on later modules. Their unavailable status is shown in the UI. Reminders currently appear only while this page is open. Planned leave of up to two weeks per six months is not implemented in this route.

Verification: `npm run check`, then `node --import tsx "src/app/(study)/today-roadmap/browser-check.ts"`. The latter uses synthetic credentials and an isolated demo database, checks desktop/mobile layout and persistence, and writes ignored artifacts under `data/reports/today-roadmap/`.
