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
    """Build compact unicode-range for available - excluded that never overlaps excluded."""
    avail_sorted = sorted(available - excluded)
    excl_sorted = sorted(excluded)
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


def is_cjk(cp):
    return (
        0x3400 <= cp <= 0x4DBF
        or 0x4E00 <= cp <= 0x9FFF
        or 0xF900 <= cp <= 0xFAFF
        or 0x20000 <= cp <= 0x2FA1F
    )


def strings(value):
    if isinstance(value, str):
        yield value
    elif isinstance(value, dict):
        for item in value.values():
            yield from strings(item)
    elif isinstance(value, list):
        for item in value:
            yield from strings(item)


def build(directory, filename, points, output_name=None, bucket=None):
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
    output = directory / (output_name or (filename + '-Subset.woff2'))
    font.save(output)
    font.close()
    reopened = TTFont(output)
    assert set(reopened.getBestCmap()) >= selected, 'Lost requested font coverage'
    reopened.close()
    entry = {
        'source': original.name,
        'source_sha256': digest(original),
        'file': output.name,
        'sha256': digest(output),
        'source_bytes': original.stat().st_size,
        'bytes': output.stat().st_size,
        'unicode_count': len(selected),
    }
    if bucket is not None:
        entry['bucket'] = bucket
    return available, selected, entry


def shippori_buckets(corpus, japanese, ui_points, available):
    """Partition Shippori Mincho codepoints into disjoint Core + JLPT N5..N1 subsets."""
    target = japanese & available
    core = ({cp for cp in target if not is_cjk(cp)} | (ui_points & available)) & target
    seen = set(core)
    buckets = [('Core', core)]
    for level in ['n5', 'n4', 'n3', 'n2', 'n1']:
        level_points = set()
        for kind in ['kanji', 'vocab', 'grammar']:
            for file in sorted((corpus / kind).glob(f'*{level}*.json')):
                level_text = ''.join(strings(json.loads(file.read_text(encoding='utf-8-sig'))))
                level_points |= set(map(ord, unicodedata.normalize('NFC', level_text)))
        bucket_points = (level_points & target) - seen
        if level == 'n1':
            bucket_points |= target - seen
        buckets.append((level.upper(), bucket_points))
        seen |= bucket_points
    assert seen == target, 'Shippori buckets lost codepoints'
    return buckets


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
    ]:
        available, selected, result = build(directory, name, points)
        results.append(result)
        required = 'ỘỆỜỮỸĐ'
        if family == 'VT323':
            required += ''.join(ch for ch in ui_text if 0xC0 <= ord(ch) <= 0x024F or 0x1E00 <= ord(ch) <= 0x1EFF)
        assert set(map(ord, required)) <= selected, 'Missing required Vietnamese specimen'
        # The full original handles future imports and characters outside the subset
        # while staying strictly disjoint from WOFF2 subsets and missing UI characters.
        css.append(f"@font-face{{font-family:'{family}';src:url('/fonts/{name}.ttf') format('truetype');font-weight:{weight};font-style:normal;font-display:swap;unicode-range:{fallback_ranges(available, ui_points | selected)};}}")
        css.append(f"@font-face{{font-family:'{family}';src:url('/fonts/{result['file']}') format('woff2');font-weight:{weight};font-style:normal;font-display:swap;unicode-range:{ranges(selected)};}}")

    shippori_name = 'ShipporiMincho-Regular'
    shippori_family = 'Shippori Mincho'
    shippori_weight = '400 700'
    shippori_font = TTFont(directory / (shippori_name + '.ttf'), recalcTimestamp=False)
    shippori_available = set(shippori_font.getBestCmap())
    shippori_font.close()
    buckets = shippori_buckets(args.corpus, japanese, ui_points, shippori_available)
    shippori_selected_all = set()
    shippori_rules = []
    for label, bucket_points in buckets:
        if not bucket_points:
            continue
        output_name = f'{shippori_name}-{label}-Subset.woff2'
        _, selected, result = build(directory, shippori_name, bucket_points, output_name=output_name, bucket=label)
        assert selected.isdisjoint(shippori_selected_all), f'Overlapping Shippori bucket: {label}'
        shippori_selected_all |= selected
        results.append(result)
        shippori_rules.append(
            f"@font-face{{font-family:'{shippori_family}';src:url('/fonts/{result['file']}') format('woff2');font-weight:{shippori_weight};font-style:normal;font-display:swap;unicode-range:{ranges(selected)};}}"
        )
    required_ja = '商店街食堂ごはんみどり駅神社学校まちあさひるゆうがたよる今日も少しずつ働返直骨'
    assert set(map(ord, required_ja)) <= shippori_selected_all, 'Missing required Japanese specimen'
    assert set(map(ord, required_ja)) <= buckets[0][1], 'Required UI/specimen Japanese missing from Core bucket'
    css.append(
        f"@font-face{{font-family:'{shippori_family}';src:url('/fonts/{shippori_name}.ttf') format('truetype');font-weight:{shippori_weight};font-style:normal;font-display:swap;unicode-range:{fallback_ranges(shippori_available, ui_points | shippori_selected_all)};}}"
    )
    css.extend(shippori_rules)

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
                'fonts': results, 'fallback': 'Unmodified original local TTF for characters outside subsets (strictly disjoint unicode-range)'}
    (directory / 'subsets.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'fonts': results, 'specimens': 'PASS'}, ensure_ascii=False))


if __name__ == '__main__':
    main()
