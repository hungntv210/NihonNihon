import { execFileSync } from 'node:child_process';
const [base, branch] = process.argv.slice(2);
const route = branch?.startsWith('g1/') ? branch.slice(3) : branch;
// Authoritative branch-to-path registry; CI passes the full branch without another allowlist.
const ownership = new Map(
  ['srs', 'vocab', 'kanji', 'grammar', 'today-roadmap', 'shadowing', 'common-tools']
    .map(name => [name, [`src/app/(study)/${name}/`]]),
);
ownership.set('jlpt-daily', ['src/app/(study)/jlpt-daily/', 'src/app/(study)/jlpt/']);
ownership.set('backup-jlpt', ['tools/check-route-scope.mjs', 'src/core/backup.ts', 'tools/home-backup.ts', 'tests/jlpt-backup.test.ts', 'src/app/(study)/jlpt-daily/approved-store.ts', 'docs/deploy-home.md']);
ownership.set('pixel-scenes', ['src/components/pixel-scenes/', 'src/app/(study)/appearance/', 'src/app/(study)/page.tsx', 'src/app/(study)/today-roadmap/page.tsx', 'src/app/(study)/srs/page.tsx', 'src/app/(study)/srs/review-session.tsx', 'src/app/(study)/kanji/page.tsx', 'src/app/(study)/shadowing/page.tsx', 'src/app/(study)/shadowing/use-practice.ts', 'tests/pixel-scenes.test.ts', 'tools/check-route-scope.mjs']);
ownership.set('login-room-details', ['src/components/pixel-scenes/login-shoji.js', 'src/app/(study)/appearance/login-festivals/', 'tests/login-portrait.test.ts', 'tools/check-route-scope.mjs']);
ownership.set('jlpt-deterministic', ['src/app/(study)/jlpt-daily/', 'src/app/(study)/srs/repository.ts', 'docs/features/g1-jlpt-daily.md', 'tools/check-route-scope.mjs']);
ownership.set('jlpt-approved-v2', ownership.get('jlpt-deterministic'));
ownership.set('jlpt-generator-balance', ownership.get('jlpt-deterministic'));
ownership.set('jlpt-verifier-schema', ownership.get('jlpt-deterministic'));
ownership.set('pokabu/jlpt-free-providers', ['src/app/(study)/jlpt-daily/draft-provider.ts', 'src/app/(study)/jlpt-daily/draft-provider.test.ts', 'src/app/(study)/jlpt-daily/free-provider.ts', 'src/app/(study)/jlpt-daily/generate-v2.ts', 'src/app/(study)/jlpt-daily/v2-verifier.ts', 'src/app/(study)/jlpt-daily/generation.ts', 'tools/jlpt-free-provider-benchmark.ts', 'tools/check-route-scope.mjs']);
ownership.set('pokabu/jlpt-free-roles', ['src/app/(study)/jlpt-daily/draft-provider.ts', 'src/app/(study)/jlpt-daily/draft-provider.test.ts', 'src/app/(study)/jlpt-daily/free-provider.ts', 'src/app/(study)/jlpt-daily/v2-verifier.ts', 'tools/check-route-scope.mjs']);
ownership.set('pokabu/jlpt-ambiguous-distractors', ['src/app/(study)/jlpt-daily/deterministic.ts', 'src/app/(study)/jlpt-daily/tokenizer.ts', 'src/app/(study)/jlpt-daily/v2-hardening.ts', 'src/app/(study)/jlpt-daily/v2-hardening.test.ts', 'src/app/(study)/jlpt-daily/v2-verifier.ts', 'tools/check-route-scope.mjs']);
ownership.set('pokabu/jlpt-rate-pacing', ['src/app/(study)/jlpt-daily/free-provider.ts', 'src/app/(study)/jlpt-daily/draft-provider.ts', 'src/app/(study)/jlpt-daily/draft-provider.test.ts', 'src/app/(study)/jlpt-daily/generate-v2.ts', 'tools/check-route-scope.mjs']);
ownership.set('pokabu/jlpt-tokenizer', ['src/app/(study)/jlpt-daily/', 'package.json', 'package-lock.json', 'tools/check-route-scope.mjs']);
ownership.set('pokabu/jlpt-week30-fix', ['src/app/(study)/jlpt-daily/', 'tools/check-route-scope.mjs']);
ownership.set('pokabu/jlpt-verifier-count', ['src/app/(study)/jlpt-daily/', 'tools/check-route-scope.mjs']);
ownership.set('pokabu/jlpt-qa-hardening', ['src/app/(study)/jlpt-daily/', 'tools/check-route-scope.mjs']);
ownership.set('pokabu/jlpt-qa-hardening-2', ['src/app/(study)/jlpt-daily/', 'tools/check-route-scope.mjs']);
ownership.set('pokabu/jlpt-provider-cooldown', ['src/app/(study)/jlpt-daily/draft-provider.ts', 'src/app/(study)/jlpt-daily/generate-week.ts', 'src/app/(study)/jlpt-daily/draft-provider.test.ts', 'tools/check-route-scope.mjs']);
ownership.set('pokabu/jlpt-quality-gates', ['src/app/(study)/jlpt-daily/confusion-groups.ts', 'src/app/(study)/jlpt-daily/deterministic.ts', 'src/app/(study)/jlpt-daily/grammar-function.ts', 'src/app/(study)/jlpt-daily/v2-verifier.ts', 'src/app/(study)/jlpt-daily/v2.test.ts', 'tools/check-route-scope.mjs']);
ownership.set('pokabu/jlpt-explanation-sense', ['src/app/(study)/jlpt-daily/deterministic.ts', 'src/app/(study)/jlpt-daily/context-sense.ts', 'src/app/(study)/jlpt-daily/v2-data.ts', 'src/app/(study)/jlpt-daily/v2-verifier.ts', 'src/app/(study)/jlpt-daily/v2.test.ts', 'tools/check-route-scope.mjs']);
ownership.set('pokabu/g1-tick-a', ['docs/features/g1-foundation.md', 'docs/features/g1-grammar.md', 'docs/features/g1-kanji.md', 'docs/features/g1-vocab.md', 'tools/check-route-scope.mjs']);
ownership.set('pokabu/backup-large-db', ['src/core/backup.ts', 'tests/backup.test.ts', 'tools/check-route-scope.mjs']);
ownership.set('rain-clarity', ['src/components/pixel-scenes/', 'src/app/(study)/appearance/daily-weather/', 'tests/daily-weather.test.ts', 'tools/check-route-scope.mjs']);
ownership.set('daily-weather', ['src/components/pixel-scenes/', 'src/app/login/', 'src/app/(study)/appearance/', 'tests/daily-weather.test.ts', 'tools/ui-test-clock.mjs', 'tools/check-route-scope.mjs']);
ownership.set('login-portrait', ['src/app/login/login.module.css', 'src/components/pixel-scenes/', 'src/app/(study)/appearance/login-festivals/', 'tests/login-portrait.test.ts', 'tools/check-route-scope.mjs']);
ownership.set('login-festivals', ['src/app/login/', 'src/components/pixel-scenes/', 'src/app/(study)/appearance/', 'tests/login-festivals.test.ts', 'tools/check-route-scope.mjs']);
ownership.set('pixel-scenes-next', ['src/components/pixel-scenes/', 'src/app/(study)/vocab/page.tsx', 'src/app/(study)/grammar/page.tsx', 'src/app/(study)/jlpt-daily/page.tsx', 'src/app/(study)/jlpt-daily/practice.tsx', 'src/app/(study)/today-roadmap/page.tsx', 'src/app/(study)/appearance/', 'tests/pixel-scenes.test.ts', 'tests/pixel-scenes-next.test.ts', 'tools/check-route-scope.mjs']);
ownership.set('mobile-perf', ['tools/perf-mobile.mjs', 'package.json', 'tools/check-route-scope.mjs']);
ownership.set('naetoru/mobile-perf', ownership.get('mobile-perf'));
ownership.set('font-perf', ['tools/subset-fonts.py', 'public/fonts/', 'src/styles/tokens.css', 'src/components/pixel-scenes/engine.js', 'tests/pixel-scenes.test.ts', 'tools/check-route-scope.mjs']);
ownership.set('naetoru/font-perf', ownership.get('font-perf'));
ownership.set('font-split', ['tools/subset-fonts.py', 'public/fonts/', 'src/styles/tokens.css', 'tests/font-split.test.ts', 'tools/check-route-scope.mjs']);
ownership.set('naetoru/font-split', ownership.get('font-split'));
ownership.set('roadmap-perf', ['src/components/pixel-scenes/roadmap-journey.js', 'src/components/pixel-scenes/scene.module.css', 'src/app/(study)/today-roadmap/', 'tests/pixel-scenes-next.test.ts', 'tools/check-route-scope.mjs']);
ownership.set('naetoru/roadmap-perf', ownership.get('roadmap-perf'));
ownership.set('srs-perf', ['src/app/(study)/srs/review-session.tsx', 'tests/srs-perf.test.ts', 'tools/check-route-scope.mjs']);
ownership.set('naetoru/srs-perf', ownership.get('srs-perf'));
ownership.set('srs-lazy-wanakana', ['src/app/(study)/srs/review-session.tsx', 'tests/srs-lazy-wanakana.test.ts', 'tools/check-route-scope.mjs']);
ownership.set('naetoru/srs-lazy-wanakana', ownership.get('srs-lazy-wanakana'));
ownership.set('srs-settings', ['src/app/(study)/settings/', 'src/app/api/settings/', 'src/core/preferences.ts', 'src/server/preferences.ts', 'src/app/(study)/srs/', 'src/app/(study)/appearance/browser-check.ts', 'tests/preferences.test.ts', 'tests/srs-settings.test.ts', 'tools/check-route-scope.mjs']);
ownership.set('naetoru/srs-settings', ownership.get('srs-settings'));
ownership.set('nav-prefetch', ['src/components/shell.tsx', 'tests/nav-prefetch.test.ts', 'tools/check-route-scope.mjs']);
ownership.set('naetoru/nav-prefetch', ownership.get('nav-prefetch'));
ownership.set('shadowing-preload', ['src/app/(study)/shadowing/player.tsx', 'tests/shadowing-preload.test.ts', 'tools/check-route-scope.mjs']);
ownership.set('naetoru/shadowing-preload', ownership.get('shadowing-preload'));
ownership.set('scene-reflection', ['src/components/pixel-scenes/kanji-himeji.js', 'src/components/pixel-scenes/grammar-kinkakuji.js', 'tests/scene-reflection.test.ts', 'tools/check-route-scope.mjs']);
ownership.set('naetoru/scene-reflection', ownership.get('scene-reflection'));
ownership.set('grammar-formula', ['src/app/(study)/grammar/formula.ts', 'src/app/(study)/grammar/[id]/page.tsx', 'src/app/(study)/grammar/grammar.module.css', 'src/app/(study)/grammar/grammar.test.ts', 'tools/check-route-scope.mjs']);
ownership.set('naetoru/grammar-formula', ownership.get('grammar-formula'));
ownership.set('shadowing-controls', ['src/app/(study)/shadowing/', 'tests/shadowing-controls.test.ts', 'docs/features/g1-shadowing.md', 'tools/check-route-scope.mjs']);
ownership.set('naetoru/shadowing-controls', ownership.get('shadowing-controls'));
ownership.set('vocab-lesson', ['src/app/(study)/vocab/lesson/', 'tests/vocab-lesson.test.ts', 'docs/features/g1-vocab.md', 'tools/check-route-scope.mjs']);
ownership.set('naetoru/vocab-lesson', ownership.get('vocab-lesson'));
ownership.set('shared-chunk-dedup', ['next.config.ts', 'tools/check-route-scope.mjs']);
ownership.set('naetoru/shared-chunk-dedup', ownership.get('shared-chunk-dedup'));
ownership.set('kanji-lesson', ['src/app/(study)/vocab/lesson/kanji/', 'src/app/(study)/vocab/lesson/page.tsx', 'tests/kanji-lesson.test.ts', 'docs/features/g1-kanji.md', 'tools/check-route-scope.mjs']);
ownership.set('naetoru/kanji-lesson', ownership.get('kanji-lesson'));
ownership.set('lookup-popup', ['src/app/(study)/common-tools/', 'src/app/api/common-tools/lookup/', 'src/app/(study)/shadowing/', 'src/core/backup.ts', 'tests/lookup-popup.test.ts', 'docs/features/g1-common-tools.md', 'docs/features/g1-shadowing.md', 'tools/check-route-scope.mjs']);
ownership.set('naetoru/lookup-popup', ownership.get('lookup-popup'));
ownership.set('naetoru/grammar-confusables', ['src/app/(study)/grammar/', 'tests/grammar-confusables.test.ts', 'tools/check-route-scope.mjs']);
ownership.set('search-fts5', ['src/app/(study)/common-tools/repository.ts', 'src/app/(study)/common-tools/fts5.ts', 'tests/search-fts5.test.ts', 'tools/check-route-scope.mjs']);
ownership.set('naetoru/search-fts5', ownership.get('search-fts5'));
ownership.set('g1-ticks', ['docs/features/g1-foundation.md', 'docs/features/g1-grammar.md', 'tools/check-route-scope.mjs', 'docs/foundation-verification.md']);
ownership.set('naetoru/g1-ticks', ownership.get('g1-ticks'));
ownership.set('naetoru/vocab-notebook', ['src/app/(study)/vocab/', 'tests/vocab-notebook.test.ts', 'tools/check-route-scope.mjs']);
ownership.set('naetoru/vocab-notebook-sources', ['src/app/(study)/vocab/notebook/', 'src/app/(study)/common-tools/lookup-store.ts', 'src/app/(study)/common-tools/lookup-handler.ts', 'src/app/(study)/common-tools/lookup-popup-model.ts', 'src/app/(study)/common-tools/lookup-popup.tsx', 'src/app/(study)/common-tools/jlpt-lookup-stem.tsx', 'src/app/(study)/jlpt-daily/practice.tsx', 'src/app/(study)/jlpt-daily/browser-check.ts', 'tests/vocab-notebook.test.ts', 'tests/vocab-notebook-sources.test.ts', 'docs/features/g1-vocab.md', 'tools/check-route-scope.mjs']);
ownership.set('naetoru/vocab-examples', ['src/app/(study)/vocab/[id]/page.tsx', 'src/app/(study)/vocab/example-english.tsx', 'src/app/(study)/vocab/example-english.test.ts', 'src/app/(study)/vocab/vocab.module.css', 'tools/check-route-scope.mjs']);
ownership.set('naetoru/shadowing-history', ['src/app/(study)/shadowing/', 'src/app/api/shadowing/', 'src/core/backup.ts', 'tests/shadowing-history.test.ts', 'docs/features/g1-shadowing.md', 'tools/check-route-scope.mjs']);
ownership.set('naetoru/search-all-kinds', ['src/app/(study)/common-tools/', 'tests/search-all-kinds.test.ts', 'docs/features/g1-common-tools.md', 'tools/check-route-scope.mjs']);
ownership.set('naetoru/grammar-ticks', ['src/app/(study)/grammar/', 'tests/grammar-ticks.test.ts', 'docs/features/g1-grammar.md', 'tools/check-route-scope.mjs']);
ownership.set('naetoru/report-vi-line', ['src/core/content.ts', 'src/app/(study)/common-tools/', 'src/app/api/common-tools/reports/', 'src/app/(study)/vocab/notebook/page.tsx', 'src/app/(study)/vocab/lesson/kanji/card-body.tsx', 'src/app/(study)/kanji/page.tsx', 'src/app/(study)/kanji/[character]/page.tsx', 'src/app/(study)/grammar/page.tsx', 'src/app/(study)/grammar/[id]/page.tsx', 'src/app/(study)/srs/review-session.tsx', 'tests/report-vi-line.test.ts', 'docs/features/g1-common-tools.md', 'tools/check-route-scope.mjs']);
ownership.set('naetoru/lookup-latency', ['tools/lookup-latency-benchmark.ts', 'docs/features/g1-common-tools.md', 'tools/check-route-scope.mjs']);
ownership.set('naetoru/kanji-hanviet-goc', ['src/app/(study)/kanji/', 'src/app/(study)/vocab/lesson/kanji/', 'tests/kanji-hanviet-goc.test.ts', 'docs/features/g1-kanji.md', 'tools/check-route-scope.mjs']);
ownership.set('naetoru/clip-meta', ['src/app/(study)/shadowing/', 'tests/clip-meta.test.ts', 'docs/features/g1-shadowing.md', 'tools/check-route-scope.mjs']);
ownership.set('pokabu/roadmap-87w', ['src/app/(study)/today-roadmap/', 'tools/generate-roadmap.ts', 'docs/features/g1-today-roadmap.md', 'tools/check-route-scope.mjs']);
ownership.set('naetoru/import-g0-seed-hash', ['tools/import-g0.mjs', 'tests/import-g0.test.ts', 'tools/check-route-scope.mjs']);
ownership.set('naetoru/g1-tick-1126', ['docs/features/g1-common-tools.md', 'docs/features/g1-foundation.md', 'docs/features/g1-grammar.md', 'docs/features/g1-kanji.md', 'docs/features/g1-shadowing.md', 'docs/features/g1-today-roadmap.md', 'docs/features/g1-vocab.md', 'tools/check-route-scope.mjs']);
ownership.set('naetoru/shadowing-record-compare', ['src/app/(study)/shadowing/', 'tests/shadowing-record-compare.test.ts', 'docs/features/g1-shadowing.md', 'tools/check-route-scope.mjs']);
ownership.set('naetoru/shadowing-clip-maker', ['src/app/(study)/shadowing/', 'src/app/api/shadowing/', 'tests/shadowing-clip-maker.test.ts', 'docs/features/g1-shadowing.md', 'tools/check-route-scope.mjs']);
// PR #117 follow-up: exclude materialized source_id='jmdict' rows from JLPT /vocab & /kanji lists and label them 'Ngoài JLPT' on /vocab/[id] and /vocab/notebook.
ownership.set('naetoru/g1-jmdict-lookup', ['tools/import-jmdict.mjs', 'src/core/jmdict.ts', 'src/core/review.ts', 'src/app/(study)/common-tools/', 'src/app/(study)/vocab/data.ts', 'src/app/(study)/vocab/notebook/data.ts', 'src/app/(study)/kanji/repository.ts', 'tests/jmdict-lookup.test.ts', 'docs/features/g1-common-tools.md', 'tools/check-route-scope.mjs']);
ownership.set('naetoru/today-reminders', ['.env.example', 'public/sw.js', 'src/core/preferences.ts', 'src/core/push.ts', 'src/core/session.ts', 'src/server/auth.ts', 'src/server/dal.ts', 'src/server/maintenance.ts', 'src/server/reminders.ts', 'src/instrumentation.ts', 'src/app/api/settings/route.ts', 'src/app/api/push/subscription/route.ts', 'src/app/(study)/settings/settings-form.tsx', 'src/app/(study)/today-roadmap/model.ts', 'src/app/(study)/today-roadmap/settings.ts', 'src/app/(study)/today-roadmap/reminders.ts', 'src/app/(study)/today-roadmap/today.tsx', 'tests/today-reminders.test.ts', 'docs/features/g1-today-roadmap.md', 'tools/check-route-scope.mjs']);
ownership.set('pokabu/g1-data-gaps', ["src/core/content-supplement.ts","src/app/(study)/vocab/data.ts","src/app/(study)/grammar/repository.ts","src/app/(study)/grammar/[id]/page.tsx","src/app/(study)/kanji/repository.ts","src/app/(study)/kanji/[character]/page.tsx","src/app/(study)/vocab/lesson/kanji/model.ts","src/app/(study)/vocab/lesson/kanji/card-body.tsx","tools/report-content-gaps.mjs","tests/content-supplement.test.ts","tools/check-route-scope.mjs"]);
ownership.set('ui-motion', ['src/components/motion/', 'src/components/route-presentation.tsx', 'src/components/nav.tsx', 'src/components/add-to-review.tsx', 'src/components/route-heading.tsx', 'src/components/pixel-scenes/', 'src/app/layout.tsx', 'src/app/(study)/srs/page.tsx', 'src/app/(study)/srs/review-session.tsx', 'src/app/(study)/jlpt-daily/practice.tsx', 'src/app/(study)/shadowing/player.tsx', 'src/app/(study)/shadowing/voice-meter.tsx', 'src/app/(study)/common-tools/progress/page.tsx', 'src/app/(study)/today-roadmap/today.tsx', 'src/app/(study)/appearance/', 'tests/pixel-scenes.test.ts', 'tests/ui-motion.test.ts', 'tools/check-route-scope.mjs']);
ownership.set('pokabu/g1-grammar-exercises', ['src/core/content-supplement.ts', 'src/app/(study)/grammar/', 'tests/content-supplement.test.ts', 'tests/grammar-supplement.test.ts', 'tools/report-content-gaps.mjs', 'docs/features/g1-grammar.md', 'docs/features/g1-vocab.md', 'tools/check-route-scope.mjs']);
ownership.set('foundation', ['src/app/(study)/settings/', 'public/fonts/']);
ownership.set('ui-phase1', ['src/app/(study)/settings/', 'public/fonts/', 'src/components/town/', 'src/app/(study)/appearance/', 'src/app/(study)/today-roadmap/page.tsx', 'src/app/(study)/today-roadmap/today.module.css', 'src/core/day-period.ts', 'src/components/time-provider.tsx', 'tools/ui-test-clock.mjs', 'tests/day-period.test.ts']);
ownership.set('ui-phase2', ['src/app/(study)/today-roadmap/', 'src/app/(study)/srs/', 'src/app/(study)/shadowing/', 'src/app/(study)/appearance/', 'src/components/mascot.tsx', 'src/components/route-heading.tsx', 'public/mascots/']);
ownership.set('ui-phase3', ['src/app/(study)/vocab/', 'src/app/(study)/kanji/', 'src/app/(study)/grammar/', 'src/app/(study)/jlpt-daily/', 'src/app/(study)/common-tools/', 'src/app/(study)/sources/', 'src/app/(study)/settings/', 'src/app/(study)/today-roadmap/', 'src/app/(study)/appearance/', 'src/app/login/', 'src/components/route-presentation.tsx', 'src/components/route-heading.tsx', 'public/fonts/']);
if (!base || !branch) {
  console.error('Usage: node tools/check-route-scope.mjs BASE <g1/BRANCH|ROUTE>');
  process.exit(1);
}
if (!ownership.has(route)) {
  console.error(`Unknown G1 branch/route: ${branch}. Register its owned paths in tools/check-route-scope.mjs. Known routes: ${[...ownership.keys()].join(', ')}`);
  process.exit(1);
}
const shared = new Set([
  'AGENTS.md', 'tools/check-route-scope.mjs', 'tests/scope.test.ts',
  'docs/foundation-contracts.md', 'docs/features/g1-foundation.md',
  'src/app/(study)/page.tsx', 'src/app/(study)/layout.tsx',
  'src/app/layout.tsx', 'src/app/globals.css', 'src/app/manifest.ts',
  'src/proxy.ts', 'src/styles/tokens.css', 'src/components/nav.tsx',
  'src/components/shell.tsx', 'src/components/preferences-provider.tsx',
  'src/components/offline-manager.tsx', 'src/core/preferences.ts',
  'src/core/backup.ts', 'src/core/config.ts', 'src/server/preferences.ts',
  'src/server/maintenance.ts', 'src/server/http.ts', 'src/app/api/logout/route.ts',
  'src/app/api/settings/route.ts', 'src/app/api/backup/route.ts',
  'src/app/api/offline/route.ts', 'public/sw.js', 'public/offline.html',
  'tools/backup.ts', 'tools/subset-fonts.py', 'tools/test-app.ts',
  'tests/preferences.test.ts', 'tests/backup.test.ts', 'tests/offline.test.ts',
  'package.json', 'package-lock.json', '.env.example', '.gitignore',
]);
const files = execFileSync('git', ['diff', '--name-only', '--no-renames', '-z', `${base}...HEAD`], { encoding: 'utf8' }).split('\0').filter(Boolean);
const verification = 'docs/foundation-verification.md';
const allowed = file => file === verification || ownership.get(route).some(prefix => file.startsWith(prefix))
  || (['foundation','ui-phase1','ui-phase2','ui-phase3'].includes(route) && shared.has(file));
const outside = files.filter(file => !allowed(file));
if (files.includes(verification)) {
  const ancestor = execFileSync('git', ['merge-base', base, 'HEAD'], { encoding: 'utf8' }).trim();
  const before = execFileSync('git', ['show', `${ancestor}:${verification}`], { encoding: 'utf8' });
  const after = execFileSync('git', ['show', `HEAD:${verification}`], { encoding: 'utf8' });
  if (!after.startsWith(before)) outside.push(`${verification} (append-only: preserve prior entries)`);
}
if (outside.length) { console.error('Files outside route ownership:\n' + outside.join('\n')); process.exitCode = 1; }
else console.log(`PASS: ${files.length} changed files stay in ${route} ownership or the append-only verification log`);
