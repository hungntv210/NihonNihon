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

## 2026-11-09 — archive first snapshot and enable G0 PR CI

- Checked commit: `9e8822982fcf5ec3bc34bd4d826b4de276cda7cc`, branch `codex/g0-snapshot-archive-ci`, based on the approved PR #17 merge into `g0/data-import`.
- `npm test`: **76/76 PASS**, no skips, Windows / Node 24; `2026-11-09T11:50:31.7998570+07:00` → `2026-11-09T11:50:40.7904249+07:00`.
- Added archive verification, refusal to overwrite differing files, and receipt/retention tests for a first snapshot kept outside C:. The launcher test now uses an explicit release signal so parallel machine load cannot let its first worker exit before the duplicate-launch assertion.
- CI runs `npm ci` and `npm test` for PRs targeting `g0/data-import`, on Windows to include the launcher test. Action runtime releases checked: [checkout v5](https://github.com/actions/checkout/releases/tag/v5.0.0), [setup-node v5](https://github.com/actions/setup-node/releases/tag/v5.0.0).
- Actual archive metadata, SHA-256, source deletion record and disk measurements remain private; no translation results, DB files or environment were committed.

- Cold-runner follow-up: CI run `42564131082` reached all tests but the old six-second launcher readiness poll expired (75/76 passed). Commit `92f7fb65c970d7c8f061a9cc9bd8ba69f2276207` waits for the readiness file up to 30 seconds, still verifies the actual worker start timestamp and single launch, and kills the fake process tree on test failure. Full local recheck: **76/76 PASS**, `2026-11-09T11:54:33.9139876+07:00` → `2026-11-09T11:54:45.8698099+07:00`.

## 2026-11-09 — selected backup archives and disk-low gate

- Checked commit: `b5de39617ab39bd5e7fe19b2d38048ba4b46922a`, same PR branch `codex/g0-snapshot-archive-ci`.
- `npm test`: **81/81 PASS**, no skips, Windows / Node 24; `2026-11-09T12:21:39.5460965+07:00` → `2026-11-09T12:21:49.6120195+07:00`.
- Added project-bound latest/legacy backup archiving, external daily-receipt reuse, and refusal of sources outside the project. Source removal requires verified destination SHA-256 and integrity/FK first.
- Disk tests cover the exact 5,000,000,000-byte boundary, no snapshot/import or DB mutation below threshold, a late pre-transaction check, and worker status/log/lock handling for `disk_low`.
- Operational file inventories, hashes, receipts, real disk readings and deletion logs remain private. No fixed 19-GB target or pagefile changes are part of this update.

## 2026-11-09 — redacted Gemini failure messages

- Checked commit: `37022767a5cf15eb2863983a84a88d95417ba877`, branch `codex/g0-error-message`.
- `npm test`: **82/82 PASS**, zero skips, Windows / Node 24; `2026-11-09T15:17:40.2360249+07:00` → `2026-11-09T15:17:58.8401699+07:00`. Gemini-only tests: **21/21 PASS**.
- Failed API attempts carry `error_message` into the callback, worker stdout and audit. Environment keys, Google-key patterns and labelled key values are redacted before truncation to 300 characters. The new 503 test verifies the message and redaction, three calls and the unchanged 32.5/60-second waits with deterministic jitter.
- Initial full run passed 81/82: the real campaign worker caused the launcher's existing single-worker protection to refuse the test fixture. Both production roles were verified idle on their day holds; the worker was briefly stopped for the full test, then restarted through the existing launcher. Quotas, holds, model selection and accepted translations were not edited. Operational actions and stale-lock cleanup stay in private logs.
- Retry logic, prompt, schema and QA gates are unchanged. Tests use fake providers and no real API calls. Any learning model change requires a separate owner decision; this PR only adds diagnostics.

## 2026-11-09 — database-volume disk check

- Checked commit: `627d57e026efe97b2be34b4e9ec6fa26047b0380`, isolated branch `codex/g0-db-volume`.
- `npm test`: **82/82 PASS**, no skips, Windows / Node 24; `2026-11-09T13:36:32.2207493+07:00` → `2026-11-09T13:36:40.5800647+07:00`.
- Checks now derive the volume from the configured DB path and pass that path through startup, snapshot and pre-transaction gates. Tests cover another Windows drive and caller propagation; the 5-GB threshold and `disk_low` behavior are unchanged.
- The launcher worktree remained clean on `g0/data-import` at approved PR #18 merge `66a919e993ee6b2d51a46a5862da2bc8ca8703df`; its post-merge suite passed 81/81. This isolated change is not deployed to that worktree before review.
