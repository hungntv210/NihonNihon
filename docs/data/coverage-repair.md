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
