# Draft coverage repair and tester waivers

G0 remains Draft until all missing active vocabulary meanings are imported, the
tester approves the sample, and all eleven acceptance steps are rerun. Completion
of a historical learning queue is not full database coverage: compare every active
item with a fresh selected translation using its current source hash.

`recordTesterWaivers` records exactly the authorized twelve `too_few_meanings`
and three `compound_dictionary_candidate_mismatch` findings as resolved reports.
Each binds the tester decision file hash, finding hash, translation ID, text hash
and source hash. Text and selection remain unchanged. Audit displays waived
findings separately and invalidates a waiver when the finding or content changes.

The `runImport` API supports `translationScope: {itemIds, fields, onlyMissing:true}`
for this repair. Every target must already be active with the same source hash.
It applies translations and source/release provenance through the normal importer,
without replacing content, links, Han-Viet decisions or study progress. Existing
selected and historical translations are retained. A verified snapshot and the
disk-space gate are still required by the calling operator before writes.

Check exact dictionary headwords and supplied/JMdict forms first; keep ambiguous
readings unresolved. CVDICT compound evidence does not justify inventing a
Japanese kana-word definition. Remaining public OpenJLPT items use the approved
3.5 Flash Lite profile, existing Pacific quota ledger, Ajv, NFC and terminology
gates. Export missing IDs/reasons, actual model/release provenance and a random
thirty-item review sample into gitignored `data/private/`.

畑 is recorded as the owner-authorized kokuji exception “không có âm Hán Việt
gốc”. Do not invent a reading or count it as primary-reading coverage. Three real
clips, phone font checks and shadowing remain pending G1, never data PASS.

After a bounded repair, report the first successful imported batch and finish the
chat. Freeze only after tester approval and the complete acceptance rerun. Later
text changes must use the importer with provenance.

## Reviewed corrections and whitespace

Both normal and reviewed importers normalize NFC and trim the outer whitespace of
`text_vi` before generating translation IDs. This applies to every translation
field, including sentence `text`; whitespace inside a translation is preserved.
Previously stored text is immutable: corrections create a provenance-bearing
replacement, retain the old row and record the superseded translation ID.
Replaying a pre-trim artifact reuses its immutable historical natural key after
the selected value has been repaired. A still-selected padded legacy value is
rejected with an explicit request for a provenance correction; it is never silently
rewritten or allowed to collide with the new normalized ID.

The final vocabulary sample was reviewed (one major in thirty, below the existing
pause threshold) and the tester checked all sixty-two entries. Nine explicit word
corrections and three additional whitespace-only sentence corrections were imported
with `source_id=mt:manual`, `model=manual`, `reviewer=tester`; no Gemini call.
The two upstream gloss errors are recorded as private `source_note` exceptions,
without changing OpenJLPT `meanings_en`.

Acceptance compares the real database with its pinned artifacts. Record any new
failure rather than silently treating it as an accepted exception. Media, physical
phone fonts and shadowing remain pending G1; no claim of full sentence tokenization
is made by the data-only acceptance.
