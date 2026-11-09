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
