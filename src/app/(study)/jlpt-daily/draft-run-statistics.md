# Draft roadmap generation — 2026-11-14

This is an offline N5 draft for roadmap weeks 1–2, not an app question bank.
No questions, source text, private paths, credentials or API responses are included here.

| Measure | Result |
| --- | --- |
| Target | 70 questions / 7 days |
| Previously accepted, retained unchanged | 2 |
| Additional questions passing hard + independent semantic QA | 3 |
| Total passing | 5 / 70 |
| Complete days | 0 / 7 |
| Primary API calls | 4 (2 generate, 2 verify), all successful |
| Fallback API calls | 0 |
| HTTP 503 / 429 this run | 0 / 0 |
| Repair rounds | 2 (existing bound retained) |
| Final rejected positions in day 1 | 5 |
| Final rejection: UNLEARNED_KANJI | 3 |
| Final rejection: HARD_QA_SPELLING_MARKED_KANA | 2 |
| Stop state | needs_tester_review; worker exited |
| App publication / DB writes | none |

The partial day, checkpoints, rejected rows/reasons and model provenance remain in
ignored data/private. Days 2–7 have not been generated because day 1 still fails QA.
The retry/fallback branch is fixture-tested; it was not needed by the actual API run.
No QA gate, answer key or generated question was manually corrected to reach a count.
