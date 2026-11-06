import { execFileSync } from 'node:child_process';
const [base, route] = process.argv.slice(2);
if (!base || !['srs', 'vocab', 'kanji', 'grammar'].includes(route))
  throw Error('Usage: node tools/check-route-scope.mjs BASE ROUTE');
const files = execFileSync('git', ['diff', '--name-only', '--no-renames', '-z', `${base}...HEAD`], {
    encoding: 'utf8',
  })
    .split('\0')
    .filter(Boolean),
  prefix = `src/app/(study)/${route}/`,
  outside = files.filter((file) => !file.startsWith(prefix));
if (outside.length) {
  console.error('Files outside route ownership:\n' + outside.join('\n'));
  process.exitCode = 1;
} else console.log(`PASS: ${files.length} changed files stay in ${prefix}`);
