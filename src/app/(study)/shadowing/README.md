# Shadowing · private clips and interaction demo

Open `/shadowing` after signing in. The route ships **one public,
synthetic 9-second canvas video with three quiet tones, no Japanese speech**.
The Japanese/Vietnamese sentences are original test captions, not transcriptions
or learning content. The UI labels this throughout. No TTS, remote AI,
copyrighted clip, personal recording or private data is committed.

Implemented: full clip playback; choose one of three timed segments; 1/3/5/infinite
segment repeats; 0.5/0.75/1/1.25× playback preserving pitch where the browser
supports it; Japanese/Vietnamese/both/hidden captions; native microphone capture,
stop, replay, download and delete. Captures automatically stop after 60 seconds.
Playing the original pauses replay; recording pauses both. Microphone tracks stop
on completion, errors and React unmount. Replaced/deleted/unmounted blob URLs are
revoked. Permission denial, unsupported APIs and playback errors show feedback.

Recordings live **only in browser memory, separately for each sentence**. A new take replaces the previous take for that sentence;
leaving/reloading the route loses it. Download before leaving if needed. Nothing
is uploaded or synced. No recording storage endpoint or database schema change.
Demo activity never writes valid shadowing sessions, progress, weekly quotas or
roadmap unlocks. This does not satisfy the full v1 specification yet.

## Optional private YouTube clip

Put the channel metadata and manual captions in the gitignored
`data/private/youtube-clip.json` (or set `NIHON_YOUTUBE_CLIP_PATH`).
The server reads this file at request time; when absent, it omits the YouTube clip.
The same validated metadata format carries video ID, attribution, license,
clip bounds and timed JA/kana/VI segments. Never commit channel captions,
caption review tables or private metadata. Tests use original synthetic captions.

The embed and IFrame API load only after **Mở trình phát YouTube**.
The iframe sets `referrerpolicy="strict-origin-when-cross-origin"` before
navigation, allowing an origin-only cross-site Referer while retaining the
site's existing header. YouTube error153 denotes a missing Referer/client identity:
https://developers.google.com/youtube/iframe_api_reference#onError
No video/audio is downloaded. Live playback and phone acceptance need owner review.

## Nhập cục bộ kho IRODORI theo cấp (offline importer)

Công cụ `tools/import-irodori.ts` nhập các đoạn hội thoại **IRODORI: Japanese for Life in Japan** (Japan Foundation) mà người dùng tự tải về máy vào kho Shadowing riêng tư trên máy chủ nhà. **Không tự tải từ Internet**, **không commit audio/script vào repo**, và **không đưa vào `public/`**.

### 1. Tải dữ liệu IRODORI về máy (người dùng tự thực hiện)

1. Mở trang chính thức của Japan Foundation: `https://www.irodori.jpf.go.jp/` (chỉ sử dụng cho mục đích học cá nhân, tuân thủ điều khoản của Japan Foundation).
2. Tải gói âm thanh (`.mp3` / `.wav` / `.m4a` / `.ogg` / `.webm`, tối đa 8 MB/tệp) và phụ đề/script (`.srt`, `.vtt`, `.ass`, `.txt` hoặc `.json`) cho các tập muốn luyện:
   - **A1** (Starter / 入門) → tự ánh xạ sang cấp **N5**
   - **A2-1** (Elementary 1 / 初級1) và **A2-2** (Elementary 2 / 初級2) (hoặc thư mục `A2/`) → tự ánh xạ sang cấp **N4**
   - **B1** (mở rộng trung cấp / 中級, nếu có) → tự ánh xạ sang cấp **N3**
3. Giải nén vào thư mục bị gitignore mặc định `data/private/irodori/` (hoặc bất kỳ thư mục cục bộ nào và chỉ định qua `--dir` hoặc biến môi trường `NIHON_IRODORI_DIR`).

### 2. Cấu trúc thư mục hỗ trợ

**Cách A — Quét theo thư mục cấp độ (không cần viết JSON):**

