import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { parseArgs } from 'node:util';

export function need(condition, message) { if (!condition) throw new Error(message); }
export const hash = value => createHash('sha256').update(value).digest('hex');
export const sha = value => hash(stable(value));
export function stable(value) {
  if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).filter(k=>value[k]!==undefined).sort().map(k => JSON.stringify(k) + ':' + stable(value[k])).join(',') + '}';
  return JSON.stringify(value) ?? 'null';
}
export function nfc(value) {
  if (typeof value === 'string') return value.normalize('NFC');
  if (Array.isArray(value)) return value.map(nfc);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k,v]) => [k,nfc(v)]));
  return value;
}
export const list = v => v == null ? [] : Array.isArray(v) ? v : [v];
export const text = v => typeof v === 'object' && v !== null ? String(v['#text'] ?? '') : String(v ?? '');
export const nonempty = v => typeof v === 'string' && v.trim().length > 0;
export const now = () => new Date().toISOString();
export const keyFor = (kind,row) => kind === 'kanji' ? 'U+' + row.character.codePointAt(0).toString(16).toUpperCase().padStart(4,'0') : row.id;
export const itemId = (kind,row) => `openjlpt:${kind}:${keyFor(kind,row)}`;
export function decode(bytes, file) {
  const raw = file.compression === 'gzip' ? gunzipSync(bytes, {maxOutputLength:512*1024*1024}) : bytes;
  return new TextDecoder(file.encoding || 'utf-8', {fatal:true}).decode(raw).replace(/^\uFEFF/,'');
}
export function privateWrite(file, data) {
  fs.mkdirSync(path.dirname(file),{recursive:true});
  const temp = file + '.tmp-' + process.pid;
  fs.writeFileSync(temp,data,{mode:0o600}); fs.renameSync(temp,file);
}
export function args(options) {
  return parseArgs({ options:Object.fromEntries(options.map(n => [n,{type:['require-complete','batch'].includes(n)?'boolean':'string'}])) }).values;
}
export async function loadArtifacts(manifestPath) {
  const base = path.dirname(path.resolve(manifestPath));
  const manifest = JSON.parse(fs.readFileSync(manifestPath,'utf8'));
  need(manifest.version===1 && Array.isArray(manifest.sources) && manifest.sources.length>0, 'Manifest version 1 and sources are required');
  const artifacts=[], sources=new Set();
  for (const source of manifest.sources) {
    need(nonempty(source.source_id) && !sources.has(source.source_id),'Duplicate/missing source_id'); sources.add(source.source_id);
    for (const k of ['name','url','license','version','attribution']) need(nonempty(source[k]),`${source.source_id}: missing ${k}`);
    need(['redistributable','private_only'].includes(source.usage_scope),`${source.source_id}: unverified usage scope`);
    need(Array.isArray(source.files) && source.files.length>0,`${source.source_id}: files required`);
    for (const file of source.files) {
      need(/^[0-9a-f]{64}$/.test(file.sha256 || ''),'Each artifact needs a pinned lowercase SHA-256');
      need(nonempty(file.path) && nonempty(file.format),'Artifact path and format required');
      need(!file.compression || file.compression==='gzip','Extract ZIP archives privately and pin the extracted artifact, or use gzip');
      const local = path.resolve(base,file.path);
      if (!fs.existsSync(local)) {
        need(nonempty(file.url),`Missing local artifact: ${file.path}`);
        const url = new URL(file.url); need(url.protocol==='https:' && !url.username && !url.password,'Downloads require credential-free HTTPS');
        const response = await fetch(url,{signal:AbortSignal.timeout(60000)}); need(response.ok,`Download HTTP ${response.status}`);
        const bytes = Buffer.from(await response.arrayBuffer()); need(hash(bytes)===file.sha256,'Download checksum mismatch'); privateWrite(local,bytes);
      }
      const bytes = fs.readFileSync(local); need(hash(bytes)===file.sha256,`Checksum mismatch: ${file.path}`);
      const release_id = `${source.source_id}:${sha({version:source.version,sha256:file.sha256,format:file.format,level:file.level ?? null,variant:file.variant ?? null,encoding:file.encoding || 'utf-8',compression:file.compression || null}).slice(0,32)}`;
      artifacts.push({ source,file,local,base,release_id,body:decode(bytes,file) });
    }
  }
  return {manifest,base,artifacts,manifestHash:sha(manifest)};
}
