# Local fonts

Downloaded from the official [Google Fonts repository](https://github.com/google/fonts) on 2026-11-06.
Served locally; no Google Fonts request is made at runtime. Both families use SIL OFL 1.1;
the complete licenses are included beside the font files.

| File | Source under `ofl/` | SHA-256 |
| --- | --- | --- |
| BeVietnamPro-Regular.ttf | bevietnampro/BeVietnamPro-Regular.ttf | cd1ef6e9d7db28ad5cdb88a65ccbe693870e60d340b791f349d248342b4fe4c3 |
| BeVietnamPro-SemiBold.ttf | bevietnampro/BeVietnamPro-SemiBold.ttf | bd8e27eb02720b9d91e59e4f10a90878643219f25ce6a8d9a4f06a8a88d3bb71 |
| ShipporiMincho-Regular.ttf | shipporimincho/ShipporiMincho-Regular.ttf | 769b5269f0f9bc6534b352c0e6bd856a566e03ff788f107191c2d835863570b2 |

## Local subsets

Generated font-face rules in `src/styles/tokens.css` serve WOFF2 subsets first;
`subsets.css` is their reproducible copy. The unchanged TTF files remain as local
fallbacks for future imports or characters outside the corpus. No remote font
request is needed, including offline. Both original OFL notices remain applicable;
the generated fonts preserve their embedded copyright and license names.

| Subset | Bytes | Unicode characters |
| --- | ---: | ---: |
| BeVietnamPro-Regular-Subset.woff2 | 32,884 | 421 |
| BeVietnamPro-SemiBold-Subset.woff2 | 34,804 | 421 |
| ShipporiMincho-Regular-Subset.woff2 | 585,420 | 3,130 |

The three subsets total 653,108 bytes, compared with 8,946,968 bytes of originals.
Latin/combining/Vietnamese ranges cover Vietnamese independently of current UI
strings. Japanese characters come from all public OpenJLPT JSON levels at commit
`0d1d3410bec90bd4098a7c72de820543cb4f707c`, plus kana and Japanese punctuation.
Private dictionaries, clips and subtitles were not used.

Rebuild from the repository root using Python with `fonttools[woff]==4.68.0`:

```powershell
python tools/subset-fonts.py --corpus /path/to/OpenJLPT/data/json
```

The generator verifies coverage after reopening each WOFF2 and asserts the test
specimen `Ộ Ệ Ờ Ữ Ỹ Đ 働 返 直 骨`. `subsets.json` records original/output hashes,
corpus hash and sizes. Browser and real-device rendering still need visual checks;
glyph coverage alone does not prove the appearance of stacked Vietnamese marks.
