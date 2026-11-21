import type { DatabaseSync } from 'node:sqlite';
import type { GrammarTranslation } from './repository.ts';

export type GrammarConfusable = {
  targetId: string;
  targetPattern: string;
  targetLevel: string;
  href: string;
  noteEn: string;
  noteVi: GrammarTranslation | null;
  sourceName: string;
  direction: 'outgoing' | 'incoming';
};

export type ActiveGrammarNoteRow = {
  id: string;
  pattern: string;
  level: string;
  notesEn: string | null;
  sourceName: string;
};

export type ExtractedContrast = {
  sourceId: string;
  targetId: string;
  targetPattern: string;
  targetLevel: string;
  matchedForm: string;
  noteEn: string;
  sourceName: string;
};

const LEVEL_ORDER: Record<string, number> = { N5: 0, N4: 1, N3: 2, N2: 3, N1: 4 };
const JP_BOUNDARY_CHAR = /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}\u30fc\u301c\uff5e~]/u;
const HAS_TILDE = /[\u301c\uff5e~]/u;

const CONTRAST_CUE =
  /\b(unlike|compare|contrast|different from|differs from|not the same as|don't confuse|do not confuse|not to be confused|instead|rather than|more\s+[a-z-]+\s+than|less\s+[a-z-]+\s+than|[a-z]+er\s+than|is\s+more\s+(objective|subjective|formal|informal|polite|casual|neutral|personal|general|emphatic|literary|written|spoken|colloquial|direct)|broader|narrower|opposite(\s+[a-z]+)?\s+of|similar|close to|near-synonym|synonym|counterpart|equivalent|interchangeable|separate points|whereas|while\b|like\s+[\u301c\uff5e~]|use\s+[\u301c\uff5e~]|sounds?\s+(more|less|like)|stresses|focuses on|refers to|neutral|formal\s+N[1-5]:|formal\s+version\s+of|colloquial\s+form\s+of|is\s+used\s+when)/iu;

const COOCCURRENCE_CUE =
  /\b(often with|paired with|followed by|such as|main clause is|accept with|also written|written form:|shortened|contracted|combined with|takes\s+[\u301c\uff5e~]|answer with|ask with|comes?\s+(after|before)|preceded by|often ends with|usually ends in|direct-quote version|related N[1-5] forms)\b/iu;

export function splitSentences(text: string): string[] {
  return text
    .normalize('NFC')
    .split(/(?<=[.!?])\s+/u)
    .map((s) => s.trim())
    .filter(Boolean);
}

function normalizePatternBase(raw: string): string {
  return raw
    .normalize('NFC')
    .replace(/[\uff08(][^\uff09)]*[\uff09)]/gu, '')
    .replace(/\s+/gu, ' ')
    .trim();
}

function patternVariants(pattern: string): string[] {
  const variants = new Set<string>();
  for (const part of pattern.split(/[/\uff0f]/u)) {
    const clean = part.normalize('NFC').trim();
    const base = normalizePatternBase(clean);
    if (base && HAS_TILDE.test(base)) variants.add(base);
    const expanded = clean
      .replace(/[\uff08(]([\p{Script=Hiragana}\p{Script=Katakana}]{1,2})[\uff09)]/gu, '$1')
      .replace(/[\uff08(][^\uff09)]*[\uff09)]/gu, '')
      .replace(/\s+/gu, ' ')
      .trim();
    if (expanded && expanded !== base && HAS_TILDE.test(expanded)) variants.add(expanded);
  }
  return [...variants];
}

function clauseContaining(sentence: string, start: number, end: number): string {
  const leftComma = Math.max(sentence.lastIndexOf(',', start), sentence.lastIndexOf(';', start));
  const rightCommaIdx = sentence.indexOf(',', end);
  const rightSemiIdx = sentence.indexOf(';', end);
  const rightCandidates = [rightCommaIdx, rightSemiIdx].filter((i) => i !== -1);
  const right = rightCandidates.length ? Math.min(...rightCandidates) : sentence.length;
  return sentence.slice(leftComma + 1, right).trim();
}

export function extractContrastEntries(rows: readonly ActiveGrammarNoteRow[]): ExtractedContrast[] {
  const formMap = new Map<string, Map<string, ActiveGrammarNoteRow>>();
  for (const row of rows) {
    for (const variant of patternVariants(row.pattern)) {
      let bucket = formMap.get(variant);
      if (!bucket) {
        bucket = new Map();
        formMap.set(variant, bucket);
      }
      bucket.set(row.id, row);
    }
  }
  const sortedForms = [...formMap.keys()].sort((a, b) => b.length - a.length);
  const results: ExtractedContrast[] = [];

  for (const row of rows) {
    if (!row.notesEn) continue;
    const selfForms = new Set(patternVariants(row.pattern));
    const seenTargets = new Set<string>();
    for (const sentence of splitSentences(row.notesEn)) {
      const usedRanges: Array<[number, number]> = [];
      for (const form of sortedForms) {
        if (selfForms.has(form)) continue;
        let pos = 0;
        while ((pos = sentence.indexOf(form, pos)) !== -1) {
          const end = pos + form.length;
          const before = pos > 0 ? sentence[pos - 1] : '';
          const after = end < sentence.length ? sentence[end] : '';
          const overlaps = usedRanges.some(([s, e]) => pos < e && end > s);
          if (
            !overlaps &&
            (!before || !JP_BOUNDARY_CHAR.test(before)) &&
            (!after || !JP_BOUNDARY_CHAR.test(after))
          ) {
            const targets = [...formMap.get(form)!.values()].filter((t) => t.id !== row.id);
            if (targets.length === 1 && !seenTargets.has(targets[0].id)) {
              usedRanges.push([pos, end]);
              const clause = clauseContaining(sentence, pos, end);
              const hasContrast = CONTRAST_CUE.test(sentence);
              const clauseCooccurs = COOCCURRENCE_CUE.test(clause);
              const sentenceCooccurs =
                COOCCURRENCE_CUE.test(sentence) && !CONTRAST_CUE.test(clause);
              if (hasContrast && !clauseCooccurs && !sentenceCooccurs) {
                seenTargets.add(targets[0].id);
                results.push({
                  sourceId: row.id,
                  targetId: targets[0].id,
                  targetPattern: targets[0].pattern,
                  targetLevel: targets[0].level,
                  matchedForm: form,
                  noteEn: sentence,
                  sourceName: row.sourceName,
                });
              }
            }
          }
          pos = end;
        }
      }
    }
  }
  return results;
}

