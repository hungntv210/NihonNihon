# Owner sentence and bounded learning-lite pilot

Both tools operate on ignored private directories. Tests use synthetic public
fixtures; actual data/results/configs are never committed. Stop and verify the
campaign worker before an owner import; no tool writes SQL directly.

`owner-sentence.mjs --config <private-config> --directory <new-private-folder>
--ja <public-sentence> --text-vi <owner-text> --reviewer owner` reconstructs the
request from public sources, enforces the existing schema/glossary/sentence
QA, pins a `mt:manual` release with model `manual` and reviewer `owner`, then
uses the existing campaign importer. The existing schema's common output
method enum remains unchanged; manual authorship is explicit in source/release
provenance. It registers the accepted profile, verifies every public sentence
is covered, updates the completion checkpoint, and creates the final review.
It never labels human output as a Google model or calls an AI for that text.

`learning-lite-pilot.mjs --config <private-config> --directory <new-private-folder>`
uses the configured sentence Lite model chain with route `learning`, name
`learning-lite`, prompt v7, batch30, timeout120000, thinking low. It reuses the
same absolute quota ledger paths and public-source allowlist. Explicit timeout
support is the same small adapter change proposed in PR #23; it is included
here because that PR is still unmerged, and is required for this pilot.

Exactly two logical batches select60 unfinished contexts, including20 Han Viet;
accepted live learning outputs are excluded. Fallback only receives unfinished,
non-deferred contexts. Accepted/rejected rows and sanitized errors retain actual
model provenance. It writes `review-learning-0001` with30 random accepted items,
including10 Han Viet, plus the standard version/sample_id/results feedback JSON.
Then it exits. Pilot results are **not imported** before owner review. If fewer
than10 Han Viet or20 other results pass, it saves run/results diagnostics and
refuses to fabricate a30-item review or request additional batches.

Glossary, JSON/schema/evidence checks, prompts, snapshot retention and review
thresholds remain unchanged. No schema changes or new dependencies.

## Revision after semantic review of pilot 0001

Pilot 0001 failed semantic review for kanji definitions and must not be
imported, even though its structural QA passed. Its files/feedback remain intact.

Routes `han_viet` and `meaning` explicitly filter task/field at the adapter,
importer request selection and campaign queue. The Han Viet Lite profile example
uses3.5 Flash Lite; it runs no3.6/3.8 probe. A dedicated `review-han-viet-*`
checkpoint tracks every500 newly accepted Han Viet items independently of
sentences, with30 random rows, one outstanding sample and the same >10% major
stop gate. This capability is not started by a pilot command.

`--mode meaning` selects exactly60 pending **kanji** meaning requests in two
logical batches, never Han Viet or vocabulary/grammar tasks. It writes a fresh
`review-learning-0002` with30 random accepted definitions and English senses,
then exits; no DB import and no extra batches to replace rejected rows.

This profile preserves the historical v7 base prompt and adds a pinned
`prompt_variant: lite-meaning-1`: translate every English meaning, in order,
comma-separated, and never substitute a Han Viet reading for a definition.
`kanji_meaning_qa: true` enables per-row rejection after the existing batch gates:

- A whole definition equal to a candidate reading after NFC, lowercase and trim is reviewed. A single-sense overlap is flagged
  and imported; it is rejected only when English has at least two senses but
  the output has one. Tones remain significant (đọc differs from độc).
- Fewer than `min(meanings_en.length,3)` distinct comma-separated senses is
  rejected as `too_few_meanings`. Repeating the same sense does not pad the count.

Candidates come from checksummed public-plan dictionary data and are sent as
context only, without changing frozen input/request identities. Accepted rows
are saved; only rejected rows are deferred with reasons. Historical profiles
without the flag/variant retain their old prompt hashes and validation behavior.
Accent folding can also flag a legitimate Vietnamese definition that coincides
with a reading (e.g. đọc/độc); the requested strict rule is retained and these
rows remain visible for human review. Neither pilot is automatically imported.

## Owner-approved production policy

The previous accent-folding collision policy is superseded: reading comparison
uses NFC, lowercase and trim **with tones preserved**. Single-sense overlap is
accepted with `han_viet_reading_overlap` in the normal translation-report queue;
multi-sense English reduced to one matching reading is rejected. The separate
minimum-sense-count gate remains. Tests import 読/南/毎, with two review reports
for 南/毎 and no collision for đọc versus độc.

`learning_review: true` in the campaign config enables one shared500-item
checkpoint for the entire learning stream (including Han Viet and definitions).
Samples use actual accepted insertion order, task/input/output/model provenance,
and `review-learning-*` IDs. `next_review_number` preserves existing pilot IDs.
Missing feedback waits/polls every60 seconds; complete feedback with major<=10%
resumes automatically; >10% major stops. The final sample also waits for review.
This uses the pending-review functionality first prepared in PR #23, now included
in this PR for the explicitly authorized all-Lite rollout.

Production rotation retains immutable accepted profiles, sentence reviews,
learning reviews, original per-model ledger paths, snapshot directory and probe
state. The approved meaning pilot may be registered once; the failed mixed
pilot must never be registered/imported. No request for an accepted context is
sent again. The production Lite profile uses batch30, timeout120000 and low
thinking; other models stay disabled. Review flags do not discard translations.
