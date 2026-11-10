# Draft coverage repair and tester waivers

G0 data foundation is **Frozen** after the approved repair, all eleven acceptance
steps and successful CI. The following records the repair process. Completion
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

## Initial acceptance rerun — 10 November 2026

All eleven steps ran; ten passed. G0 stays **Draft** because six OpenJLPT stroke
counts disagree with the standard KanjiVG path counts. Every kanji has paths, but
the disagreements have not been accepted as waivers or resolved. Keep the pinned
source values and the private diagnostic report; do not silently mark Frozen.

Two full imports and a forced transaction rollback passed on a private database
copy with an SRS card/review canary. Production remained unchanged during acceptance.
The final guard also verifies that replaying pre-trim history requires a current,
fresh selected replacement; its four real legacy rows satisfy that prerequisite.
The final code passed 124 tests. Media and physical-device checks remain pending G1.

## Tester-approved glyph variants

The tester accepted the six count disagreements as `glyph_variant_jouyou2010`.
`runGlyphVariantImport` applies the KanjiVG count shown by the existing paths;
`content_items.field_sources.stroke_override` retains the original OpenJLPT count,
source hash, KanjiVG release/checksum, waiver, reviewer and manual decision release.
It never edits upstream files, source hashes, meanings, translations or SRS.

A normal reimport preserves the approved override only while its OpenJLPT hash,
original count and KanjiVG paths/release still match. Changed inputs fail validation
and require renewed review. The metadata and effective count commit together;
failure rolls both back. Media/physical-device checks remain pending G1. The
data-only Frozen transition requires the full acceptance rerun and current CI green.

## Frozen G0 data foundation

Chốt ngày 10/11/2026 sau **11/11 PASS**, **127/127 local** và CI run `42776038315`
SUCCESS trên head `fa0726a`. Retry job `129691967930` của run `42772810363` cũng
SUCCESS; giữ nguyên launcher readiness 30 giây, không sửa launcher hay nới test.

Phạm vi N2–N5: 4.741 từ, 1.038 kanji, 403 ngữ pháp, 9.465 hàng câu/9.464 câu Nhật NFC
duy nhất, 18.081 bản dịch selected. Nghĩa Việt đủ, không stale/NFC lỗi/khoảng trắng
ngoài selected; quick_check ok/FK 0. Hai full reimport và forced rollback giữ nguyên
selected và SRS canary trên bản sao; không ghi dữ liệu production khi nghiệm thu.

Giữ rõ ngoại lệ và provenance: 15 tester waivers học liệu, 6 `glyph_variant_jouyou2010`,
và 畑 không có âm Hán Việt gốc. Âm chính hợp lệ 1037/1038 (99.90366088631984% thô),
không bỏ ngoại lệ khỏi mẫu số hoặc bịa âm. Các method thực tế: 613 single, 43 CVDICT,
275 AI và 106 quyết định đã sửa/duyệt. Báo cáo đầy đủ/hash DB/snapshot/release và
context nằm trong data/private, không commit dữ liệu riêng tư.

**Pending G1:** ba clip Erin/phim cá nhân/YouTube, font trên điện thoại thật và
shadowing. Không đánh PASS các mục này, không coi lookup theo mặt chữ là tokenizer
đầy đủ mọi từ trong câu. Sau Frozen mọi sửa text qua importer có provenance;
waiver số nét mất hiệu lực khi nguồn/hash/release/path đổi. Không gọi Gemini trong
lượt chốt này. PR vẫn chờ duyệt/merge riêng, không tự merge.
