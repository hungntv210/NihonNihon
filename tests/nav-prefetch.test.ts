import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { registerHooks } from 'node:module';
import { isValidElement, type ReactElement } from 'react';
import Link from 'next/link';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.endsWith('.css')) {
      return { url: 'data:text/javascript,export%20default%20%7B%7D;', shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});

const { Shell } = await import('../src/components/shell.tsx');

type LinkProps = {
  href?: string;
  prefetch?: boolean | null;
  className?: string;
  'aria-label'?: string;
  children?: unknown;
};

function collectLinks(node: unknown, out: Array<ReactElement<LinkProps>> = []): Array<ReactElement<LinkProps>> {
  if (Array.isArray(node)) {
    for (const child of node) collectLinks(child, out);
    return out;
  }
  if (!isValidElement(node)) return out;
  if (node.type === Link) {
    out.push(node as ReactElement<LinkProps>);
  }
  const props = node.props as { children?: unknown } | undefined;
  if (props?.children !== undefined) {
    collectLinks(props.children, out);
  }
  return out;
}

function textContent(node: unknown): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textContent).join('');
  if (isValidElement(node)) {
    const props = node.props as { children?: unknown } | undefined;
    return textContent(props?.children);
  }
  return '';
}

test('Shell renders every menu Link with prefetch={false} and expected hrefs', () => {
  const tree = Shell({ children: 'Nội dung thử', reviewCount: 7 });
  const links = collectLinks(tree);

  assert.equal(links.length, 9, 'Shell should render all 9 expected menu <Link> elements');

  const expected = [
    { href: '/', ariaLabel: 'Nihon Nihon — Hôm nay' },
    { href: '/settings', text: 'Cài đặt' },
    { href: '/sources', text: 'Nguồn dữ liệu ↗' },
    { href: '/settings', text: 'Cài đặt' },
    { href: '/sources', text: 'Nguồn dữ liệu' },
    { href: '/srs', text: '7 thẻ trong hàng ôn' },
    { href: '/shadowing', text: 'Shadowing' },
    { href: '/common-tools/reports', text: 'Báo sai' },
    { href: '/common-tools/progress', text: 'Tiến độ' },
  ];

  assert.deepEqual(
    links.map((el) => el.props.href),
    expected.map((item) => item.href),
  );

  for (const [index, el] of links.entries()) {
    assert.strictEqual(
      el.props.prefetch,
      false,
      `Shell <Link> #${index + 1} (${String(el.props.href)}) must explicitly set prefetch={false}`,
    );
    const spec = expected[index];
    if ('ariaLabel' in spec && spec.ariaLabel) {
      assert.equal(el.props['aria-label'], spec.ariaLabel);
    }
    if ('text' in spec && spec.text) {
      assert.equal(textContent(el.props.children).trim(), spec.text);
    }
  }
});

test('src/components/shell.tsx has no <Link> tag without prefetch={false}', () => {
  const src = fs.readFileSync('src/components/shell.tsx', 'utf8');
  const tags = src.match(/<Link\b[^>]*>/g) ?? [];
  assert.equal(tags.length, 9);
  for (const tag of tags) {
    assert.match(tag, /\bprefetch=\{false\}/, `Missing prefetch={false} on: ${tag}`);
  }
});
