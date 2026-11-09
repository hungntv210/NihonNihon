import { execFileSync } from 'node:child_process';
const [base, branch] = process.argv.slice(2);
const route = branch?.startsWith('g1/') ? branch.slice(3) : branch;
// Authoritative branch-to-path registry; CI passes the full branch without another allowlist.
const ownership = new Map(
  ['srs', 'vocab', 'kanji', 'grammar', 'today-roadmap', 'shadowing', 'common-tools']
    .map(name => [name, [`src/app/(study)/${name}/`]]),
);
ownership.set('jlpt-daily', ['src/app/(study)/jlpt-daily/', 'src/app/(study)/jlpt/']);
ownership.set('foundation', ['src/app/(study)/settings/', 'public/fonts/']);
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
  || (route === 'foundation' && shared.has(file));
const outside = files.filter(file => !allowed(file));
if (files.includes(verification)) {
  const ancestor = execFileSync('git', ['merge-base', base, 'HEAD'], { encoding: 'utf8' }).trim();
  const before = execFileSync('git', ['show', `${ancestor}:${verification}`], { encoding: 'utf8' });
  const after = execFileSync('git', ['show', `HEAD:${verification}`], { encoding: 'utf8' });
  if (!after.startsWith(before)) outside.push(`${verification} (append-only: preserve prior entries)`);
}
if (outside.length) { console.error('Files outside route ownership:\n' + outside.join('\n')); process.exitCode = 1; }
else console.log(`PASS: ${files.length} changed files stay in ${route} ownership or the append-only verification log`);