export function extractViContrastSentence(
  notesViText: string | null,
  matchedForm: string,
  mentionedPattern: string,
): string | null {
  if (!notesViText) return null;
  const sentences = splitSentences(notesViText);
  if (sentences.length <= 1) return sentences[0] ?? null;
  const probes = [
    matchedForm,
    matchedForm.replace(/^[\u301c\uff5e~]+/u, ''),
    ...patternVariants(mentionedPattern),
    ...patternVariants(mentionedPattern).map((v) => v.replace(/^[\u301c\uff5e~]+/u, '')),
  ].filter((p) => p.length >= 2);
  for (const probe of probes) {
    const match = sentences.find((s) => s.includes(probe));
    if (match) return match;
  }
  return notesViText.normalize('NFC').trim();
}

export function getGrammarConfusables(
  db: DatabaseSync,
  itemId: string,
  loadTranslation: (db: DatabaseSync, id: string, field: 'notes') => GrammarTranslation | null,
  hrefFor: (id: string) => string,
  limit = 6,
): GrammarConfusable[] {
  const activeRows = db
    .prepare(
      `SELECT g.item_id id, g.pattern, g.level, g.notes_en, s.name source_name
       FROM grammar g
       JOIN content_items i USING(item_id)
       JOIN data_sources s ON s.source_id=i.source_id
       WHERE i.is_active=1
       ORDER BY g.level, g.item_id`,
    )
    .all()
    .map((r) => ({
      id: String(r.id),
      pattern: String(r.pattern),
      level: String(r.level),
      notesEn: r.notes_en == null ? null : String(r.notes_en),
      sourceName: String(r.source_name),
    }));

  const byId = new Map(activeRows.map((r) => [r.id, r]));
  const selfRow = byId.get(itemId);
  if (!selfRow) return [];

  const allEntries = extractContrastEntries(activeRows);
  const outgoing = allEntries.filter((e) => e.sourceId === itemId);
  const incoming = allEntries.filter((e) => e.targetId === itemId);

  const seenTarget = new Set<string>();
  const combined: Array<{
    target: ActiveGrammarNoteRow;
    sourceId: string;
    matchedForm: string;
    mentionedPattern: string;
    noteEn: string;
    sourceName: string;
    direction: 'outgoing' | 'incoming';
  }> = [];

  for (const entry of outgoing) {
    const target = byId.get(entry.targetId);
    if (!target || seenTarget.has(target.id)) continue;
    seenTarget.add(target.id);
    combined.push({
      target,
      sourceId: entry.sourceId,
      matchedForm: entry.matchedForm,
      mentionedPattern: target.pattern,
      noteEn: entry.noteEn,
      sourceName: entry.sourceName,
      direction: 'outgoing',
    });
  }

  for (const entry of incoming) {
    const target = byId.get(entry.sourceId);
    if (!target || seenTarget.has(target.id)) continue;
    seenTarget.add(target.id);
    combined.push({
      target,
      sourceId: entry.sourceId,
      matchedForm: entry.matchedForm,
      mentionedPattern: selfRow.pattern,
      noteEn: entry.noteEn,
      sourceName: entry.sourceName,
      direction: 'incoming',
    });
  }

  combined.sort((a, b) => {
    if (a.direction !== b.direction) return a.direction === 'outgoing' ? -1 : 1;
    const lvlDiff = (LEVEL_ORDER[a.target.level] ?? 9) - (LEVEL_ORDER[b.target.level] ?? 9);
    if (lvlDiff !== 0) return lvlDiff;
    return a.target.id.localeCompare(b.target.id);
  });

  const translationCache = new Map<string, GrammarTranslation | null>();
  const getNotesVi = (id: string) => {
    if (!translationCache.has(id)) translationCache.set(id, loadTranslation(db, id, 'notes'));
    return translationCache.get(id)!;
  };

  return combined.slice(0, limit).map((item) => {
    const fullVi = getNotesVi(item.sourceId);
    const viText = fullVi
      ? extractViContrastSentence(fullVi.text, item.matchedForm, item.mentionedPattern)
      : null;
    return {
      targetId: item.target.id,
      targetPattern: item.target.pattern,
      targetLevel: item.target.level,
      href: hrefFor(item.target.id),
      noteEn: item.noteEn,
      noteVi: fullVi && viText ? { ...fullVi, text: viText } : null,
      sourceName: item.sourceName,
      direction: item.direction,
    };
  });
}
