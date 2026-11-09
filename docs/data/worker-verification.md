# G0 worker verification

## 2026-11-09 — safe resume after power loss

- Checked commit: `068a6ca80a6e4777be4543ab4abb0946a1f2467b`, branch `codex/g0-resume-safety`.
- Windows / Node 24; `npm test`: **74/74 PASS**, no skips or real provider calls.
- Gate start: `2026-11-09T11:18:38.5311025+07:00`; end: `2026-11-09T11:18:47.6917393+07:00`.
- Coverage: at most one snapshot per Pacific quota day, first/latest retention,
  durable day receipts, pending review pauses and the existing major threshold,
  historical prompt hashes, v7 built directly from v4, proper-name QA for v6+,
  verified backup before audit deduplication/VACUUM, and an actual Windows
  fake-worker test proving wait-until, dead-PID lock removal and idempotent launch.
- Database schema was not edited. Fixture compaction checks every non-audit
  table and all non-KanjiVG audit rows are unchanged; source release rows remain.
- Operational reports, backup paths/hashes, deleted row IDs, deleted snapshot
  names, worker state, translation outputs and quota ledgers stay in ignored
  private storage. The maintenance script records every deleted audit row;
  snapshot and launcher cleanup append deletion logs.
- Task Scheduler registration, physical reboot acceptance and production
  deployment are outside this change and were not performed.

This documentation travels with the feature branch/PR; it is not pushed directly
to master. G0 retains its own package/test command until accepted and merged.
