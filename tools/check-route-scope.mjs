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
  verification = 'docs/foundation-verification.md',
  outside = files.filter((file) => !file.startsWith(prefix) && file !== verification);
if (files.includes(verification)) {
  const ancestor = execFileSync('git', ['merge-base', base, 'HEAD'], { encoding: 'utf8' }).trim();
  const before = execFileSync('git', ['show', `${ancestor}:${verification}`], { encoding: 'utf8' });
  const after = execFileSync('git', ['show', `HEAD:${verification}`], { encoding: 'utf8' });
  if (!after.startsWith(before)) outside.push(`${verification} (append-only: preserve prior entries)`);
}
if (outside.length) {
  console.error('Files outside route ownership:\n' + outside.join('\n'));
  process.exitCode = 1;
} else console.log(`PASS: ${files.length} changed files stay in ${prefix} or the append-only verification log`);
