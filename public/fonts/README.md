# Local fonts

VT323 is also self-hosted under SIL OFL (`OFL.VT323.txt`); it is used only for
headings, numbers and controls. `tools/subset-fonts.py` checks every Vietnamese
letter found in public UI source against its subset. Japanese UI scene text
(商店街, 食堂, みどり駅, 神社, 学校, and time/greeting labels) lives in the
Shippori Mincho `Core` subset. Learning kana/kanji keep Shippori Mincho;
Vietnamese meanings keep Be Vietnam Pro.

Downloaded from the official [Google Fonts repository](https://github.com/google/fonts) on 2026-11-06.
Served locally; no Google Fonts request is made at runtime. Both families use SIL OFL 1.1;
the complete licenses are included beside the font files.

| File | Source under `ofl/` | SHA-256 |
| --- | --- | --- |
| BeVietnamPro-Regular.ttf | bevietnampro/BeVietnamPro-Regular.ttf | cd1ef6e9d7db28ad5cdb88a65ccbe693870e60d340b791f349d248342b4fe4c3 |
| BeVietnamPro-SemiBold.ttf | bevietnampro/BeVietnamPro-SemiBold.ttf | bd8e27eb02720b9d91e59e4f10a90878643219f25ce6a8d9a4f06a8a88d3bb71 |
| ShipporiMincho-Regular.ttf | shipporimincho/ShipporiMincho-Regular.ttf | 769b5269f0f9bc6534b352c0e6bd856a566e03ff788f107191c2d835863570b2 |

## Local subsets

Generated font-face rules in `src/styles/tokens.css` serve disjoint WOFF2 subsets
by `unicode-range`; `subsets.css` is their reproducible copy. Shippori Mincho is
split into 6 strictly disjoint WOFF2 subsets (`Core` for kana, punctuation and
UI/scene glyphs, plus `N5`–`N1` by public OpenJLPT level) so mobile pages only
download the subsets whose characters actually render on screen. The unchanged
TTF files remain as local fallbacks with strictly disjoint `unicode-range` for
future imports or rare characters outside the corpus. No remote font request is
needed, including offline. Both original OFL notices remain applicable; the
generated fonts preserve their embedded copyright and license names.

| Subset | Bytes | Unicode characters |
| --- | ---: | ---: |
| VT323-Regular-Subset.woff2 | 26,852 | 517 |
| BeVietnamPro-Regular-Subset.woff2 | 32,884 | 421 |
| BeVietnamPro-SemiBold-Subset.woff2 | 34,804 | 421 |
| ShipporiMincho-Regular-Core-Subset.woff2 | 83,048 | 600 |
| ShipporiMincho-Regular-N5-Subset.woff2 | 109,296 | 556 |
| ShipporiMincho-Regular-N4-Subset.woff2 | 88,216 | 414 |
| ShipporiMincho-Regular-N3-Subset.woff2 | 111,472 | 497 |
| ShipporiMincho-Regular-N2-Subset.woff2 | 89,532 | 376 |
| ShipporiMincho-Regular-N1-Subset.woff2 | 165,900 | 726 |

The 6 Shippori Mincho WOFF2 subsets cover all 3,169 corpus + UI characters
(647,464 bytes total across all buckets, vs 8,677,284 bytes for the original TTF),
while typical mobile core pages only download the 83,048-byte `Core` subset.
Latin/combining/Vietnamese ranges cover Vietnamese independently of current UI
strings. Japanese characters come from all public OpenJLPT JSON levels at commit
`0d1d3410bec90bd4098a7c72de820543cb4f707c`, plus kana and Japanese punctuation.
Private dictionaries, clips and subtitles were not used.

Rebuild from the repository root using Python with `fonttools[woff]==4.68.0`:

```powershell
python tools/subset-fonts.py --corpus /path/to/OpenJLPT/data/json
```

The generator verifies coverage after reopening each WOFF2 and asserts the test
specimen `Ộ Ệ Ờ Ữ Ỹ Đ 働 返 直 骨` plus UI scene glyphs. `subsets.json` records
original/output hashes, corpus hash and sizes. Browser and real-device rendering
still need visual checks; glyph coverage alone does not prove the appearance of
stacked Vietnamese marks.
