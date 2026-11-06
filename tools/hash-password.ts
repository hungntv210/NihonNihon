import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { hashPassword } from '../src/core/session.ts';
if (!process.stdin.isTTY) {
  console.error('Run interactively so the password is not written in shell history.');
  process.exit(1);
}
let muted = false;
const output = new Writable({
  write(chunk, _encoding, callback) {
    if (!muted) process.stdout.write(chunk);
    callback();
  },
});
const input = createInterface({ input: process.stdin, output, terminal: true });
try {
  process.stdout.write('Mật khẩu mới (ít nhất 12 ký tự, được ẩn): ');
  muted = true;
  const first = await input.question('');
  process.stdout.write('\nNhập lại: ');
  const second = await input.question('');
  process.stdout.write('\n');
  if (first.normalize('NFC') !== second.normalize('NFC'))
    throw new Error('Hai lần nhập không trùng nhau.');
  console.log('Dán dòng này vào .env.local; không commit tệp đó:');
  console.log('NIHON_PASSWORD_HASH=' + hashPassword(first));
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Không tạo được mật khẩu');
  process.exitCode = 1;
} finally {
  input.close();
}
