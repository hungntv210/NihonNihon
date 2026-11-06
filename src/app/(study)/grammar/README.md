# G1 grammar

Route-owned implementation; no schema, shared dependency, or private-data change.

- `/grammar`: Japanese/romaji/English/selected-Vietnamese search, JLPT filter,
  bounded pagination, active content only. Unaccented Vietnamese search preserves
  Japanese dakuten. Result cards link to detail and the existing review queue.
- `/grammar/<item_id>` (also accepts short OpenJLPT keys): selected meaning,
  formation and notes with real source/model/prompt; English originals remain
  visible. Examples use validated furigana and mark the source pattern where
  present. Related entries share actual upstream tags. Clip links appear only
  with existing active `clip_segments` associations.
- Speech is opt-in browser speech synthesis with a Japanese voice. Missing voices
  have an explicit disabled state; this does not provision a TTS service.
- Practice derives cloze prompts and four-piece ordering from source examples.
  It grades reconstruction of the original sentence, not every grammatically valid
  alternative. Ambiguous/missing markers or too little text produce no fabricated
  question. Ordering works by touch/click/keyboard and desktop drag-and-drop.
- `/grammar/report` is an authenticated, same-origin POST that records fresh
  selected grammar/example translation reports in existing `translation_reports`.
  Repeating the same open report is idempotent; the translation is not auto-edited.

`grammar.test.ts` covers query boundaries/pagination, stale/candidate translation
exclusion, provenance, exact practice reconstruction, safe furigana and report
ownership/idempotency. It is picked up by root `npm test`.

Manual walkthrough after `npm run check`: search `subject`, clear/filter N2,
open `〜は`, read ruby/formation/notes, complete a cloze and a four-piece sentence,
check the correction/try-again flow, add a card, then inspect at 390px. A report
form appears only when the database actually contains a selected Vietnamese row.

The public foundation seed has only three N5 grammar entries; it intentionally
has no machine Vietnamese results or clips. This PR does not claim that 403
entries, all translations, every pattern's exercise coverage or Shadowing playback
have passed data acceptance. Those require G0/Shadowing integration later.
