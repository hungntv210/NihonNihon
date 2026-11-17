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

## Generator v2 source survey — 2026-11-17 (no API)

Real SRS eligibility: 0 items. Owner authorized draft_roadmap eligibility through
individual Vietnam dates, preserving real review mode. As-of survey: 129 words
with readings, 16 kanji rows, 16 grammar patterns, 299 unique sourced examples;
168 already satisfy the character gate, 292 can satisfy it using attested kana.
The existing eligible-title/reading union contains 128 allowed characters.

Hard-gated candidate upper bounds before history collisions/verifier:
reading46, spelling94, grammar13, order10, context26. These are alternatives,
not accepted independent questions. Same-target/30-day rules reduce supply.
Synonym/usage/paragraph are omitted rather than invented. Real drafting occurs
only after merge; its private statistics and HTML reviews are not approved bank
content. Fixture CLI uses no API and cannot publish. No question text is in this
report.
