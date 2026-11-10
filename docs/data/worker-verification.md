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

- PR #20 updated after merging #19: conflict resolution kept both verification sections. Checked merge `8cd48ac4d50c715917318f5890fa24c64410bba7`; full `npm test` at `2026-11-09T15:32:14.1916427+07:00` → `2026-11-09T15:32:23.3289938+07:00`: **82/83 PASS**, one launcher test blocked by the live worker's known cross-project detection bug. Production was left running; the requested launcher fix travels in the next worker-recovery PR. CI must pass the complete suite before this approved PR is merged.

## 2026-11-09 — campaign cooldown, per-row terminology and scoped launcher

- Base includes PR #19 merge `4170758cef8c45db86b643fe4e1620580151f75d` and PR #20 merge `56fc77479c5161a1be5e0c147ac7b942574ab010`, both made with merge commits. PR #20's resolved base passed CI run `42586781287` before merging; both verification histories were retained.
- Checked implementation: `77a43d8aea2227c965211552ea6fbee082570eff`, isolated branch `codex/g0-worker-recovery`.
- Full `npm test`: **87/87 PASS**, no skips, Windows / Node 24; `2026-11-09T15:42:22.3346081+07:00` → `2026-11-09T15:42:32.2483548+07:00`.
- Tests cover no-HTTP network retry then success on the same Pacific date, durable 15-minute cooldown, six cumulative campaign failures per stream/day (success does not reset the day's counter), independent streams, next-day reset, and immediate `daily_limit` day holds. Existing ledger budgets and internal call caps still apply.
- A synthetic 30-sentence response with one numeric-glossary violation saves/imports exactly 29 machine translations as selected; the rejected row retains its request ID and strict expected-term reason. JSON/schema and other quality gates remain batch gates; prompts and schema are unchanged.
- The Windows launcher test keeps an unrelated fake project's worker alive, verifies this does not block launch, and still proves wait-until, dead-PID lock cleanup and a single same-project/config launch. The real production worker remained running throughout this gate.
- Tests make no real provider calls. Runtime holds/deferred flags and quota ledgers were not cleared, accepted private results were not changed, and the new worker has not been deployed. Clearing the approved quota-day flags, one launcher restart and the one-hour progress measurement are explicitly pending review/merge of this PR. No production file/data deletion was performed for this change.

## 2026-11-09 — partial output in fallback chain

- Checked implementation `a1697734cd59fd3da71cdde67025cf813447ff91`, isolated branch `codex/g0-chain-partial`, based on approved PR #21 merge `21878c272765501a7339bc38e2ff589a233c9bd3`.
- Full `npm test`: **87/87 PASS**, zero skips; Windows / Node 24, `2026-11-09T15:52:34.8128334+07:00` → `2026-11-09T15:52:45.2350787+07:00`.
- The chain accepts `partial_output` and continues to the existing unfinished-context filter. No retry, glossary, prompt, schema, quota or campaign behavior changes. Tests use fake providers. This follow-up remains a separate PR; no production data/files deleted.

## 2026-11-09 — owner sentence and learning-lite pilot

- Checked implementation `8806838acac67412e1365bd9dcf5f2d931dd23f0`, isolated branch `codex/g0-learning-lite`, base `101d387b3589c6c855e15553dd2723d88d36b719`.
- Full `npm test`: **91/91 PASS**, zero skips, Windows / Node 24; `2026-11-09T17:48:41.5311314+07:00` → `2026-11-09T17:48:54.9286111+07:00`.
- New tests verify strict numeric-glossary rejection before DB creation, manual/owner provenance through the real fixture importer, complete sentence coverage/final review,60 pending learning requests with20 Han Viet,30 distinct review items with10 Han Viet, and validated/pinned120-second timeout forwarded to Interactions.
- Actual owner-authorized manual import and exactly two pilot batches were run from this isolated worktree; operational results stay private. Pilot output is not imported before review. No private data, credentials, schema changes, provider call by tests, or production file/translation deletion is part of this PR.

## 2026-11-09 — task routing and kanji-meaning QA after pilot review

- Checked implementation `3b7952a28919962bc1732e56762669db98e73955`, same PR #24 branch `codex/g0-learning-lite`.
- Full `npm test`: **96/96 PASS**, zero skips, Windows / Node 24; `2026-11-09T21:40:48.5416474+07:00` → `2026-11-09T21:40:57.2826807+07:00`.
- Tests cover task-specific importer routing, adapter routes, accent/case-insensitive reading collisions, minimum distinct comma-separated senses, per-row rejection with other rows retained, frozen base prompt/new variant hashes, meaning-only60-item selection/30-item review, and independent Han Viet500-item review/pending/major gates.
- The new meaning-only pilot was limited to two logical batches and stopped for review. Neither old nor new pilot was imported into the DB. Per-row reasons, actual model/calls, candidate context, feedback and outputs stay private. No bulk Han Viet worker was started, no feedback was changed, no schema/ledger reset or production file/data deletion occurred.

## 2026-11-09 — tone-aware flags and shared production review

- Checked implementation `4ba9ccd634273e47b2e4ab802dafd370e2efbdce`, same PR #24 branch. Full `npm test`: **101/101 PASS**, zero skips, Windows / Node 24; `2026-11-09T22:05:10.6911547+07:00` → `2026-11-09T22:05:21.1982641+07:00`.
- Tests cover 読→đọc versus độc, accepted/flagged 南→nam and 毎→mỗi, normal importer selection plus two review reports, shared mixed-task sampling/numbering, 60-second feedback wait/resume at <=10% major and immediate stop above10%.
- The owner's new shared learning rollout explicitly includes pending-feedback waiting (first prepared in PR #23). Learning review flags are imported normally; rejected rows remain separate. The minimum-sense gate, frozen prompts, schema and per-model ledgers remain unchanged.
- Rollout must rotate into a fresh private directory, reuse existing3.5 quota paths, preserve sentence/manual provenance and reviews, register only the approved meaning pilot, reserve review-learning-0003 onward, and keep3.6/3.8 disabled. Runtime records and one-hour monitoring stay private.

## 2026-11-09 — consecutive transient failure streak

- Checked implementation `82bc4406f2fe81abe121e08854a03b8f65f6fec5`, isolated branch `codex/g0-consecutive-retries`, based on merged PR #24.
- Full `npm test`: **102/102 PASS**, zero skips, Windows / Node24; `2026-11-09T22:26:18.4431215+07:00` → `2026-11-09T22:26:31.3049269+07:00`.
- `complete` and `partial_output` reset `retry.failures` to0; the next transient failure starts at1. Six consecutive failures still hold that stream for the quota day. Cooldown, Pacific reset, daily_limit and provider ledger rules remain unchanged.
- Tests cover both streams, both success statuses, persistence across restart, and the unchanged six-consecutive-failure/day-quota boundaries. The old cumulative-counter assertions were updated to the requested policy.
- Owner separately authorized a production status-only counter correction and one launcher restart without deploying this PR. Runtime PID/config verification, old/new counter and cleanup are logged privately. No translation/backup deletion, schema change, quota reset or real provider call by tests.

## 2026-11-10 — bounded deferred recovery and owner correction importer

- Checked implementation `2a46f6f048fb6b20821046606a2e185f7f52a79e`, isolated branch `codex/g0-final-recovery` based on `g0/data-import` `f409ea9`. Full `npm test`: **110/110 PASS**, zero skips; Windows/Node24, `2026-11-10T09:28:54.9346948+07:00` → `2026-11-10T09:29:07.9295319+07:00`.
- Tests cover adapter batch10, keeping accepted rows, at most two recovery rounds, terminal manual queue without false completion, limited normalized English-gloss exception, Vietnamese dictionary attestation, tone-aware candidate comparison, pinned new prompt hash, full DB audit and provenance owner imports surviving later normal imports.
- Before production recovery, verified no process matched the worker PID/config and normal queue was exhausted. No worker interruption/restart,3.6/3.8 call, ledger reset or quota-day wait. Standalone recovery used approved3.5 Lite and existing Pacific ledger; all result files and raw audits stay gitignored.
- Private run: recovered **30/35**, learning **2665/2670**, `learning.complete=false`, remaining5 explicitly in manual review. No accepted translation was regenerated. A real cached response for 肩→vai was revalidated against pinned CVDICT; its response hash/evidence is retained, no fake provider call or quota mutation.
- Imported owner corrections for 委→ủy, 抱→bão, 吸 bút→mút plus11 selected grammar fields using “thể từ điển”: **14 fields/items**, model=manual/reviewer=owner. Queried final selected values and confirmed zero selected grammar fields retaining the old term. Original translation text is preserved under needs_review. DB quick_check ok / foreign-key violations0.
- Exported140 audit rows for tester before bulk changes, plus a separate5-item manual list and queued Hán Việt retranslation with approval required. No bulk correction was applied. Runtime checkpoint/config retains accepted recovery manifests for later resume.
- No original dictionary, accepted result, translation or backup deletion. Temporary cleanup only: recovery.lock in each private recovery directory (first directory twice, second once), plus test-owned temporary fixtures. Old campaign.lock remains untouched. Reports/logs were moved within their project into gitignored report directories, not deleted. Runtime deletion records are private.
- Only tools/data, tests/import and docs/data changed; no schema, package, app-route or environment-file change. PR remains unmerged for tester. Post-recovery worker is not started; do not launch the old branch for terminal manual rows before review/merge of this code.

## 2026-11-10 — tester decisions and accent-preserving QA

- PR #29 head `9efe418` was verified CI SUCCESS (`42743357820`) and merged by Create a merge commit as `1f99eac4058ff43f85a92a8adc1cd02599cf56ff`; no admin override. App/G1 branches untouched.
- Checked implementation `b659361e47201cf484ca007ae9e84f366275ec50`, isolated `codex/g0-tester-decisions` from the merged G0 branch. Full `npm test`: **117/117 PASS**, zero skips, Windows/Node24; `2026-11-10T12:05:50.1539959+07:00` → `2026-11-10T12:06:01.5090471+07:00`.
- QA counts senses using NFC/lowercase/trim, preserving tones; mỗi/mọi count separately. Reviewed short Vietnamese forms no longer receive the language flag; English remains suspect. Tests cover normalized duplicates, short forms, missing-meaning insertion, tester provenance/idempotency, protected reviewed readings and actual meaning-only payload/schema expansion.
- Private runtime applied15 tester decisions through the importer: five missing meanings (including the exact 塔 wording), six readings and four expanded meanings. Dictionary rows for all three conditional 輸/尻/捻 readings were present and recorded before import; none skipped. Source mt:manual/modelmanual/reviewertester with the decision-file hash retained.
- Translated **105/105** compound meanings using3.5 Flash Lite and the existing Pacific ledger. Provider only receives word/gloss and returns meaning; all105 selected readings, words and compound readings were locked and verified unchanged. Nested compound_meaning_provenance records the real Gemini model/release/prompt separately from the tester-reviewed reading. No3.6/3.8 call, quota reset or worker interruption/restart.
- One unaccented response “xoay, quay” needed dictionary gloss parsing for numbered/newline senses. Cached HTTP200 output was revalidated with dictionary evidence, without another API call after the parser fix. All accepted results are retained on resume; already-imported evidence is skipped.
- Final private verification: **learning.complete=true,2670/2670**, no manual items; **18019 selected**, quick_check ok, FK0. Updated113 distinct items (15 manual fields and105 compound meanings, with overlaps). All15 requested selected values/provenance and105 fixed readings verified. Remaining compound-English flags0 and short-language flags0.
- No source data, original translation, environment file or backup deleted/committed. Only own operation/quota temporary locks and test fixtures were cleaned; one pre-operation backup reused after integrity verification. Private checkpoint/config stores the human and compound profiles for resume. New QA PR remains unmerged; no services/tasks installed or direct branch push to G0.

## 2026-11-10 — Draft coverage repair and tester waivers

- PR30 CI SUCCESS was verified before its normal merge commit a2e4ea6a5d05eab4d2883d2fc2a71953ff430c33. New isolated branch codex/g0-acceptance stays unmerged.
- Implementation 8d6cdf9173852edf57912343aff43603fb091ec0: npm test 120/120 PASS, zero skips; 2026-11-10T12:42:39.4391314+07:00 to 2026-11-10T12:42:51.0189440+07:00. Tests cover exact/count-bound tester waivers, invalidation on changed source and translation-only repair preserving accepted/history rows, content, links, strokes and SRS progress.
- Private verified snapshot taken before writes. Recorded 12 too_few_meanings and3 compound_dictionary_candidate_mismatch tester waivers with decision/text/source/finding hashes; no text change. Audit keeps waived findings visible and leaves unrelated informational flags visible.
- Full active vocabulary coverage found62 missing meanings outside the historical learning cohort. All62 kana headwords lacked a safe exact/form dictionary match; ambiguous guesses were not used. Exported complete IDs, source English, script type and reasons under data/private. Approved Gemini3.5 Flash Lite translated62/62 in3 HTTP200 requests, with existing Pacific ledger, Ajv/NFC/terminology and nonempty/no-Japanese gates. First batch30/30 imported successfully with actual model/prompt/release provenance; final selected18081, quick_check ok/FK0; all pre-existing translation rows and protected content/link/progress tables unchanged.
- Random thirty-item review and feedback exported privately; tester approval is pending. G0 remains Draft. 畑 records the owner-authorized kokuji exception, no invented Han-Viet reading. Eleven-step acceptance rerun/Freeze awaits tester approval; real clips/device/font/shadowing remain pending G1.
- No original data, translation, result or backup deleted/committed. Only own repair.lock and adapter quota.lock cleanup plus test-owned temporary fixtures; old campaign.lock untouched. No OS services/tasks,3.6/3.8 calls or quota reset. No waiting for an hourly progress report.