```text
data/private/irodori/
├── A1/
│   ├── 01-chao-hoi/
│   │   ├── L01-01.mp3
│   │   └── L01-01.srt          # hỗ trợ .json / .srt / .vtt / .ass / .txt cùng tên
├── A2-1/
│   └── 03-di-tau/
│       ├── L03-02.mp3
│       └── L03-02.vtt
├── A2-2/
│   └── ...
└── B1/
    └── ...
```

**Cách B — Khai báo tường minh bằng `manifest.json` (hoặc `clips.json`):**

Đặt `manifest.json` ngay tại gốc `data/private/irodori/` hoặc trong từng thư mục cấp (`A1/manifest.json`, `A2-1/manifest.json`, `B1/manifest.json`):

```json
{
  "clips": [
    {
      "id": "a1-l01-01",
      "level": "A1",
      "title": "Bài 1 · Tự giới thiệu",
      "topic": "Chào hỏi và giới thiệu",
      "audio": "A1/L01-01.mp3",
      "subtitle": "A1/L01-01.srt",
      "tags": ["chao-hoi"],
      "roadmapWeek": 2
    }
  ]
}
```

Mỗi mục có thể dùng `subtitle` trỏ tới `.srt`/`.vtt`/`.ass`/`.txt`/`.json` hoặc khai báo mảng `segments` trực tiếp (`startMs`/`endMs`/`ja`/`kana`/`vi`/`speaker`). Đường dẫn ngoài thư mục gốc hoặc symlink đều bị chặn để chống path traversal.

### 3. Chạy thử (`--dry-run`) và nhập thật

```powershell
# Kiểm tra cấu trúc và in số lượng clip theo từng cấp (KHÔNG ghi tệp)
node --import tsx tools/import-irodori.ts --dir data/private/irodori --dry-run

# Nhập thật vào kho Shadowing cục bộ (idempotent: chạy lại không tạo bản trùng)
node --import tsx tools/import-irodori.ts --dir data/private/irodori

# Chỉ nhập một hoặc nhiều cấp cụ thể
node --import tsx tools/import-irodori.ts --dir data/private/irodori --level A1,A2

# Hoặc dùng biến môi trường NIHON_IRODORI_DIR và xuất JSON
$env:NIHON_IRODORI_DIR = "data/private/irodori"
node --import tsx tools/import-irodori.ts --dry-run --json
```

Khi nhập thật, mỗi clip được xác thực định dạng + magic bytes + khoảng 10–60 giây, lưu audio vào thư mục riêng tư `data/private/shadowing-media/` kèm SHA-256, tự bổ sung furigana/tag/tuần lộ trình offline (khi có DB cục bộ; có thể tắt bằng `--no-auto-meta`), và xuất hiện ngay trên `/shadowing` với đủ 7 trường metadata (tiêu đề, nguồn `IRODORI ...`, cấp `N5`/`N4`/`N3`, chủ đề, số câu, tốc độ nói `ký tự/s`, `% từ đã biết`).

## Verification

From the repository root, Node 24+, existing dependencies:

```powershell
npm run check
node tools/check-route-scope.mjs origin/master shadowing
npm run test:browser
node --import tsx 'src/app/(study)/shadowing/browser-check.ts'
```

Use the repository's authoritative scope registry. Commit implementation first, run the full gates on
that commit, then append the exact SHA and results to the verification log.

The browser check starts an isolated production server and demo database, checks
auth and byte ranges, playback/segment repeats, rate/subtitles, native fake-device
recording/replay/download, permission rejection, track cleanup and blob revocation,
and desktop/mobile overflow. Windows uses installed Chrome or `CHROME_PATH`,
otherwise Playwright Chromium. Reports/screenshots stay in ignored `data/reports`.
Fake-device desktop coverage does not establish real Android/iOS compatibility.

Regenerate the synthetic fixture intentionally with:

```powershell
node --import tsx 'src/app/(study)/shadowing/generate-demo.ts'
```

This uses local Chrome canvas capture + oscillator tones; it calls no external
service. Commit the resulting `demo.webm` only after running the checks again.
The authenticated media handler supports byte-range seeking, never public cache.

## Next content and host handoff

