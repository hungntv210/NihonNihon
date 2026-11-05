-- Draft 0.1: design artifact, not a production migration. SQLite >= 3.38.
PRAGMA foreign_keys = ON;

CREATE TABLE data_sources (
  source_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  license TEXT NOT NULL,
  version TEXT,
  imported_at TEXT,
  checksum TEXT CHECK(checksum IS NULL OR (length(checksum)=64 AND checksum NOT GLOB '*[^0-9a-f]*')),
  attribution TEXT NOT NULL,
  usage_scope TEXT NOT NULL CHECK(usage_scope IN ('redistributable','private_only','unverified'))
) STRICT;
CREATE TABLE source_releases (
  release_id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES data_sources(source_id) ON DELETE RESTRICT,
  version TEXT NOT NULL,
  checksum TEXT NOT NULL CHECK(length(checksum)=64 AND checksum NOT GLOB '*[^0-9a-f]*'),
  artifact_url TEXT NOT NULL,
  retrieved_at TEXT NOT NULL,
  license TEXT NOT NULL,
  attribution TEXT NOT NULL,
  UNIQUE(source_id,version,checksum),
  UNIQUE(source_id,release_id)
) STRICT;
CREATE TABLE import_runs (
  run_id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  release_id TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  status TEXT NOT NULL CHECK(status IN ('staged','validated','committed','failed')),
  report_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(report_json) AND json_type(report_json)='object'),
  FOREIGN KEY(source_id,release_id) REFERENCES source_releases(source_id,release_id)
) STRICT;
CREATE TABLE content_items (
  item_id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK(kind IN ('vocab','kanji','grammar','sentence','clip')),
  source_id TEXT NOT NULL,
  source_key TEXT NOT NULL,
  release_id TEXT NOT NULL,
  source_hash TEXT NOT NULL CHECK(length(source_hash)=64 AND source_hash NOT GLOB '*[^0-9a-f]*'),
  field_sources TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(field_sources) AND json_type(field_sources)='object'),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)),
  UNIQUE(source_id,kind,source_key),
  UNIQUE(item_id,kind),
  FOREIGN KEY(source_id,release_id) REFERENCES source_releases(source_id,release_id)
) STRICT;
CREATE TABLE vocab (
  item_id TEXT PRIMARY KEY,
  kind TEXT NOT NULL DEFAULT 'vocab' CHECK(kind='vocab'),
  word TEXT NOT NULL CHECK(length(word)>0),
  reading TEXT NOT NULL CHECK(length(reading)>0),
  romaji TEXT NOT NULL,
  level TEXT NOT NULL CHECK(level IN ('N5','N4','N3','N2','N1')),
  meanings_en TEXT NOT NULL CHECK(json_valid(meanings_en) AND json_type(meanings_en)='array' AND json_array_length(meanings_en)>0),
  pos TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(pos) AND json_type(pos)='array'),
  jmdict_id INTEGER CHECK(jmdict_id IS NULL OR jmdict_id>=1000000),
  FOREIGN KEY(item_id,kind) REFERENCES content_items(item_id,kind)
) STRICT;
CREATE INDEX vocab_lookup ON vocab(word,reading);
CREATE INDEX vocab_jmdict ON vocab(jmdict_id);
CREATE TABLE vocab_forms (
  item_id TEXT NOT NULL REFERENCES vocab(item_id),
  form_kind TEXT NOT NULL CHECK(form_kind IN ('writing','reading')),
  form TEXT NOT NULL,
  source_id TEXT NOT NULL,
  release_id TEXT NOT NULL,
  PRIMARY KEY(item_id,form_kind,form),
  FOREIGN KEY(source_id,release_id) REFERENCES source_releases(source_id,release_id)
) STRICT;
CREATE TABLE kanji (
  item_id TEXT PRIMARY KEY,
  kind TEXT NOT NULL DEFAULT 'kanji' CHECK(kind='kanji'),
  character TEXT NOT NULL UNIQUE,
  level TEXT NOT NULL CHECK(level IN ('N5','N4','N3','N2','N1')),
  strokes INTEGER CHECK(strokes IS NULL OR strokes>0),
  grade INTEGER,
  frequency_rank INTEGER CHECK(frequency_rank IS NULL OR frequency_rank>0),
  radical TEXT,
  radical_number INTEGER CHECK(radical_number IS NULL OR radical_number BETWEEN 1 AND 214),
  onyomi TEXT NOT NULL CHECK(json_valid(onyomi) AND json_type(onyomi)='array'),
  kunyomi TEXT NOT NULL CHECK(json_valid(kunyomi) AND json_type(kunyomi)='array'),
  nanori TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(nanori) AND json_type(nanori)='array'),
  meanings_en TEXT NOT NULL CHECK(json_valid(meanings_en) AND json_type(meanings_en)='array'),
  supplementary INTEGER NOT NULL DEFAULT 0 CHECK(supplementary IN (0,1)),
  FOREIGN KEY(item_id,kind) REFERENCES content_items(item_id,kind)
) STRICT;
CREATE TABLE grammar (
  item_id TEXT PRIMARY KEY,
  kind TEXT NOT NULL DEFAULT 'grammar' CHECK(kind='grammar'),
  pattern TEXT NOT NULL,
  reading TEXT,
  romaji TEXT NOT NULL,
  level TEXT NOT NULL CHECK(level IN ('N5','N4','N3','N2','N1')),
  meaning_en TEXT NOT NULL,
  formation_en TEXT NOT NULL,
  notes_en TEXT,
  tags TEXT NOT NULL CHECK(json_valid(tags) AND json_type(tags)='array'),
  FOREIGN KEY(item_id,kind) REFERENCES content_items(item_id,kind)
) STRICT;
CREATE TABLE sentences (
  item_id TEXT PRIMARY KEY,
  kind TEXT NOT NULL DEFAULT 'sentence' CHECK(kind='sentence'),
  text_ja TEXT NOT NULL,
  text_en TEXT,
  furigana_notation TEXT,
  tatoeba_ja_id INTEGER UNIQUE CHECK(tatoeba_ja_id IS NULL OR tatoeba_ja_id>0),
  author_attribution TEXT NOT NULL,
  FOREIGN KEY(item_id,kind) REFERENCES content_items(item_id,kind)
) STRICT;
CREATE TABLE item_sentences (
  item_id TEXT NOT NULL REFERENCES content_items(item_id),
  sentence_id TEXT NOT NULL REFERENCES sentences(item_id),
  position INTEGER NOT NULL CHECK(position>=0),
  source_id TEXT NOT NULL,
  release_id TEXT NOT NULL,
  PRIMARY KEY(item_id,sentence_id),
  UNIQUE(item_id,position),
  FOREIGN KEY(source_id,release_id) REFERENCES source_releases(source_id,release_id)
) STRICT;
CREATE TABLE kanji_vocab (
  kanji_id TEXT NOT NULL REFERENCES kanji(item_id),
  vocab_id TEXT NOT NULL REFERENCES vocab(item_id),
  source_id TEXT NOT NULL,
  release_id TEXT NOT NULL,
  PRIMARY KEY(kanji_id,vocab_id),
  FOREIGN KEY(source_id,release_id) REFERENCES source_releases(source_id,release_id)
) STRICT;
CREATE TABLE word_furigana (
  word TEXT NOT NULL,
  reading TEXT NOT NULL,
  segments TEXT NOT NULL CHECK(json_valid(segments) AND json_type(segments)='array'),
  source_id TEXT NOT NULL,
  release_id TEXT NOT NULL,
  PRIMARY KEY(word,reading,source_id),
  FOREIGN KEY(source_id,release_id) REFERENCES source_releases(source_id,release_id)
) STRICT;
CREATE TABLE kanji_components (
  kanji_id TEXT NOT NULL REFERENCES kanji(item_id),
  component TEXT NOT NULL,
  source_id TEXT NOT NULL,
  release_id TEXT NOT NULL,
  PRIMARY KEY(kanji_id,component,source_id),
  FOREIGN KEY(source_id,release_id) REFERENCES source_releases(source_id,release_id)
) STRICT;
CREATE TABLE kanji_strokes (
  kanji_id TEXT NOT NULL REFERENCES kanji(item_id),
  variant TEXT NOT NULL DEFAULT '',
  stroke_no INTEGER NOT NULL CHECK(stroke_no>0),
  path_d TEXT NOT NULL,
  source_id TEXT NOT NULL,
  release_id TEXT NOT NULL,
  PRIMARY KEY(kanji_id,variant,stroke_no),
  FOREIGN KEY(source_id,release_id) REFERENCES source_releases(source_id,release_id)
) STRICT;
CREATE TABLE vi_translations (
  translation_id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL REFERENCES content_items(item_id) ON DELETE RESTRICT,
  field TEXT NOT NULL CHECK(field IN ('meaning','formation','notes','text','han_viet')),
  text_vi TEXT NOT NULL CHECK(length(text_vi)>0),
  method TEXT NOT NULL CHECK(method IN ('dictionary','han_viet','tatoeba','machine')),
  source_id TEXT NOT NULL,
  release_id TEXT NOT NULL,
  source_record_key TEXT NOT NULL,
  base_content_hash TEXT NOT NULL CHECK(length(base_content_hash)=64 AND base_content_hash NOT GLOB '*[^0-9a-f]*'),
  status TEXT NOT NULL CHECK(status IN ('candidate','selected','needs_review','rejected')),
  match_method TEXT NOT NULL CHECK(match_method IN ('word','word_reading','jmdict_form','tatoeba_link','codepoint','machine_context')),
  needs_refresh INTEGER NOT NULL DEFAULT 0 CHECK(needs_refresh IN (0,1)),
  context_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(context_json) AND json_type(context_json)='object'),
  created_at TEXT NOT NULL,
  FOREIGN KEY(source_id,release_id) REFERENCES source_releases(source_id,release_id),
  UNIQUE(item_id,field,source_id,release_id,source_record_key,base_content_hash)
) STRICT;
CREATE UNIQUE INDEX vi_one_selected ON vi_translations(item_id,field) WHERE status='selected';
CREATE INDEX vi_lookup ON vi_translations(item_id,field,status);
CREATE TABLE translation_reports (
  report_id TEXT PRIMARY KEY,
  translation_id TEXT NOT NULL REFERENCES vi_translations(translation_id),
  reason TEXT NOT NULL,
  reported_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','resolved'))
) STRICT;
CREATE TABLE media_assets (
  asset_id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL REFERENCES content_items(item_id),
  asset_kind TEXT NOT NULL CHECK(asset_kind IN ('audio','video','tts')),
  storage_ref TEXT NOT NULL,
  source_id TEXT NOT NULL,
  release_id TEXT NOT NULL,
  attribution TEXT NOT NULL,
  license TEXT NOT NULL,
  private_only INTEGER NOT NULL CHECK(private_only IN (0,1)),
  FOREIGN KEY(source_id,release_id) REFERENCES source_releases(source_id,release_id)
) STRICT;
CREATE TABLE clip_segments (
  clip_id TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'clip' CHECK(kind='clip'),
  position INTEGER NOT NULL CHECK(position>=0),
  sentence_id TEXT NOT NULL REFERENCES sentences(item_id),
  start_ms INTEGER NOT NULL CHECK(start_ms>=0),
  end_ms INTEGER NOT NULL CHECK(end_ms>start_ms),
  source_id TEXT NOT NULL,
  release_id TEXT NOT NULL,
  PRIMARY KEY(clip_id,position),
  FOREIGN KEY(clip_id,kind) REFERENCES content_items(item_id,kind),
  FOREIGN KEY(source_id,release_id) REFERENCES source_releases(source_id,release_id)
) STRICT;
-- One learner. Authentication identity belongs to g1/foundation.
CREATE TABLE srs_cards (
  card_id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL REFERENCES content_items(item_id) ON DELETE RESTRICT,
  card_type TEXT NOT NULL CHECK(card_type IN ('recognition','recall','reading','cloze','listening')),
  state_json TEXT NOT NULL CHECK(json_valid(state_json) AND json_type(state_json)='object'),
  scheduler_version TEXT NOT NULL,
  due_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(item_id,card_type)
) STRICT;
CREATE INDEX srs_due ON srs_cards(due_at);
CREATE TABLE srs_reviews (
  review_id TEXT PRIMARY KEY,
  card_id TEXT NOT NULL REFERENCES srs_cards(card_id) ON DELETE RESTRICT,
  rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 4),
  reviewed_at TEXT NOT NULL,
  elapsed_ms INTEGER CHECK(elapsed_ms IS NULL OR elapsed_ms>=0),
  scheduler_version TEXT NOT NULL
) STRICT;
