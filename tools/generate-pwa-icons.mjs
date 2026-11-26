import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const repoRoot = path.resolve(import.meta.dirname, '..');
const sourceSvgPath = path.join(repoRoot, 'src/app/icon.svg');
const outDir = path.join(repoRoot, 'public/icons');

export const PWA_ICON_SPECS = [
  { file: 'icon-192.png', size: 192, mode: 'any' },
  { file: 'icon-512.png', size: 512, mode: 'any' },
  { file: 'icon-maskable-512.png', size: 512, mode: 'maskable', scale: 0.75 },
  { file: 'apple-touch-icon-180.png', size: 180, mode: 'apple', scale: 0.92 },
];

export function parseSourceIconSvg(svgText) {
  const fillMatch = svgText.match(/<rect\b[^>]*\bfill="([^"]+)"/i);
  const pathMatch = svgText.match(/<path\b[^>]*\/>/i);
  if (!fillMatch || !pathMatch) {
    throw new Error('src/app/icon.svg must contain a background <rect fill="..."> and foreground <path .../>');
  }
  return {
    background: fillMatch[1],
    foregroundPath: pathMatch[0],
  };
}

export function buildVariantSvg(sourceSvgText, spec) {
  const { background, foregroundPath } = parseSourceIconSvg(sourceSvgText);
  if (spec.mode === 'any') {
    return sourceSvgText.replace(
      /<svg\b([^>]*)>/i,
      `<svg$1 width="${spec.size}" height="${spec.size}">`,
    );
  }
  const scale = spec.scale ?? 1;
  const foreground =
    scale === 1
      ? foregroundPath
      : `<g transform="translate(32 32) scale(${scale}) translate(-32 -32)">${foregroundPath}</g>`;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${spec.size}" height="${spec.size}">`,
    `<rect width="64" height="64" fill="${background}"/>`,
    foreground,
    '</svg>',
  ].join('');
}

export async function generatePwaIcons() {
  const sourceSvgText = fs.readFileSync(sourceSvgPath, 'utf8').trim();
  const { background } = parseSourceIconSvg(sourceSvgText);
  fs.mkdirSync(outDir, { recursive: true });
  const results = [];
  for (const spec of PWA_ICON_SPECS) {
    const svg = buildVariantSvg(sourceSvgText, spec);
    let pipeline = sharp(Buffer.from(svg, 'utf8')).resize(spec.size, spec.size);
    if (spec.mode === 'maskable' || spec.mode === 'apple') {
      pipeline = pipeline.flatten({ background });
    }
    const targetPath = path.join(outDir, spec.file);
    const info = await pipeline
      .png({ compressionLevel: 9, adaptiveFiltering: true })
      .toFile(targetPath);
    results.push({
      file: `public/icons/${spec.file}`,
      width: info.width,
      height: info.height,
      channels: info.channels,
      bytes: info.size,
    });
  }
  return results;
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}` || process.argv[1]?.endsWith('generate-pwa-icons.mjs')) {
  const results = await generatePwaIcons();
  for (const item of results) {
    console.log(`${item.file}: ${item.width}x${item.height}, ${item.channels}ch, ${item.bytes} B`);
  }
}
