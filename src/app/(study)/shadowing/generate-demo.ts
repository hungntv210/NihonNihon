// Rerun only when intentionally replacing the public, synthetic fixture.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
const chrome = process.env.CHROME_PATH ?? (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined);
const browser = await chromium.launch({ headless: true, ...(chrome && fs.existsSync(chrome) ? { executablePath: chrome } : {}), args: ['--autoplay-policy=no-user-gesture-required'] });
try {
  const page = await browser.newPage();
  await page.addInitScript('globalThis.__name = (value) => value');
  await page.goto('about:blank');
  const bytes = await page.evaluate(async () => {
    const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 360;
    const context = canvas.getContext('2d')!;
    const audio = new AudioContext(); await audio.resume();
    const destination = audio.createMediaStreamDestination();
    const stream = canvas.captureStream(15);
    for (const track of destination.stream.getAudioTracks()) stream.addTrack(track);
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8,opus', videoBitsPerSecond: 160000 });
    const chunks: Blob[] = [];
    recorder.ondataavailable = event => chunks.push(event.data);
    const result = new Promise<number[]>(resolve => { recorder.onstop = async () => resolve(Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer()))); });
    const began = performance.now();
    const draw = () => {
      const seconds = Math.min(8.99, (performance.now() - began) / 1000), segment = Math.floor(seconds / 3);
      context.fillStyle = '#24332d'; context.fillRect(0, 0, 640, 360);
      context.fillStyle = '#ead5b4'; context.font = '18px sans-serif'; context.textAlign = 'center'; context.fillText('SYNTHETIC DEMO / TONES ONLY', 320, 62);
      context.fillStyle = '#ffffff'; context.font = '64px sans-serif'; context.fillText(`0${segment + 1}`, 320, 190);
      context.font = '18px sans-serif'; context.fillText('No Japanese speech / Not training media', 320, 250);
      context.fillStyle = '#8eb19a'; context.fillRect(64, 300, 512 * (seconds / 9), 5);
    };
    draw(); recorder.start();
    const interval = setInterval(draw, 60);
    for (let index = 0; index < 3; index++) {
      const tone = audio.createOscillator(), gain = audio.createGain();
      tone.frequency.value = 440 + index * 110; gain.gain.value = 0.06;
      tone.connect(gain).connect(destination); tone.start(audio.currentTime + index * 3); tone.stop(audio.currentTime + index * 3 + 0.18);
    }
    await new Promise(resolve => setTimeout(resolve, 9000));
    recorder.stop(); clearInterval(interval); stream.getTracks().forEach(track => track.stop()); await audio.close();
    return result;
  });
  // MediaRecorder's streaming WebM omits duration. Insert it into the existing Info element.
  const input = Buffer.from(bytes), marker = Buffer.from([0x15, 0x49, 0xa9, 0x66]);
  const info = input.indexOf(marker), sizeOffset = info + 4;
  if (info < 0) throw Error('WebM Info missing');
  const width = Math.clz32(input[sizeOffset]) - 24 + 1;
  let size = input[sizeOffset] & (0xff >> width);
  for (let index = 1; index < width; index++) size = size * 256 + input[sizeOffset + index];
  const duration = Buffer.alloc(11); duration.set([0x44, 0x89, 0x88]); duration.writeDoubleBE(9000, 3);
  const newSize = size + duration.length;
  const encoded = Buffer.alloc(width); let remaining = newSize;
  for (let index = width - 1; index >= 0; index--) { encoded[index] = remaining & 255; remaining = Math.floor(remaining / 256); }
  if (remaining || encoded[0] >= 1 << (8 - width)) throw Error('WebM Info size overflow');
  encoded[0] |= 1 << (8 - width);
  const end = sizeOffset + width + size;
  const output = Buffer.concat([input.subarray(0, sizeOffset), encoded, input.subarray(sizeOffset + width, end), duration, input.subarray(end)]);
  fs.writeFileSync(path.resolve('src/app/(study)/shadowing/demo.webm'), output);
  console.log(`Generated synthetic canvas + tones fixture: ${output.length} bytes`);
} finally { await browser.close(); }
