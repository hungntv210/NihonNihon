import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { ViText, JaText } from '../src/components/text.tsx';
import { SourceLabel } from '../src/components/source-label.tsx';
test('ViText and JaText retain separate language, fonts, NFC and React escaping', () => {
  const vi = renderToStaticMarkup(<ViText as="p">{'Ộ Ệ Ờ Ữ Ỹ Đ'.normalize('NFD')}</ViText>),
    ja = renderToStaticMarkup(<JaText>働 返 直 骨</JaText>);
  assert.ok(vi.includes('lang="vi"'));
  assert.ok(vi.includes('text-vi'));
  assert.ok(vi.includes('Ộ Ệ Ờ Ữ Ỹ Đ'));
  assert.ok(ja.includes('lang="ja"'));
  assert.ok(ja.includes('text-ja'));
  assert.ok(
    renderToStaticMarkup(<ViText>{'<script>alert(1)</script>'}</ViText>).includes('&lt;script&gt;'),
  );
});
test('source badges distinguish English fallback from machine output and AI Han Viet selection', () => {
  assert.ok(
    renderToStaticMarkup(<SourceLabel translation={null} />).includes('Bản Anh · OpenJLPT'),
  );
  const translation = {
    text: 'trường',
    sourceId: 'mt:test',
    sourceName: 'Synthetic',
    releaseId: 'r',
    method: 'machine',
    model: 'gemini-synthetic',
    promptVersion: 'test',
    autoSelected: true,
  };
  const html = renderToStaticMarkup(<SourceLabel translation={translation} />);
  assert.ok(html.includes('Tự chọn'));
  assert.ok(html.includes('gemini-synthetic'));
});