The chosen host is the owner's home machine with **Tailscale Serve HTTPS**. Expose
the existing authenticated app only within the owner's tailnet. Microphone access
requires a secure context; plain LAN HTTP is insufficient. Localhost is allowed
for development. Confirm the final HTTPS origin in `APP_ORIGIN`, browser microphone
permission and PWA behavior on physical Chrome Android and Safari iOS. This branch
does not claim that host deployment, DNS/Tailscale configuration or hardware tests
have happened.

Keep a backup **off the host machine** and verify restore. The foundation backup
already includes its configured private recordings directory; this route's
in-memory takes are not in that archive. Downloaded takes need a private backup
if the owner chooses to retain them. Neither downloads nor archives go in git.

Acceptance requires three owner-provided/legal sources: one Erin clip, one
personal file and one YouTube clip. The base branch supports Erin; this change adds
the first YouTube clip, while the separate personal file is still missing. Keep private
media on the authenticated home server, outside git. YouTube is **embed
URL + start/end times only, never download/extract audio**. Source onboarding,
private recording persistence, clip editing, TTS, word lookup,
SRS integration, A–B editing, pause-to-speak, keyboard shortcuts, pitch/scoring and
the four-condition valid-session counter are deferred. They need separate scoped
work and real media; do not report this demo as three real clips or completed study.

## Private file onboarding

Import into the app's own `demo.sqlite`, using the G0 importer described in
`docs/data/importer.md` section 4 on `g0/data-import`. Do not write to the Frozen
snapshot. Use source `user-media`, `usage_scope=private_only`, `origin.kind=file`,
the file's SHA-256, attribution and license. Every revision keeps its original
immutable clip manifest; each segment may additionally store `kana` and `speaker`
Keep IDs stable across timing revisions. Timings must be integer milliseconds,
ordered, non-overlapping, end > start, and within the explicit clip range.
The manifest must include `clip_start_ms` and `clip_end_ms` in source-file time;
the range must span 10–60 seconds and stay within `duration_ms`. Every sentence
must stay within it. Changing clip bounds creates an import revision and does
not require moving approved/proposed sentence boundaries.
Use absolute file paths or paths relative to the clips JSON. Keep the media,
manifest, scripts, SRTs, comparison reports and databases outside git and public/.

The authenticated page lists imported active private clips beside the demo.
The server reads metadata only; client props never contain filesystem paths.
The media handler validates the file SHA-256 before serving authenticated ranges;
an optional `NIHON_SHADOWING_MEDIA_ROOT` confines files to a chosen local directory.
Wrong hashes, missing files and non-clip IDs cannot be served. Nothing is copied
to public/ or sent to remote AI. Playback is bounded to the six selected sentences,
while byte ranges refer to the original file. Kana and speaker labels come from
the official script. Missing Vietnamese captions show an explicit empty state.
Sentence timing proposals remain pending tester review.

Set `NIHON_DB_PATH` to the private app `demo.sqlite`, reuse normal login settings,
then run `npm start -- --port 3000` and open `http://localhost:3000/shadowing`.
The real private clip is intentionally absent from CI: `private-fixture.ts` uses
the public synthetic WebM and six invented captions to verify the same DB/media
path, ranges, kana/speakers, sentence highlighting, speed and separate recordings.
The private fixture doubles the public WebM TimecodeScale to 18 seconds without
new codecs/dependencies. It has a 6-second inter-sentence gap, explicit 0.5–17.5s
clip bounds, and browser assertions for skip, start clamp and end stop. The demo
retains its labeled 9-second behavior; the 10–60s validator applies to private clips.

Whole-clip playback begins/ends at the manifest bounds, with seeks clamped to
that range. Gaps longer than three seconds between sentences are skipped entirely;
shorter gaps and lead/trailing margins stay. Sentence repeats still use the original
sentence boundaries. Erin's proposed bounds are 55.6–90.5s; its six original timing
proposals are unchanged and remain pending the owner's listening approval.

Wasoku GĐ2: thư viện clip, khung player, phụ đề và câu được trình bày theo mockup với font local, linh vật chim chích và token thời điểm. Không đổi media, YouTube, ghi âm hoặc điều kiện buổi hợp lệ. Browser appearance kiểm 4 thời điểm x 390/1440 trên Today, trang gốc, SRS và Shadowing; ảnh lưu data/private/wasoku-phase2.
