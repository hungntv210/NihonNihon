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
ownership.set('pokabu/jlpt-week30-fix', ['src/app/(study)/jlpt-daily/', 'tools/check-route-scope.mjs']);
ownership.set('pokabu/jlpt-verifier-count', ['src/app/(study)/jlpt-daily/', 'tools/check-route-scope.mjs']);
ownership.set('pokabu/jlpt-qa-hardening', ['src/app/(study)/jlpt-daily/', 'tools/check-route-scope.mjs']);
ownership.set('pokabu/jlpt-qa-hardening-2', ['src/app/(study)/jlpt-daily/', 'tools/check-route-scope.mjs']);
ownership.set('rain-clarity', ['src/components/pixel-scenes/', 'src/app/(study)/appearance/daily-weather/', 'tests/daily-weather.test.ts', 'tools/check-route-scope.mjs']);
ownership.set('daily-weather', ['src/components/pixel-scenes/', 'src/app/login/', 'src/app/(study)/appearance/', 'tests/daily-weather.test.ts', 'tools/ui-test-clock.mjs', 'tools/check-route-scope.mjs']);
ownership.set('login-portrait', ['src/app/login/login.module.css', 'src/components/pixel-scenes/', 'src/app/(study)/appearance/login-festivals/', 'tests/login-portrait.test.ts', 'tools/check-route-scope.mjs']);
ownership.set('login-festivals', ['src/app/login/', 'src/components/pixel-scenes/', 'src/app/(study)/appearance/', 'tests/login-festivals.test.ts', 'tools/check-route-scope.mjs']);
ownership.set('pixel-scenes-next', ['src/components/pixel-scenes/', 'src/app/(study)/vocab/page.tsx', 'src/app/(study)/grammar/page.tsx', 'src/app/(study)/jlpt-daily/page.tsx', 'src/app/(study)/jlpt-daily/practice.tsx', 'src/app/(study)/today-roadmap/page.tsx', 'src/app/(study)/appearance/', 'tests/pixel-scenes.test.ts', 'tests/pixel-scenes-next.test.ts', 'tools/check-route-scope.mjs']);
ownership.set('mobile-perf', ['tools/perf-mobile.mjs', 'package.json', 'tools/check-route-scope.mjs']);
ownership.set('naetoru/mobile-perf', ownership.get('mobile-perf'));
ownership.set('font-perf', ['tools/subset-fonts.py', 'public/fonts/', 'src/styles/tokens.css', 'src/components/pixel-scenes/engine.js', 'tests/pixel-scenes.test.ts', 'tools/check-route-scope.mjs']);
ownership.set('naetoru/font-perf', ownership.get('font-perf'));
ownership.set('roadmap-perf', ['src/components/pixel-scenes/roadmap-journey.js', 'src/components/pixel-scenes/scene.module.css', 'src/app/(study)/today-roadmap/', 'tests/pixel-scenes-next.test.ts', 'tools/check-route-scope.mjs']);
ownership.set('naetoru/roadmap-perf', ownership.get('roadmap-perf'));
ownership.set('ui-motion', ['src/components/motion/', 'src/components/route-presentation.tsx', 'src/components/nav.tsx', 'src/components/add-to-review.tsx', 'src/components/route-heading.tsx', 'src/components/pixel-scenes/', 'src/app/layout.tsx', 'src/app/(study)/srs/page.tsx', 'src/app/(study)/srs/review-session.tsx', 'src/app/(study)/jlpt-daily/practice.tsx', 'src/app/(study)/shadowing/player.tsx', 'src/app/(study)/shadowing/voice-meter.tsx', 'src/app/(study)/common-tools/progress/page.tsx', 'src/app/(study)/today-roadmap/today.tsx', 'src/app/(study)/appearance/', 'tests/pixel-scenes.test.ts', 'tests/ui-motion.test.ts', 'tools/check-route-scope.mjs']);
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
