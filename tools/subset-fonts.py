"""Build local WOFF2 subsets from public OpenJLPT JSON; keep original OFL fonts.

python tools/subset-fonts.py --corpus /path/to/pinned/OpenJLPT/data/json
Requires fonttools[woff]. Never pass private learner media or subtitles as corpus.
"""
import argparse
import hashlib
import json
import unicodedata
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont


def digest(file):
    return hashlib.sha256(file.read_bytes()).hexdigest()


def ranges(points):
    result = []
    for value in sorted(points):
        if result and value == result[-1][1] + 1:
            result[-1][1] = value
        else:
            result.append([value, value])
    return ','.join(f'U+{a:X}' + (f'-{b:X}' if b != a else '') for a, b in result)


def fallback_ranges(available, excluded):
    avail_sorted = sorted(available - excluded)
    excl_sorted = sorted(excluded - available)
    result = []
    i = 0
    for cp in avail_sorted:
        if not result:
            result.append([cp, cp])
            continue
        prev_end = result[-1][1]
        while i < len(excl_sorted) and excl_sorted[i] <= prev_end:
            i += 1
        if i < len(excl_sorted) and excl_sorted[i] < cp:
            result.append([cp, cp])
        else:
            result[-1][1] = cp
    return ','.join(f'U+{a:X}' + (f'-{b:X}' if b != a else '') for a, b in result)


def strings(value):
    if isinstance(value, str):
        yield value
    elif isinstance(value, dict):
        for item in value.values():
            yield from strings(item)
    elif isinstance(value, list):
        for item in value:
            yield from strings(item)


def build(directory, filename, points):
    original = directory / (filename + '.ttf')
    font = TTFont(original, recalcTimestamp=False)
    available = set(font.getBestCmap())
    selected = points & available
    options = subset.Options()
    options.recalc_timestamp = False
    options.name_IDs = ['*']  # Preserve copyright, attribution and license metadata.
    options.name_legacy = True
    tool = subset.Subsetter(options=options)
    tool.populate(unicodes=selected)
    tool.subset(font)
    font.flavor = 'woff2'
    output = directory / (filename + '-Subset.woff2')
    font.save(output)
    font.close()
    reopened = TTFont(output)
    assert set(reopened.getBestCmap()) >= selected, 'Lost requested font coverage'
    reopened.close()
    return available, selected, {'source': original.name, 'source_sha256': digest(original),
                                 'file': output.name, 'sha256': digest(output),
                                 'source_bytes': original.stat().st_size, 'bytes': output.stat().st_size,
                                 'unicode_count': len(selected)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--corpus', required=True, type=Path)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    directory = root / 'public/fonts'
    files = sorted(args.corpus.rglob('*.json'))
    if not files or not all((args.corpus / name).is_dir() for name in ['vocab', 'kanji', 'grammar']):
        parser.error('--corpus must be the public OpenJLPT data/json directory')
    text = ''.join(s for f in files for s in strings(json.loads(f.read_text(encoding='utf-8-sig'))))
    # UI and the original scene are public source, never learner imports or private media.
    ui_text = unicodedata.normalize(
        'NFC',
        ''.join(
            f.read_text(encoding='utf-8-sig')
            for f in sorted((root / 'src').rglob('*'))
            if f.is_file() and f.suffix in ['.ts', '.tsx', '.js', '.jsx', '.css', '.json']
        ),
    )
    ui_points = set(map(ord, ui_text))
    latin = set(range(0x20, 0x250)) | set(range(0x300, 0x370)) | set(range(0x1E00, 0x1F00)) | set(range(0x2000, 0x2070))
    latin |= ui_points
    japanese = set(map(ord, unicodedata.normalize('NFC', text))) | set(range(0x20, 0x7F)) | set(range(0x3000, 0x3100)) | set(range(0xFF00, 0xFFF0))
    japanese |= ui_points
    css, results = [], []
    for name, family, weight, points in [
        ('VT323-Regular', 'VT323', '400', latin),
        ('BeVietnamPro-Regular', 'Be Vietnam Pro', '400', latin),
        ('BeVietnamPro-SemiBold', 'Be Vietnam Pro', '600 800', latin),
        ('ShipporiMincho-Regular', 'Shippori Mincho', '400 700', japanese),
    ]:
        available, selected, result = build(directory, name, points)
        results.append(result)
        required = '商店街食堂ごはんみどり駅神社学校まちあさひるゆうがたよる今日も少しずつ' if family == 'Shippori Mincho' else 'ỘỆỜỮỸĐ'
        if family == 'VT323':
            required += ''.join(ch for ch in ui_text if 0xC0 <= ord(ch) <= 0x024F or 0x1E00 <= ord(ch) <= 0x1EFF)
        assert set(map(ord, required)) <= selected, 'Missing required Vietnamese/Japanese specimen'
        # The full original handles future imports and characters outside the public corpus
        # while excluding UI characters missing from the TTF so browsers fall back to system fonts.
        css.append(f"@font-face{{font-family:'{family}';src:url('/fonts/{name}.ttf') format('truetype');font-weight:{weight};font-style:normal;font-display:swap;unicode-range:{fallback_ranges(available, ui_points)};}}")
        css.append(f"@font-face{{font-family:'{family}';src:url('/fonts/{result['file']}') format('woff2');font-weight:{weight};font-style:normal;font-display:swap;unicode-range:{ranges(selected)};}}")
    generated_css = '\n'.join(css) + '\n'
    (directory / 'subsets.css').write_text(generated_css, encoding='utf-8')
    tokens = root / 'src/styles/tokens.css'
    before, body = tokens.read_text(encoding='utf-8').split(':root {', 1)
    assert before.strip().startswith(("@import url('/fonts/subsets.css');", '/* Generated local font subsets.'))
    # Inline here: Tailwind expands before tokens, so a nested @import would be invalid CSS.
    tokens.write_text('/* Generated local font subsets. Rebuild with tools/subset-fonts.py. */\n'
                      + generated_css + ':root {' + body, encoding='utf-8')
    manifest = {'generator': 'fontTools', 'corpus': 'Public OpenJLPT JSON, all available levels',
                'corpus_sha256': hashlib.sha256(''.join(digest(f) for f in files).encode()).hexdigest(),
                'fonts': results, 'fallback': 'Unmodified original local TTF for characters outside subsets'}
    (directory / 'subsets.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'fonts': results, 'specimens': 'PASS'}, ensure_ascii=False))


if __name__ == '__main__':
    main()
