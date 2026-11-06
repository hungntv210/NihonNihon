import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
const files = ['tests', 'src/app'].flatMap((root) =>
  fs
    .readdirSync(root, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.test\.tsx?$/.test(entry.name))
    .map((entry) => `${entry.parentPath}/${entry.name}`),
);
const result = spawnSync(process.execPath, ['--import', 'tsx', '--test', ...files], {
  stdio: 'inherit',
});
process.exitCode = result.status ?? 1;
