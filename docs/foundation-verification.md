# Kiểm tra PR khung G1 — 06/11/2026

Trên Windows, Node 24.10.0, chạy `npm run check` thành công:

| Cổng | Kết quả |
| --- | --- |
| TypeScript và route types | Đạt |
| Kiểm thử prototype hiện hành | 22/22 |
| Kiểm thử foundation | 12/12 |
| Build production Next.js/Webpack | Đạt |
| HTTP và Chrome headless | Đạt |
| Desktop 1440px, mobile 390px | Đã quan sát ảnh, không tràn ngang |
| Lỗi JavaScript trong trình duyệt | 0 |
| Request trình duyệt tới nguồn bên ngoài | 0 |

Đã kiểm tra trang chưa đăng nhập (kể cả tuyến không tồn tại/RSC), API chưa
đăng nhập, Origin giả, cookie ký/hết hạn/bị sửa, mật khẩu NFC, robots/noindex,
bản dịch selected và nhãn model, database đọc-only, thẻ không trùng và không
reset lịch/state, giới hạn thư mục kể cả đổi tên file từ ngoài tuyến vào tuyến.
Mẫu seed chỉ có nguồn OpenJLPT, không có bản dịch máy hay dữ liệu riêng tư.
Schema khớp blob G0 nguyên bản và thao tác thêm thẻ không thay đổi sqlite_schema.

Report và ảnh tái tạo bằng `npm run test:app` nằm ở `data/reports/`, gitignored.
Kiểm thử tạo database/credential tạm và không gọi Gemini hoặc DB của worker G0.

## Giới hạn xác minh

- GitHub Actions chưa chạy: lần đầu bị chặn trước mọi step với annotation
  “The job was not started because your account is locked due to a billing issue.”
  Workflow vẫn được giữ để chạy lại sau khi chủ tài khoản xử lý; chưa kết luận
  đã pass CI Linux. Runner pin Ubuntu 24.04 để tránh thay đổi ubuntu-latest.
- Chưa thử trên thiết bị Android/Safari iOS thật hoặc triển khai qua VPS/Tailscale.
- PWA/offline, sao lưu, scheduler FSRS và tính năng học chi tiết chưa thuộc PR khung.

## Nhật ký local trước mỗi lần push

Trong lúc GitHub Actions bị khóa billing, mỗi lần push phải có một lượt
`npm run check` đầy đủ đạt. Ghi commit thực sự được kiểm tra, thời gian có múi
giờ và số kiểm thử đạt/tổng. Commit báo cáo chỉ thêm bản ghi vào tệp này sau
lượt check; không đổi code/config. Nếu có thay đổi khác phải check lại toàn bộ.
Không dùng dịch vụ CI khác hoặc runner tự dựng.

### 06/11/2026 — 16:22:16 (UTC+07:00)

- Commit đã kiểm tra: [`162ecc61e820aa12a58860113bb539aea197e9da`](https://github.com/hungntv210/NihonNihon/commit/162ecc61e820aa12a58860113bb539aea197e9da).
- Bắt đầu: `2026-11-06T16:21:18.9253252+07:00`.
- Kết thúc: `2026-11-06T16:22:16.6577090+07:00`.
- Môi trường: Windows, Node `v24.10.0`, Chrome headless.
- Lệnh: `npm run check`; exit code `0`.

| Cổng | Kết quả |
| --- | --- |
| typecheck (`next typegen` + `tsc --noEmit`) | Đạt |
| test — prototype | 22/22 đạt |
| test — foundation | 12/12 đạt |
| Tổng kiểm thử | **34/34 đạt**, 0 lỗi, 0 bỏ qua |
| build — Next.js production/Webpack | Đạt |
| test:app — HTTP và Chrome, desktop/mobile | Đạt |

Kiểm thử phạm vi đã xác nhận nhánh chức năng được thêm nhật ký kiểm tra,
đồng thời bị chặn khi sửa bản ghi cũ hoặc di chuyển file dùng chung vào tuyến.
Log thô: `data/reports/pre-push-162ecc6-20261106T162118.log` (gitignored).
Database/credential kiểm thử là tạm; không gọi Gemini hoặc ghi vào DB G0.

### 06/11/2026 — 16:29:56 (UTC+07:00)

- Commit đã kiểm tra: [`0e00ce9918ae0caeb670ab0d2f2ebf5bc2f9cedc`](https://github.com/hungntv210/NihonNihon/commit/0e00ce9918ae0caeb670ab0d2f2ebf5bc2f9cedc).
- Bắt đầu: `2026-11-06T16:29:01.5242075+07:00`.
- Kết thúc: `2026-11-06T16:29:56.7853175+07:00`.
- Môi trường: Windows, Node `v24.10.0`, Chrome headless.
- Lệnh: `npm run check`; exit code `0`.

| Cổng | Kết quả |
| --- | --- |
| typecheck (`next typegen` + `tsc --noEmit`) | Đạt |
| test — prototype | 22/22 đạt |
| test — foundation | 12/12 đạt |
| Tổng kiểm thử | **34/34 đạt**, 0 lỗi, 0 bỏ qua |
| build — Next.js production/Webpack | Đạt |
| test:app — HTTP và Chrome, desktop/mobile | Đạt |

Đã tái hiện lỗi trước sửa bằng file thử
`data/raw/OpenJLPT/scripts/nihon-foundation-exclude-regression.ts` chứa phép gán
`string = 123`: TypeScript báo TS2322. Giữ nguyên file thử có lỗi trong toàn bộ
lượt `npm run check` sau khi thêm `data` vào exclude; cả typecheck và build đều
đạt. File thử là dữ liệu local gitignored và được dọn sau khi kiểm tra, không
phải dữ liệu OpenJLPT được đưa vào fixture.

`git check-ignore --no-index` xác nhận các đường dẫn raw/staging/private/
requests/backups/mt-results, database và `.env*` được bỏ qua; fixture công khai
và `.env.example` vẫn không bị ignore và được theo dõi. Tên package và cả hai
trường tên trong lockfile hiện đều là `nihon-nihon`.

[Hướng dẫn gộp package G0/G1](g0-g1-package-merge.md) quy định `test:data`,
`test:app`, giữ smoke test HTTP/Chrome qua `test:browser`, hợp dependency và
tạo lại lockfile. Chưa merge code G0 hoặc chạy bộ test G0 trong worktree G1.
Log thô: `data/reports/pre-push-0e00ce9-20261106T162901.log` (gitignored).
Schema, worker dịch và database G0 không thay đổi.

### 2026-11-06T16:47:08.7534675+07:00 — foundation: dependency SRS

- Commit kiểm tra: a24b8f63e79f52377e951d188293bf27674e676e.
- Bắt đầu: 2026-11-06T16:45:50.0761446+07:00; kết thúc: 2026-11-06T16:47:08.7534675+07:00.
- npm run check: PASS; prototype 22/22 + foundation 14/14 = **36/36**; typecheck, build và test:app đều đạt.
- Foundation chỉ bổ sung ts-fsrs@6.0.0 và wanakana@5.3.1 cùng smoke test/hợp đồng dependency; không sửa schema. Đây là phần dùng chung, không thuộc phạm vi một tuyến chức năng.
- Log local: data/reports/pre-push-a24b8f6-20261106T164550.log (gitignored).

### 2026-11-06T21:08:41.3451266+07:00 — g1/vocab

- Commit kiểm tra: 417d4976fa5ef4266ecb32ea377cd3f0f0ea6631.
- Bắt đầu: 2026-11-06T21:07:48.0149618+07:00; kết thúc: 2026-11-06T21:08:41.3451266+07:00.
- Windows, Node v24.10.0, Chrome headless; npm run check: PASS.
- Prototype 22/22 + foundation/route 21/21 = **43/43** kiểm thử, 0 lỗi/0 bỏ qua; typecheck, build production và test:app đều đạt.
- node tools/check-route-scope.mjs origin/master vocab: PASS; chỉ 15 file tuyến vocab thay đổi trước bản ghi audit.
- Browser riêng vocab: PASS (tìm kana, URL content ID mã hoá, nghĩa selected/nhãn model, ruby/ví dụ, Báo sai có auth/Origin, sổ từ đã lưu, bài học không đổi thứ tự sau lưu, desktop/mobile390px không tràn, 0 lỗi JavaScript).
- Dữ liệu browser bổ sung chỉ là tổng hợp trong DB tạm; không commit dữ liệu dịch/private hoặc sửa schema. Không gọi Gemini.
- Giới hạn: mẫu chỉ 8 từ; dữ liệu Việt/ví dụ/fullN5–N2 chờ G0 nghiệm thu và merge. Voice Nhật phụ thuộc trình duyệt/OS; Reader/subtitle custom-word integration chưa có trong tuyến này.
- Log: data/reports/pre-push-vocab-417d497-20261106T210748.log; browser report data/reports/vocab-browser-check.json, ảnh desktop/mobile đều gitignored.

### 2026-11-06T21:08:06.0870796+07:00 — g1/kanji

- Commit đã kiểm tra: c68c7fc75335ba35d8c7eb8f7274fe6f114d15b8.
- Bắt đầu: 2026-11-06T21:07:09.3463506+07:00; kết thúc: 2026-11-06T21:08:06.0870796+07:00.
- npm run check: PASS; 22/22 prototype +20/20 foundation/kanji = **42/42**; typecheck, build, test:app đều đạt.
- node tools/check-route-scope.mjs origin/master kanji: PASS; chỉ sửa tuyến kanji và thêm nhật ký.
- Kiểm tra riêng HTTP/Chrome: PASS — tìm kiếm không dấu, detail URL encoded, selected/candidate HV và nhãn model, báo sai/CSRF/lưu DB, nét từng bước/phát lại/reduced-motion, memo NFC, thêm hàng ôn, mobile390 không tràn ngang; không có lỗi JS. Đã quan sát ảnh desktop/mobile.
- Demo public chỉ 4 kanji; synthetic translations/strokes chỉ trong DB kiểm thử tạm. Full dữ liệu1038/HV/nét thực tế phụ thuộc nghiệm thu G0; TTS chỉ giọng Nhật cục bộ nếu có, memo chỉ thiết bị, chưa benchmark máy thật.
- Không sửa schema/shared/G0. Log: data/reports/kanji-check-c68c7fc-20261106T210709.log (gitignored).

### 2026-11-06T21:29:39.2878302+07:00 — PR5 Kanji browser runner

- Checked commit 73bcc4b5f4d8d13aadfafccb40342fd0d5dd6f08; start 2026-11-06T21:28:31.6380719+07:00; end 2026-11-06T21:29:39.2878302+07:00.
- Full npm run check PASS **49/49** (22 prototype+27 foundation/vocab/kanji); scope kanji PASS; committed browser-check.ts walkthrough PASS.
- Merged latest master after PR6. Audit conflict resolved preserving every entry from both sides; master entries precede Kanji entries.
- Log data/reports/pre-push-73bcc4b.log (gitignored). No schema/shared changes.

### 2026-11-06T21:06:50.4987672+07:00 — g1/srs

- Commit kiểm tra: ad7a307f685f8ede3e8a066cc8f6df02e9e3a5fa.
- Bắt đầu: 2026-11-06T21:05:58.1256109+07:00; kết thúc: 2026-11-06T21:06:50.4987672+07:00.
- npm run check: PASS; 22 prototype +21 foundation/SRS = **43/43**; typecheck, build, test:app đều đạt.
- node tools/check-route-scope.mjs origin/master srs: PASS (13 file tuyến trước audit).
- Smoke riêng: offline chấm vào IndexedDB rồi reconnect đồng bộ, replay receipt không tạo review trùng, Chrome desktop/mobile PASS.
- Soát mã phát hiện chặn đầu hàng do conflict; đã sửa và kiểm thử giữ event lỗi, tiếp tục các thẻ độc lập, giữ thứ tự cùng thẻ.
- Không đổi schema/phần dùng chung; dependency nhận từ master qua foundation PR2.
- Giới hạn: offline cold-load chờ PWA; shadow/cloze chưa hỗ trợ; không nghiệm thu G0 hoặc thiết bị thật.
- Log local: data/reports/pre-push-ad7a307.log (gitignored).

### 2026-11-06T21:34:10.0343484+07:00 — PR4 SRS quick recognition regression

- Checked commit: 2427860604c1f20df38ab6cdc74b26081b73accc, after merging latest origin/master e0d1963 (PR6 and PR5).
- Start: 2026-11-06T21:33:22.1693567+07:00; end: 2026-11-06T21:34:10.0343484+07:00.
- Environment: Windows, Node v24.10.0, local production server and headless Chrome; process/loopback access enabled for the successful run.
- Full npm run check: PASS. Typecheck PASS; test **56/56** (22 prototype +34 foundation/routes), 0 failed/0 skipped; production build PASS; test:app PASS.
- node tools/check-route-scope.mjs origin/master srs: PASS, 14 changed files within the SRS route and append-only verification log.
- Committed SRS browser-check.ts walkthrough: PASS, including offline review persisted to IndexedDB, reconnect synchronization, receipt replay without duplicate history, desktop/mobile and no browser errors.
- Quick SQL accepts only recognition cards for vocabulary/kanji. Regression seeds recognition/reading/recall/listening for 8 public vocabulary +4 kanji and grammar recognition; verifies the exact12 eligible recognition cards, adds4 synthetic copies of public fixture vocabulary to verify quick limit15, and retains full limit20. No schema/shared/G0 or audio autoplay changes.
- The earlier restricted-sandbox attempt timed out starting the local server; the complete successful run above supersedes that attempt without source changes. Raw logs remain gitignored: data/reports/pre-push-2427860-final.log, data/reports/srs-scope-2427860.log, data/reports/srs-browser-2427860.log.
- Limits: public demo only; cold offline load awaits the PWA shell; no physical-device benchmark or G0 acceptance claimed.

### 2026-11-06T21:02:15.3528179+07:00 — g1/grammar

- Commit kiểm tra: 596953e3d26d210fb12b71241c94386205fd6efe.
- Bắt đầu: 2026-11-06T21:00:43.2698194+07:00; kết thúc: 2026-11-06T21:02:15.3528179+07:00.
- npm run check: PASS; typecheck, build production và test:app HTTP/Chrome desktop/mobile đều đạt.
- Kiểm thử: prototype 22/22 + foundation/grammar 21/21 = **43/43**, không lỗi hoặc bỏ qua.
- node tools/check-route-scope.mjs origin/master grammar: PASS; trước nhật ký có 14 file, tất cả trong src/app/(study)/grammar/.
- Log local: data/reports/grammar-check-596953e.log và data/reports/grammar-scope.log (gitignored).
- Có tìm kiếm/lọc/phân trang, chi tiết nguồn-aware, ví dụ/furigana, bài tập dựng lại câu gốc và Báo sai. Chưa nghiệm thu đủ403 mẫu/VI/clip vì G0 chưa merge; không tự tạo nội dung thiếu, không sửa schema.

### 2026-11-06T21:36:54.0848994+07:00 — PR3 grammar encoded navigation regression

- Checked commit: a93111ab57d33dcbd3e00c122e5524b08007183d, after merging origin/master b2910fd6e7e4343cf653ae308830a16f586dc2e3 (PR6, PR5 and PR4); all prior verification entries preserved.
- Full-check start: 2026-11-06T21:35:40.2444464+07:00; end: 2026-11-06T21:36:31.5231050+07:00.
- Environment: Windows, Node v24.10.0, npm 11.6.1, local production server and headless Chrome; Windows child-process and loopback access enabled.
- Full npm run check: PASS. Typecheck PASS; tests **64/64** (22 prototype +42 foundation/routes, including8 grammar), 0 failed/0 skipped; production build PASS; test:app PASS.
- node tools/check-route-scope.mjs origin/master grammar: PASS, 17 changed files confined to the grammar route and append-only verification log. No schema/shared/G0 changes.
- Committed grammar browser-check.ts: PASS, start 2026-11-06T21:36:43.6748426+07:00; end 2026-11-06T21:36:54.0848994+07:00. Clicked all3 actual listing links and all6 actual related-group links at1440px and390px (18 clicks), asserted destination headings/content and no horizontal overflow or browser errors. Short /grammar/wa returned200; URL-escaped malformed keys and a double-encoded ID returned404.
- Route boundary decodes the ID exactly once; malformed URI decoding returns not-found. Regression tests cover generated listing/related IDs, short and canonical keys, malformed encoding and no second decode. Browser malformed keys use valid URL escaping to reach the route; invalid raw URL escaping is handled by Next's matcher before the page.
- Raw logs/report are gitignored: data/reports/grammar-final-a93111a.log, data/reports/grammar-final-scope-a93111a.log, data/reports/grammar-final-browser-a93111a.log, data/reports/grammar-browser-check.json. Only this audit entry changes after the successful checks.
- Limits: public three-pattern demo only; no full403-pattern, Vietnamese translation, clip, G0 data acceptance or physical-device claims.


### 2026-11-07T12:04:10.3485110+07:00 — remaining g1/foundation

- Checked commit: 1bbca148e27d94bec1cfeb82999415cdda4d1f81. Full-check start: 2026-11-07T12:02:48.9180844+07:00; end: 2026-11-07T12:04:10.3485110+07:00.
- Environment: Windows, Node v24.10.0, npm 11.6.1, production Next.js server and headless Chrome 156.0.8078.80; process/loopback access enabled. All test private paths use disposable G1 fixtures; no G0 live database access.
- Full npm run check PASS: typecheck PASS; tests **68/68** (22 prototype +46 foundation/routes), 0 failed/0 skipped; production build PASS; test:app PASS (15 HTTP/browser checks, 1440px/390px).
- node tools/check-route-scope.mjs 2c25fa6 foundation PASS: 39 changed files before this append-only audit entry, exact shared whitelist/settings/fonts only. No existing feature route or schema changes.
- Browser checks: authenticated settings persistence, actual /vocab/lesson gate with SRS still accessible, maintenance503 for writes, backup download/restore API roundtrip, local subset fonts, service-worker restart then offline navigation/password rejection/unlock, offline SRS review durable queue and exactly one additional server review after reconnect, logout clearing page/proof cache entries, no page errors or third-party requests. Desktop/mobile screenshots visually checked.
- Restore tests cover hash/path/JSON/schema validation, stable live SQLite file identity, foreign-key checks, SQL/filesystem rollback, and a second injected rollback-rename failure retaining recovery copies. Scheduled-backup CLI regression proves .env then .env.local load the configured temporary snapshot. Daily backups also run hourly in the active server and create at most one daily archive; npm run backup:daily is available for an external scheduler. Archive size limit128MiB.
- Font subset generation is deterministic and asserts Vietnamese/Japanese specimens; primary WOFF2 total653108bytes versus8946968bytes original TTF, with original TTF glyph fallback retained.
- Raw logs/screenshots remain gitignored under data/reports/: foundation-full-check.log, foundation-gate-start.json, foundation-gate-end.json, foundation-check.json, foundation-desktop.png, foundation-mobile.png. Earlier successful b86c752 gate preceded the CLI fix and is not the checked SHA for this final state.
- Limits: opt-in encrypted HTML cache, not full browser-storage encryption. Existing SRS localStorage session snapshots remain plaintext while studying; logout/remove-download clears snapshots, but unsynchronized review outbox is kept. Retention is fixed90% and new-card-limit control is read-only until SRS integration. No physical Android/iOS install, Tailscale/VPS deployment, or full G0-data acceptance claimed. Root/nav Today links require today-roadmap PR7 to merge first; preserve both branches' appended audit entries if resolving their verification-log conflict.
- Only this audit entry changes after the successful full check.

### 2026-11-07T12:00:01.4999135+07:00 — g1/today-roadmap

- Checked commit: 0f83028e9f67789ce599ff9c315902e88458cc0e; preserved origin/g1/today-roadmap documentation ancestry with a merge, without force pushing.
- Full-check start: 2026-11-07T11:58:39.1026368+07:00; end: 2026-11-07T11:59:50.6797108+07:00.
- Environment: Windows, Node v24.10.0, npm 11.6.1, Next production server, installed headless Chrome. Reused identical locked dependencies through a local junction to the foundation worktree; Windows process and loopback access enabled.
- Full npm run check: PASS. Typecheck PASS; tests **72/72** (22 prototype +50 foundation/routes including8 Today), 0 failed/0 skipped; production build PASS; test:app PASS.
- Scope guard: node ../g1-foundation/tools/check-route-scope.mjs origin/master today-roadmap PASS, 11 route files before this append-only audit. No shared/schema/G0 changes.
- Committed Today browser-check.ts: PASS, start 2026-11-07T11:59:56.6190604+07:00; end 2026-11-07T12:00:01.4999135+07:00. Verified unauthenticated redirect, CSRF rejection, invalid makeup rejection, all87 weeks, desktop1440/mobile390 without horizontal overflow or browser errors, persisted manual shadowing, duplicate rejection, 20-minute plan and actual daytime/evening UI after changing isolated settings. Visually inspected desktop/mobile, evening tasks and shadow form screenshots.
- Browser testing found SQLite null-prototype rows could not cross the RSC boundary; committed plain-object conversion and a regression assertion before this successful run.
- Public OpenJLPT demo only. Shadowing is explicit manual confirmation, not recording or pronunciation assessment. JLPT/weekly exercises, background notifications, planned leave and automatic freeze consumption remain unavailable and documented. Shared foundation owns navigation, direct new-lesson enforcement, settings UI and backup integration. The route reads that settings file through a validated adapter until the shared preferences reader is merged.
- Raw logs/screenshots stay gitignored in data/reports/today-roadmap/: final.log, scope-final.log, final-browser.log, browser-gL8Yhc/. An earlier restricted run failed loopback readiness; this successful full run supersedes it. Only this audit entry changes after the checked commit.

### 2026-11-07T12:04:24.2297791+07:00 — PR7 snapshot path integration regression

- Checked commit: 3f0809091dbfa7b2b2bb479b452439264edf24dc.
- Full-check start: 2026-11-07T12:02:54.7157804+07:00; end: 2026-11-07T12:04:10.6355234+07:00.
- Environment: Windows, Node v24.10.0, npm 11.6.1, production Next server and installed headless Chrome; identical locked dependencies reused through the foundation node_modules junction, process/loopback access enabled.
- Full npm run check: PASS. Typecheck PASS; tests **73/73** (22 prototype +51 foundation/routes including9 Today), 0 failed/0 skipped; production build PASS; test:app PASS.
- Scope guard: node ../g1-foundation/tools/check-route-scope.mjs origin/master today-roadmap PASS, 12 changed files confined to the route and append-only verification log.
- Settings and roadmap defaults now derive from path.dirname(databasePath()), matching the foundation settings/backup/lesson-gate contract for custom snapshots. Explicit NIHON_SETTINGS_PATH/NIHON_ROADMAP_PATH overrides retain precedence. A regression uses a nested custom database directory without either override, reads its settings/progress, then verifies explicit overrides.
- Committed route browser check: PASS, start 2026-11-07T12:04:19.2426545+07:00; end 2026-11-07T12:04:24.2297791+07:00. The harness now omits path overrides, changes settings beside its isolated database to exercise day/evening UI, and asserts manual shadowing persists under that database's private directory. All prior desktop/mobile, CSRF, makeup, duplicate, 87-week and 20-minute checks also pass.
- Logs/screenshots remain ignored: data/reports/today-roadmap/snapshot.log, snapshot-scope.log, snapshot-browser.log, browser-eTBSKV/. Prior limitations remain unchanged; no schema/shared/G0 edits. Only this audit entry changes after the checked implementation commit.

### 2026-11-07T12:15:02.8771778+07:00 — PR7 after foundation PR8 merge

- Checked merge commit: b8512ec485a1afb567c97cdaa3c16fb34fee002b; received origin/master 59cbb9cd38b16d08b74f0aa7501f26288efe3066 after PR8 merged. The verification-log conflict retains every original entry from both branches.
- Full check start 2026-11-07T12:13:41.1557157+07:00; end 2026-11-07T12:15:02.8771778+07:00. Windows, Node24.10.0, npm11.6.1, production Next/installed headless Chrome, disposable OpenJLPT fixtures, process/loopback access enabled.
- npm run check PASS: typecheck PASS; tests77/77 (22 prototype+55 foundation/routes), zero failures/skips; production build PASS; test:app PASS including15 HTTP/browser checks and cold offline review sync exactly+1.
- node tools/check-route-scope.mjs origin/master today-roadmap PASS (12 changed route/audit files); committed route browser-check PASS: desktop/mobile,87weeks,20-minute plan, manual shadowing persistence, CSRF, makeup and duplicate validation.
- Raw logs remain ignored: data/reports/merge7-check.log, merge7-scope.log, merge7-browser.log, merge7-check-start.json and merge7-check-end.json. Only this append-only audit changes after the checked merge commit. Existing implementation limitations remain unchanged.

### 2026-11-07T15:12:37.2704250+07:00 — G1 CI ownership registry

- Checked implementation020aa8d16e4e538cdbb03069541fec42a4f98843; start2026-11-07T15:11:26.1782990+07:00, end2026-11-07T15:12:37.2704250+07:00. Windows, Node24.10.0/npm11.6.1, production Next and installed headless Chrome, disposable fixtures and process/loopback access enabled.
- Full npm run check PASS: typecheck PASS, tests78/78 (22prototype+56foundation/routes), zero failures/skips, build PASS, test:app PASS including15HTTP/browser checks.
- Workflow ownership condition is exactly startsWith(github.head_ref, 'g1/'); full branch is passed to the script. One registry in tools/check-route-scope.mjs owns mappings; README/AGENTS point to it. Unknown owners fail before git lookup with an explicit registration error.
- Regression checks cover full g1/shadowing and g1/common-tools branch names, rejection of shared-file changes, unknown-branch failure, workflow condition, append-only audit and move detection. Existing ownership restrictions are retained.
- This dedicated codex/ci-scope-g1 PR modifies only workflow, registry, scope tests and ownership documentation; no feature-route/schema/G0 changes. Raw logs data/reports/ci-scope-final.log and ci-scope-final-{start,end}.json stay ignored. Only this audit entry changes after the checked implementation.

### 2026-11-07T12:18:47.5604061+07:00 — backup retention and deployment follow-up

- Checked implementation: 9240db9f700cbf5e06e4017b0813f0f42f579bb2 on origin/master a3e6c31374cd3744a7bd2158c2ec8c57bb90a800 after PR8 then PR7 merged. Their complete verification entries remain preserved.
- Full-check start 2026-11-07T12:17:42.6053000+07:00; end 2026-11-07T12:18:47.5604061+07:00. Windows, Node24.10.0, npm11.6.1, production Next and installed headless Chrome; process/loopback access enabled; disposable fixtures only.
- npm run check PASS: typecheck PASS; tests78/78 (22 prototype+56 foundation/routes), zero failures/skips; build PASS; test:app PASS including15 HTTP/browser checks, backup restore and cold offline SRS exact+1 synchronization.
- node tools/check-route-scope.mjs origin/master foundation PASS (4 shared implementation/doc/test files before this audit). No schema or feature-route changes.
- Backup regression verifies14 newest daily archives plus4 distinct older UTC weeks, idempotence, cleanup when today's archive already exists, and preservation of before-restore files, future/invalid names, unrelated files and date-named directories. Cleanup runs only after a daily archive exists; failed new archive creation skips cleanup.
- Deployment guide states production DB filename demo.sqlite or NIHON_DB_ROLE=snapshot, separate G1 snapshot, scheduler env loading, and128MiB archive limit including base64 recording overhead. Existing before-restore recovery copies require deliberate manual cleanup.
- Raw logs remain ignored: data/reports/retention-focused.log, retention-check.log, retention-scope.log, retention-check-start.json and retention-check-end.json. Only this append-only audit changes after the checked commit.


### 2026-11-07T18:56:21.9991704+07:00 — PR9 pre-push merge-sequence verification

- Checked commit: af2c98ae28d85bd5469b8f4597e0cc2a7c9d6806; branch g1/foundation. Full-check start 2026-11-07T18:55:23.8998008+07:00; end 2026-11-07T18:56:21.9991704+07:00.
- npm run check PASS: typecheck PASS; tests79/79, zero failures/skips; production build PASS; test:app PASS. Windows, Node24.10.0/npm11.6.1, installed headless Chrome, disposable OpenJLPT fixtures; process/loopback access enabled.
- Journal resolution retains all entries from both sides. Raw log stays ignored: data/reports/merge-sequence/pr9-pre-push-af2c98a.log. Existing implementation and physical-device/deployment limitations remain unchanged.
- Current origin/master scope guard PASS; only registered owned paths and append-only verification changes.

## 2026-11-07 · g1/common-tools

- Checked implementation commit: `2b7d6b00e391924fb8284a719aab72e33009c72a` (base `a3e6c31374cd3744a7bd2158c2ec8c57bb90a800`).
- Full check started 2026-11-07T15:11:02+07:00; all checks and additional browser verification completed by 2026-11-07T15:13:03+07:00 (Asia/Ho_Chi_Minh).
- Environment: Windows PowerShell, Node v24.10.0, production Next.js/Webpack, installed Windows Chrome; reused installed foundation node_modules through a local junction. Isolated public demo DB plus synthetic test-only translation provenance; no private data or external translation calls.
- Required gates: `typecheck` PASS; `test` PASS (22/22 prototype and 58/58 TypeScript tests, including 3 common-tools tests); `build` PASS; `test:app` PASS (15 reported checks, real production server, desktop/mobile and encrypted cold offline SRS).
- Additional production browser check PASS: 7 reported check groups, 0 browser errors; all five common-tools pages at 1440/390 px without horizontal overflow; authenticated search, real model provenance, enqueue, canonical detail link, persisted report through owner route and queue display. Inspected mobile search screenshot. Command: `node --import tsx 'src/app/(study)/common-tools/browser-check.ts'`.
- Ownership guard PASS: `node ../ci-scope-g1/tools/check-route-scope.mjs origin/master g1/common-tools` (11 changed feature files). Uses the separate pending CI registry update, with no shared guard changes copied into this branch.
- Logs/screenshots remain ignored in `.tmp/common-full-check.log`, `.tmp/common-browser-check.log`, `data/reports/common-tools-browser-check.json`, and `data/reports/common-*.png`.
- Limitations: shared navigation integration belongs to foundation; search scan latency on a full imported snapshot is unmeasured; clip/popup/external dictionary lookup contracts absent; no physical-phone or deployed home-host Tailscale HTTPS/off-machine backup test. TTS deferred. Report queue is read-only and never retranslates. Settings reuse the shared page/API. Progress counts real SRS events; shadowing is labeled manual.

### 2026-11-07T18:37:27.2917798+07:00 — g1/common-tools design-token verification

- Checked implementation commit: `77b444cf5cdef03acd1b9fcd5b5092beb1c9ec8e`; fresh fetch retained `origin/master` at `a3e6c31374cd3744a7bd2158c2ec8c57bb90a800`. Remote common-tools documentation ancestry is preserved through merge `9197700`; no force push.
- Full `npm run check` start: 2026-11-07T18:35:43.7034456+07:00; end: 2026-11-07T18:37:05.1740327+07:00. Windows PowerShell, Node v24.10.0, npm 11.6.1, production Next.js/Webpack, installed headless Chrome, foundation node_modules junction, process/loopback access enabled. Isolated public demo and synthetic provenance only; no private G0 database or translation service calls.
- All four gates PASS: typecheck; tests **80/80** (22 prototype +58 TypeScript, including3 common-tools), zero failures/skips; production build; test:app (15 HTTP/browser check groups including encrypted cold offline SRS unlock, durable review outbox/reconnect, settings and backup restore).
- Scope guard `node ../ci-scope-g1/tools/check-route-scope.mjs origin/master g1/common-tools` PASS: 12 changed route/audit files. Uses the pending shared registry update without copying shared files into this branch.
- Committed route browser check PASS, start 2026-11-07T18:37:17.5947481+07:00; end 2026-11-07T18:37:27.2917798+07:00: all five pages authenticated, selected accent-free Vietnamese search, actual model provenance, real enqueue, canonical detail link, owner-route report persistence and queue display. Seven reported check groups, zero browser errors; desktop1440/mobile390 without horizontal overflow. Visually inspected both progress screenshots and mobile search/report screenshots: shared border/accent tokens render and review-chart rows fill the available width.
- Ignored evidence: `data/reports/common-77b444c-check.log`, `common-77b444c-browser.log`, start/end timestamp files, `common-tools-browser-check.json`, and `common-*.png`. Only this append-only audit entry changes after the checked implementation commit.
- Limits: full imported-snapshot search latency remains unmeasured; the200ms target is not an established benchmark. Report queue is read-only; selected translations retain actual source/model metadata. Progress counts actual SRS events and manually confirmed shadowing. Clip/token popup/external-dictionary contracts and TTS remain deferred. No physical phone, home-host Tailscale HTTPS deployment or off-machine backup acceptance claimed. Shared navigation integration remains a separate change.


### 2026-11-07T18:58:54.9465746+07:00 — PR11 pre-push merge-sequence verification

- Checked commit: 5a2434b09873dd527bd56374fb251de7a0ba918f; branch g1/common-tools. Full-check start 2026-11-07T18:57:58.7354930+07:00; end 2026-11-07T18:58:54.9465746+07:00.
- npm run check PASS: typecheck PASS; tests82/82, zero failures/skips; production build PASS; test:app PASS. Windows, Node24.10.0/npm11.6.1, installed headless Chrome, disposable OpenJLPT fixtures; process/loopback access enabled.
- Journal resolution retains all entries from both sides. Raw log stays ignored: data/reports/merge-sequence/pr11-pre-push-5a2434b.log. Existing implementation and physical-device/deployment limitations remain unchanged.
- Current origin/master scope guard PASS; only registered owned paths and append-only verification changes.
- Route browser-check also PASS on this checked commit; raw browser log stays ignored beside the full-check log.

### 2026-11-07T18:41:10.6926020+07:00 — g1/shadowing interaction demo

- Checked implementation commit: 34aed48f63b46140457de36665001a84344df050. Preserved published origin/g1/shadowing documentation ancestry with merge cabeef7; no force push.
- Full-check start: 2026-11-07T18:39:35.5298148+07:00; end: 2026-11-07T18:40:24.0437198+07:00. Environment: Windows, Node v24.10.0, npm 11.6.1, Next production and installed headless Chrome, process/loopback access enabled; locked dependencies reused through the foundation worktree junction.
- npm run check PASS: typecheck PASS; tests 80/80 (22 prototype +58 foundation/route, including3 shadowing), zero failures/skips; production build PASS; test:app PASS including15 HTTP/browser checks and cold offline SRS synchronization.
- Scope guard: node ../ci-scope-g1/tools/check-route-scope.mjs origin/master g1/shadowing PASS, 10 changed route files before this audit. Expanded registry is isolated in the sibling shared-scope branch; no shared files copied here.
- Committed route browser-check.ts PASS 13/13, start 2026-11-07T18:40:51.4607727+07:00; end 2026-11-07T18:41:10.6926020+07:00. Verified protected route/media, byte ranges and416, actual9-second synthetic video playback, speed, finite/infinite segment repeats, JP/VI/hidden captions, native fake-device MediaRecorder capture/replay/download, replace/delete blob revocation, actual browser permission denial, track release after route cleanup, no external requests/browser errors, desktop1440/mobile390 without horizontal overflow. Visually inspected both screenshots.
- Browser harness fixes use an explicit accessible select name, the isolated Chrome context for denied microphone permission, and wait for React cleanup after navigation. An earlier concurrent browser run failed because build was recreating .next; the successful sequential final run above supersedes it. No source changed after the full check.
- Fixture is public synthetic canvas + tones only, with original test captions and no spoken Japanese. Not valid study content; never writes study sessions/quotas/progress. Recordings remain in browser memory/download only; no private data, TTS, Whisper, media AI, schema, server upload or storage added. Three real legal sources, private server persistence and physical Android/iOS acceptance remain deferred. Home host/Tailscale Serve HTTPS and backup off the host are documented handoff requirements, not deployed or verified here.
- Raw logs/screenshots remain gitignored in data/reports/: shadowing-full-check.log, shadowing-scope.log, shadowing-final-browser.log, shadowing-check.json, shadowing-{desktop,mobile}.png and exact gate/browser timestamps. Only this append-only audit changes after the checked implementation.


### 2026-11-07T19:02:24.8497682+07:00 — PR13 pre-push merge-sequence verification

- Checked commit: ae6aa514703cc2d23e47e4d28261a1dc95a73022; branch g1/shadowing. Full-check start 2026-11-07T19:01:13.7976503+07:00; end 2026-11-07T19:02:24.8497682+07:00.
- npm run check PASS: typecheck PASS; tests85/85, zero failures/skips; production build PASS; test:app PASS. Windows, Node24.10.0/npm11.6.1, installed headless Chrome, disposable OpenJLPT fixtures; process/loopback access enabled.
- Journal resolution retains all entries from both sides. Raw log stays ignored: data/reports/merge-sequence/pr13-pre-push-ae6aa51.log. Existing implementation and physical-device/deployment limitations remain unchanged.
- Current origin/master scope guard PASS; only registered owned paths and append-only verification changes.
- Route browser-check also PASS on this checked commit; raw browser log stays ignored beside the full-check log.

### 2026-11-07T18:37:32.0498589+07:00 — shared G1 feature entries and home deployment guide

- Checked implementationea04f283e7c0f72991bc72c35c0f3005ff0427b6; start2026-11-07T18:36:16.5439569+07:00, end2026-11-07T18:37:32.0498589+07:00. Windows, Node24.10.0/npm11.6.1, locked dependencies, production Next and installed headless Chrome; disposable data and process/loopback access enabled.
- Full npm run check PASS: typecheck PASS; tests77/77 (22prototype+55foundation/routes), zero failures/skips; production build PASS; test:app PASS with16HTTP/browser checks. Native GET search navigation preserves the Japanese/Vietnamese query with the real service worker active; feature backend tests live in common-tools.
- node tools/check-route-scope.mjs origin/master foundation PASS (4 owned shared/doc/test files before this append). Shared shell supplies search and Shadowing/reports/progress entry links; no feature implementation is duplicated or modified.
- Desktop/mobile screenshots visually inspected;390px no overflow. Encrypted cold SRS unlock/reconnect and backup/restore baseline checks still pass. An earlier synthetic page.route interception was superseded by real GET routing because the active worker handles navigations.
- Deployment guide records home server + Tailscale Serve HTTPS, matching APP_ORIGIN, off-machine copy/checksum/recovery requirements and deferred TTS. No actual server or external backup destination is configured by these changes.
- Merge the common-tools/shadowing feature PRs before this entry PR; standalone routing checks do not imply their endpoints exist on this isolated branch. PR9 remains unchanged/unmerged. Raw logs data/reports/shared-entry-final.log, shared-entry-final-scope.log and shared-entry-final-{start,end}.json remain ignored. Only this audit entry changes after the checked implementation.


### 2026-11-07T19:05:07.4032740+07:00 — PR12 pre-push merge-sequence verification

- Checked commit: 1678809f0dfa0ba087f1489c473c7b210f282e32; branch codex/g1-shared-entry. Full-check start 2026-11-07T19:04:13.4573378+07:00; end 2026-11-07T19:05:07.4032740+07:00.
- npm run check PASS: typecheck PASS; tests85/85, zero failures/skips; production build PASS; test:app PASS. Windows, Node24.10.0/npm11.6.1, installed headless Chrome, disposable OpenJLPT fixtures; process/loopback access enabled.
- Journal resolution retains all entries from both sides. Raw log stays ignored: data/reports/merge-sequence/pr12-pre-push-1678809.log. Existing implementation and physical-device/deployment limitations remain unchanged.
- Current origin/master scope guard PASS; only registered owned paths and append-only verification changes.
- Route browser-check also PASS on this checked commit; raw browser log stays ignored beside the full-check log.


### 2026-11-07T18:55:00.6701836+07:00 — PR10 master merge-sequence verification

- Checked commit: 14111389ef8cbda45725f32a30fe9e791ab06cc8; branch master. Full-check start 2026-11-07T18:54:05.5588879+07:00; end 2026-11-07T18:55:00.6701836+07:00.
- npm run check PASS: typecheck PASS; tests78/78, zero failures/skips; production build PASS; test:app PASS. Windows, Node24.10.0/npm11.6.1, installed headless Chrome, disposable OpenJLPT fixtures; process/loopback access enabled.
- Journal resolution retains all entries from both sides. Raw log stays ignored: data/reports/merge-sequence/pr10-master-1411138.log. Existing implementation and physical-device/deployment limitations remain unchanged.


### 2026-11-07T18:57:41.4030262+07:00 — PR9 master merge-sequence verification

- Checked commit: 7285102a8aa562814373da7f65ef8321fa35ccfc; branch master. Full-check start 2026-11-07T18:56:57.8792226+07:00; end 2026-11-07T18:57:41.4030262+07:00.
- npm run check PASS: typecheck PASS; tests79/79, zero failures/skips; production build PASS; test:app PASS. Windows, Node24.10.0/npm11.6.1, installed headless Chrome, disposable OpenJLPT fixtures; process/loopback access enabled.
- Journal resolution retains all entries from both sides. Raw log stays ignored: data/reports/merge-sequence/pr9-master-7285102.log. Existing implementation and physical-device/deployment limitations remain unchanged.


### 2026-11-07T19:00:48.5414452+07:00 — PR11 master merge-sequence verification

- Checked commit: 8fc6c60546cd3dbb84646e0ced841dc6f7dd18dc; branch master. Full-check start 2026-11-07T18:59:50.5897316+07:00; end 2026-11-07T19:00:48.5414452+07:00.
- npm run check PASS: typecheck PASS; tests82/82, zero failures/skips; production build PASS; test:app PASS. Windows, Node24.10.0/npm11.6.1, installed headless Chrome, disposable OpenJLPT fixtures; process/loopback access enabled.
- Journal resolution retains all entries from both sides. Raw log stays ignored: data/reports/merge-sequence/pr11-master-8fc6c60.log. Existing implementation and physical-device/deployment limitations remain unchanged.


### 2026-11-07T19:04:02.2153211+07:00 — PR13 master merge-sequence verification

- Checked commit: 0dc4bb92f03abbf95f83c140cd1ffda36d473433; branch master. Full-check start 2026-11-07T19:03:08.9677573+07:00; end 2026-11-07T19:04:02.2153211+07:00.
- npm run check PASS: typecheck PASS; tests85/85, zero failures/skips; production build PASS; test:app PASS. Windows, Node24.10.0/npm11.6.1, installed headless Chrome, disposable OpenJLPT fixtures; process/loopback access enabled.
- Journal resolution retains all entries from both sides. Raw log stays ignored: data/reports/merge-sequence/pr13-master-0dc4bb9.log. Existing implementation and physical-device/deployment limitations remain unchanged.


### 2026-11-07T19:07:41.7014949+07:00 — PR12 master merge-sequence verification

- Checked commit: ae3865cb3056390ebc8f9e88202fbbbc6e7ddc31; branch master. Full-check start 2026-11-07T19:06:55.1708048+07:00; end 2026-11-07T19:07:41.7014949+07:00.
- npm run check PASS: typecheck PASS; tests85/85, zero failures/skips; production build PASS; test:app PASS. Windows, Node24.10.0/npm11.6.1, installed headless Chrome, disposable OpenJLPT fixtures; process/loopback access enabled.
- Journal resolution retains all entries from both sides. Raw log stays ignored: data/reports/merge-sequence/pr12-master-ae3865c.log. Existing implementation and physical-device/deployment limitations remain unchanged.

### 2026-11-08T22:24:48.8934952+07:00 — SRS font loading and complete route browser CI

- Checked implementationfd55f025394531effac598e78c8ed37fa32d3fd3; start2026-11-08T22:22:47.7883572+07:00, end2026-11-08T22:24:48.8934952+07:00. Windows Node24.10.0/npm11.6.1, installed headless Chrome, production Next build, disposable fixtures and process/loopback access enabled.
- Full npm run check PASS: typecheck PASS; tests86/86 (22prototype+64foundation/routes), zero failures/skips; production build PASS; test:app PASS16checks.
- npm run test:browser PASS7/7: common-tools, grammar, kanji, shadowing, srs, today-roadmap, vocab. Auto-discovery has no route allowlist; each script runs sequentially with a180s timeout and any failure fails the suite. Per-script logs/summary remain ignored under data/reports/browser-suite/; CI uploads these logs even after failures.
- SRS browser-check explicitly loads Vietnamese/Japanese specimen fonts before asserting document.fonts.check; no app behavior changed. The existing app and all route walkthroughs pass. Auto-discovery regression covers new/nested checks and ignores backup filenames.
- This dedicated test/CI PR changes only the workflow, package script, browser runner/discovery test and SRS browser test, plus this append-only audit. No schema, app behavior, G0 data or private credentials changes. Raw fullcheck/start/end logs stay ignored. Only this audit entry changes after successful checks.

### 2026-11-08T22:31:39.8291032+07:00 — native microphone CI parity follow-up

- Checked56cb12f751f5573c2df460df8aba71f2fd723456; start2026-11-08T22:29:39.4179650+07:00, end2026-11-08T22:31:39.8291032+07:00. Windows Node24.10.0/npm11.6.1, production Next/installed Chrome, isolated fixtures.
- Full npm run check PASS86/86, typecheck/build/app16checks PASS; all7browser checks PASS. Shadowing keeps native fake-device recording/replay/denial assertions, uses full Chromium when no installed Chrome is specified, and emits capture diagnostics on failure.
- First GitHub Ubuntu run passed SRS and6/7browser checks; native microphone initialization failed in default headless shell. This update tests full Chromium instead of skipping microphone assertions. Linux rerun remains required; local pass alone does not establish Linux success.
- Logs data/reports/browser-ci-final-check.log, browser-ci-final-all.log, browser-ci-final-end.json and browser-suite/ remain ignored. Only this audit entry changes after the checked commit.

### 2026-11-08T23:05:53.1538508+07:00 — PR14 scope-always and timeout cleanup review fixes

- Checked implementation2eeaac5a6a197723ad6ef1fb8529ec088ab83eec; start2026-11-08T23:03:47.7255818+07:00, end2026-11-08T23:05:53.1538508+07:00. Windows Node24.10.0/npm11.6.1, locked dependencies, production Next and installed Chrome, disposable data; process/loopback access enabled.
- Full npm run check PASS86/86, typecheck/build/app16checks PASS; npm run test:browser PASS7/7. No managed browser-suite fixture directories remain after the suite.
- Ownership step now always() && startsWith(github.head_ref, 'g1/'). Exactly the one approved assertion in tests/scope.test.ts changed; all other scope assertions retained.
- Runner uses asynchronous child execution with Windows taskkill /T /F or a dedicated Unix process group on timeout. Each check receives a unique runner-owned fixture root; all browser-check changes only select that root, and runner cleanup validates the absolute parent before removal. App/schema/G0 unchanged.
- Temporary detached worktree timeout proof: a fake browser-check started real Next PID16012, health endpoint was ready, then hung. With8000ms test timeout runner returned FAIL/exit1 and timedOut=true; Next PID was absent and its fixture root removed. Fake file/worktree removed without commit. Default real-check timeout remains180000ms.
- Evidence stays ignored under data/reports/timeout-proof/, timeout-check.log, timeout-browser.log and timeout-check-end.json. Only this append-only entry changes after the checked commit.


### 2026-11-08T23:10:22.7945091+07:00 — PR14 master merge-sequence verification

- Checked commit: 179de3db5f549b616835bbff461de011ababe8e1; branch master. Full-check start 2026-11-08T23:09:28.4155906+07:00; end 2026-11-08T23:10:22.7945091+07:00.
- npm run check PASS: typecheck PASS; tests86/86, zero failures/skips; production build PASS; test:app PASS. Windows, Node24.10.0/npm11.6.1, installed headless Chrome, disposable OpenJLPT fixtures; process/loopback access enabled.
- Journal resolution retains all entries from both sides. Raw log stays ignored: data/reports/merge-sequence/pr14-master-179de3d.log. Existing implementation and physical-device/deployment limitations remain unchanged.

### 2026-11-08T22:38:14.5386412+07:00 — Windows home deployment preparation only

- Checkedcbec3942903e5c7a073d70b7f87ce9cf91855129; start2026-11-08T22:36:59.8278677+07:00, end2026-11-08T22:38:14.5386412+07:00. Full npm run check PASS86/86 (22prototype+64foundation/routes), typecheck/build/app16checks PASS; Windows Node24.10.0/npm11.6.1/installed Chrome, disposable fixtures.
- PowerShell home-tasks default PLAN_ONLY ran without registering tasks. App logon/restart and daily/logon backup registration require explicit -Apply and owner step approval. No service/task/Tailscale/production-checkout/D-drive changes were made.
- Backup test creates a fixture archive, copies outside its synthetic project, validates SHA256/all archive entries and temporary DB integrity/FK/schema; current live fixture remains modified and untouched by restore verification. Corrupt copies and differing existing destinations are rejected; inside-project destinations are rejected.
- Runbook targets C:\Users\Admin\NihonNihon and D:\NihonNihonBackup, explains interactive logon (not pre-login),3restart attempts, tailscale serve HTTPS/APP_ORIGIN, npm run backup:daily then copy, D same-machine failure limitation and weekly removable/phone copy, and owner acceptance checks. Actual reboot/phone/mic/D-copy acceptance remains pending.
- Raw plan/test/check logs stay ignored under data/reports/. Only this audit entry changes after successful checks. No schema/G0/private secrets or deployment side effects.

## 2026-11-08 — PR #15: approved S4U task plan and daily backup corrections

- Checked commit: `0b637c647aa93906212085ed947d67c701479483` (`codex/deploy-home`).
- Full local gate: 2026-11-08T23:32:26.1130636+07:00 → 2026-11-08T23:33:24.2350728+07:00; Windows, Node 24, public OpenJLPT fixture.
- `npm run check`: PASS — typecheck, 86/86 tests (22 prototype + 64 TypeScript), production build, test:app 16/16 checks.
- Additional checks: all three PowerShell scripts parsed; PLAN_ONLY confirmed S4U/Limited, app startup, backup daily23:30, and absolute NodePath in both task actions. Confirmed no AtLogOn trigger, no duplicate backup:daily invocation, and append redirection for app.log.
- Scope: only three deploy scripts and docs/deploy-home.md; infrastructure branch has no G1 route mapping. This audit is append-only.
- Owner approved S4U for both tasks; scripts remain plan-only without -Apply. No task was registered, no service/Tailscale changed, and D: was not written. Actual reboot-without-login, phone HTTPS, scheduled backup and restore integrity acceptance remain pending deployment approval.

## 2026-11-08 — PR #15: verify after preserving both master and deployment journals

- Checked merge commit: `6ec9dbec540715de722fa7d8c35238681ec01254`; merged origin/master `17f3e3b63e4ef2b8778acdda9a8d04fdc14c3f80` into codex/deploy-home. Only conflict was docs/foundation-verification.md; retained the complete master text and the full branch-only suffix.
- Full gate: 2026-11-08T23:37:37.0586672+07:00 → 2026-11-08T23:38:24.3349371+07:00, Windows/Node24.
- `npm run check`: PASS — typecheck, 87/87 tests (22 prototype + 65 TypeScript), production build, test:app 16/16. The extra test is inherited from master; the approved deployment corrections remain unchanged.
- No task installation, live deployment, Tailscale changes or D: writes. Reboot without interactive login and phone/backup acceptance still require the later approved deployment steps.

## 2026-11-08 — master after PR #15 merge and deployment operation notes

- PR #15 merged using Create a merge commit: `82cd6a553cd99d8f9e75885f603fcda6a94bbb08` (reviewed head b104ab7, CI 42501010442 SUCCESS).
- Checked commit: `38eab287568d3238535f651599d916e3e04a775c`; adds only the two requested deployment notes: re-register tasks after Node upgrade/path changes, and check the non-rotating appended app.log monthly.
- Full gate: 2026-11-08T23:43:42.1075082+07:00 → 2026-11-08T23:44:48.1104131+07:00; Windows, Node24, public fixture.
- `npm run check`: PASS — typecheck, 87/87 tests (22 prototype + 65 TypeScript), production build, test:app 16/16.
- No installation, task registration, Tailscale changes or D: writes. Physical deployment acceptance remains pending.

## 2026-11-09 — register JLPT daily ownership

- Checked commit `9e3d415c041617f80d12ea252ae62a0447013b8c`, isolated branch `codex/g1-register-jlpt`.
- Full gate `2026-11-09T22:49:41.9160815+07:00` → `2026-11-09T22:51:23.1422246+07:00`, Windows/Node24: typecheck PASS; tests **87/87** (22 prototype +65 TypeScript); build PASS; test:app PASS (16 checks).
- `node tools/check-route-scope.mjs origin/master foundation`: PASS. Registers only `g1/jlpt-daily` and its `/jlpt` alias (the existing Today link); no feature implementation, schema, DB, auth or navigation change.

- Owner-requested whitespace correction checked at `5798864763f5720a25820b2089cd54c16db5cdde`: full check PASS (87/87 tests, typecheck/build/test:app), `2026-11-09T22:56:39.1911487+07:00` → `2026-11-09T22:57:53.4657032+07:00`. Foundation scope guard PASS.
- CI diagnosis: `pull_request:` is unfiltered, so codex/* PRs into master do trigger it. Run `42649184927` passed npm run check but failed the existing Vocab browser check at line173 (30s waiting for “Mở nghĩa”). Only the G1-specific scope step was skipped for this codex branch. No workflow or Vocab code was changed here.

## 2026-11-09 — Vocab lesson browser prerequisite regression

- Checked implementation `03f750cf0dd79d3804001ffcb83649af22b8f933`, isolated `codex/vocab-lesson-check` from master `215e48a`. Scope is Vocab plus this append-only entry; no app behavior/schema/workflow/G0 changes.
- Reproduced the master timeout with diagnostics only: lesson HTTP **423**, body “Bài mới đang khóa…”, no page errors. The default2026-11-02 start date entered its second week on2026-11-09 without prior shadowing. The fixture had8 active vocab/0 initial cards and the preceding save left1 card; this was the real lesson prerequisite, not a missing word, renamed button or render exception. Screenshot/body/server output saved in gitignored data/reports/vocab-regression/before-*.
- Fixture now isolates settings/roadmap/backup paths, starts two weeks before its local date, explicitly verifies missing-shadowing423 and accessible SRS, then supplies a valid25-minute/two-clip makeup. All existing reveal/save/next assertions remain unchanged. Lesson entry after makeup is HTTP200 with “Mở nghĩa”; screenshots/body/server diagnostics persist locally.
- `npm run check` PASS, `2026-11-09T23:27:37.4473809+07:00` → `2026-11-09T23:28:48.6610409+07:00`: typecheck, **87/87** tests (22 prototype +65 TypeScript), production build, test:app **16/16**. Windows/Node v24.10.0, public fixture and synthetic translations only.
- `npm run test:browser` PASS **7/7**, `2026-11-09T23:28:48.6610409+07:00` → `2026-11-09T23:29:54.6105984+07:00`; includes Vocab locked/unlocked policy regression and original reveal/save/next checks. `node tools/check-route-scope.mjs origin/master g1/vocab`: PASS. Raw logs/summary in gitignored data/reports/.
- Owner policy: never merge a red-CI PR without separate explicit owner approval. No G0 worker or production data/backup touched; only temporary browser fixtures cleaned by tests.

## 2026-11-09 — JLPT weekly practice feature

- Checked implementation `4118fa5d2d1a01ddfee3568cac69ba8d0a762bb3`, branch `g1/jlpt-daily`, rebased onto master merge `215e48a88888a8d9496b90f5ec46fc34544eeaef` (PR #26).
- Full gate `2026-11-09T23:10:34.6488231+07:00` → `2026-11-09T23:11:58.6807889+07:00`; Windows, Node v24.10.0/npm11.6.1, isolated public OpenJLPT fixture. `npm run check` PASS: typecheck; **95/95** tests (22 prototype +73 TypeScript, including8 route tests); production build; test:app **16/16**.
- Route browser-check PASS on the same commit, `2026-11-09T23:12:24.7016767+07:00` → `2026-11-09T23:12:32.7908860+07:00`: authenticated alias/empty week, CSRF, desktop1440/mobile390, 10 sequential answers including final explanation, reload/resume, server grading/idempotency, wrong-answer SRS, no external API requests. Raw artifacts: gitignored data/reports/jlpt-daily/.
- `node tools/check-route-scope.mjs origin/master g1/jlpt-daily`: PASS. Only registered route files and this appended entry; no schema/shared/workflow/G0 edits. Feature PR remains unmerged.
- Weekly generation/independent QA tested with fixtures, not a real model or copyrighted exam content. Semantic AI QA quality and physical-phone use remain unverified; route JSON backup requires a later foundation extension, documented in the route README. No G0 worker interruption or translation/data/backup deletion.

## 2026-11-09 — JLPT rebase after green Vocab fix

- Owner approved merging PR #28 only after CI SUCCESS. Head `8bf509a49e759b2c31b5f3fa84119074284e5fe0` passed run `42655579103`; merged using Create a merge commit as `fcb4fa7f55f8cf09f7a1bad0dd28bee4ed48e62a`. Master push run `42656281523` then completed **SUCCESS** before this rebase. No red-CI merge or admin override.
- App master full check after merge: `2026-11-09T23:35:13.9583550+07:00` → `2026-11-09T23:36:29.3185019+07:00`, checked `fcb4fa7`: typecheck, **87/87** tests, build, test:app **16/16** PASS. No documentation pushed directly to master.
- PR #27 rebased onto `fcb4fa7`; checked rebased commit `e6aea5931fc8e86e73bb8e2121a019a39025fd4d`. Preserved every master and JLPT verification entry when resolving the append-only journal conflict. No feature code changes in this rebase.
- Fresh `npm run check`: **PASS**, `2026-11-09T23:39:01.3365349+07:00` → `2026-11-09T23:40:20.3606676+07:00`, Windows/Node v24.10.0: typecheck; **95/95** tests (22 prototype +73 TypeScript); production build; test:app **16/16**.
- Fresh `npm run test:browser`: **8/8 PASS**, `2026-11-09T23:40:20.3606676+07:00` → `2026-11-09T23:41:40.3108619+07:00`, including JLPT and Vocab locked/unlocked/reveal/save/next checks. Scope guard `origin/master g1/jlpt-daily`: PASS; only registered JLPT routes and appended audit entries differ from master. Logs: gitignored data/reports/jlpt-daily/rebase-* and data/reports/browser-suite/.
- PR #27 remains unmerged for tester. Fixtures only; no real AI call, G0 worker/process/config/data operation, production data or backup deletion, or task/service change.

## 2026-11-10 — private shadowing media and sentence recordings

- Checked implementation: `85c0aaa673185b34c1f060e41f79ef9b25d37c44` (`codex/shadowing-erin`), based on `origin/master` `0b43073c1fc051968af27d0ced44989d7674078a`.
- Windows, Node 24.10.0, npm 11.6.0, installed Chrome with fake microphone for browser fixtures.
- Full `npm run check`: 2026-11-10T21:52:15.0984057+07:00 → 2026-11-10T21:53:40.9692519+07:00. Typecheck PASS; prototype 22/22 and app/unit 76/76 PASS (including 6 shadowing tests); production build PASS; test:app PASS (16 checks).
- All `npm run test:browser`: 2026-11-10T21:54:12.3922904+07:00 → 2026-11-10T21:55:35.9774325+07:00, 8/8 routes PASS; shadowing 17/17 checks with synthetic video only. Scope guard `node tools/check-route-scope.mjs origin/master shadowing` PASS (12 changed route files; verification log append-only).
- Private local operator evidence, excluded from Git: clip import 6 segments / quick_check ok / FK0; positive import + overlap rejection + SHA mismatch rejection 3/3 PASS, rejected inputs leave app DB unchanged. Local real MP4 decode/playback and authenticated206 verified; official kana/speakers preserved. GPU word-timing proposals and SRT are pending tester review. No private clip/script/recording/DB/result committed; no Frozen data/schema changes.
- Physical phone, Tailscale deployment and timing approval remain pending. Recording tests use a fake microphone; this route keeps takes only in browser memory until downloaded.

## 2026-11-10 — verification environment correction (shadowing)

- Correction to the preceding entry: installed npm is **11.6.1**, not 11.6.0. No implementation changes.
- Rechecked head `f4ee53c372b7addfb4cbbfb643ebec83083f290c` before this documentation push: `npm run check` 2026-11-10T21:59:56.3853323+07:00 → 2026-11-10T22:01:36.2321541+07:00, typecheck PASS, prototype22/22 + app/unit76/76 PASS, build PASS, test:app16 checks PASS. Browser8/8 and shadowing17/17 results above apply to the unchanged implementation. Route scope guard PASS; this entry is append-only.

## 2026-11-10 — explicit private clip bounds and long-gap skipping (PR32)

- Checked implementation `82168dec10ac9264a9a1f1f915e9556f48fda7ae` on codex/shadowing-erin, Windows/Node24.10.0/npm11.6.1.
- `npm run check` 2026-11-10T22:30:56.4178409+07:00 → 2026-11-10T22:32:34.9069046+07:00: typecheck PASS, prototype22/22 + app/unit78/78 PASS, build PASS, test:app16/16 PASS.
- `npm run test:browser` 2026-11-10T22:33:17.4743317+07:00 → 2026-11-10T22:35:35.4184095+07:00: 8/8 routes PASS, shadowing18/18 PASS (explicit start/end clamping and >3s gap skip included). Scope `origin/master shadowing` PASS (13 route files, append-only verification).
- Private manifests require clip_start_ms/clip_end_ms, safe10–60s range within source, and every sentence within clip bounds. Whole playback uses margins and skips only gaps >3s; sentence repeats keep original boundaries. Private Erin revision55.6–90.5s imported through G0 importer into separate app DB; original six segment JSON SHA unchanged. Real local file playback proves54→55.6/91→90.5 clamping and65→77.24 gap skip. No media/source/Frozen/schema change or private data commit.
- Synthetic browser fixture uses2×public WebM TimecodeScale,0.5–17.5s bounds and6s gap; source decode8.94705s becomes17.894101s. Initial18±.1s assertion failed due codec duration, replaced with exact2×decoded-source assertion (<.001s) plus physical duration covering clip end. Bounds/gap assertions unchanged. No new binary, codec dependency or Erin in CI.
- Six sentence timings and phone microphone acceptance remain pending owner/tester listening. No service/task registration or media upload.

## 2026-11-11 — home PowerShell stderr and iOS media lengths

- Implementation 0f1b6427548298650f58be83bd08f19a890cc4a0; Windows, direct D: isolated worktree, Node v24.10.0. Full npm run check 2026-11-11T21:56:46.2622012+07:00 to 2026-11-11T21:57:53.7118367+07:00: typecheck PASS, prototype22/22 + app/unit80/80 PASS, build PASS, test:app16/16 PASS. Shadowing browser-check 2026-11-11T21:57:53.7848950+07:00 to 2026-11-11T21:58:16.4500066+07:00:18/18 PASS.
- Windows powershell.exe5.1 regression:20 native SQLite stderr-warning requests stay alive, append-log and exit7 propagation PASS. Actual built Next via home-run.ps1 also survives20 requests; curl bytes=0-1 /bytes=0- /bytes=30000000- returns Content-Length2 /34121397 /4121397 with matching Content-Range and no chunked transfer. Automated32MB synthetic sparse-file HTTP regression covers200/206/HEAD/416, suffix/open/tail ranges, exact incremental byte counts and authentication.
- Only native node invocation uses Continue; setup stays fail-fast. Optional Port defaults3000. Node API response streams files with fixed lengths because the installed App Router sendResponse adapter filters Content-Length; /shadowing/media rewrites to authenticated /api/shadowing-media. Pages compatibility adds generated navigation types and a null-safe pathname. Full200 uses Content-Length, ranges206 also have Content-Range. No full-file buffering.
- Production source/task unchanged, no restart/merge, no DB/schema/secret/Tailscale change. Real iOS acceptance pending. All raw media/proofs/logs stay local and ignored.

## 2026-11-13 — Safari shadowing seek tolerance and loop entry

- Implementation 326461447471d9fe9461cdc072a91e3563d147e9 on codex/shadowing-ios-seek, based on PR35 commit433b2f8; direct D: Windows worktree. Full npm run check 2026-11-13T15:01:08.7202225+07:00 → 2026-11-13T15:02:47.3861878+07:00: typecheck PASS,22/22 prototype +83/83 unit PASS, build PASS, test:app16/16 PASS. Shadowing browser-check 2026-11-13T15:02:47.4387890+07:00 → 2026-11-13T15:03:10.9920372+07:00:20/20 PASS; scope against origin/codex/home-deploy-fixes PASS.
- Seek correction only for errors greater than0.25s; start keyframe55.458 for55.6 is allowed. Seeking events return before clamping/counting. A sentence must be entered during actual playback before its end can count; every new repeat resets entry. Loaded metadata preserves an in-range/pending selected sentence; play remains synchronous in the click gesture after setting currentTime.
- Three model regressions simulate rounded keyframes, old times while seeking, paused media, consecutive repeats, large corrections and whole-clip end stop. Browser regression drives actual React handlers with a synthetic controllable media element, verifies user activation, no feedback seeks, metadata handling, whole clip stop and exactly one sentence completion. Existing native video/microphone checks remain. No private media/captions, schema, DB or credentials committed. Physical iPhone/iOS27 acceptance remains owner/tester work after deployment; no merge.

## 2026-11-13 — launcher child lifetime follow-up in Safari PR36

- Checked implementation 2cda1861f02b00444005a68583551779da2c73f6, direct D: Windows worktree. npm run check 2026-11-13T15:10:17.9370626+07:00 → 2026-11-13T15:11:19.3512884+07:00: typecheck PASS,22/22 prototype+84/84 unit PASS, build PASS, test:app16/16 PASS. Shadowing browser-check 2026-11-13T15:11:19.3905891+07:00 → 2026-11-13T15:11:41.5955519+07:00:20/20 PASS.
- Owner explicitly added launcher/stop lifecycle to this PR scope. home-run.ps1 joins a Windows Job Object before node is spawned; the sole non-inheritable handle stays in PowerShell and KILL_ON_JOB_CLOSE ends all children if Task Scheduler force-stops it. No finally/SIGTERM dependency and no start/assign race. Setup fails before spawning node if protection cannot be installed.
- Windows PowerShell5.1 tests:20 SQLite-warning requests/log append/exit7 still PASS; a separate test force-kills only the launcher (not taskkill /T), proves the child exits and rebinds its old port. Existing Safari snap/stale-seek/user-gesture tests remain PASS. Deployment docs require stop task AND verify the port is free; legacy orphan PIDs require verified owner/admin cleanup once.
- Local gates PASS; no claim of real Task Scheduler/iPhone acceptance until deployed. No production node was killed: old port3000 listener PID19300 is inaccessible for CWD/command-line verification and still requires owner Administrator cleanup. Original shadowing-only scope gate at3264614 applies before this owner-requested shared addition. No schema/data/credential change or merge.
## 2026-11-11 — private optional YouTube metadata and iframe Referer (PR34)

- Checked implementation `4b3297a958cc24d84528525589d8574479d6aef0` on codex/shadowing-youtube, based on Erin `f006805abc10c00130826e0bddb4054d4b4b39ce`. This replaces the prior four PR34 commits to remove channel subtitles from this branch's reachable history. Public fixtures and documentation contain no channel captions.
- Direct D:/NihonNihon/Nihon Nihon/youtube-shadowing; Windows, Node v24.10.0. Full `npm run check` 2026-11-11T13:35:49.6123930+07:00 → 2026-11-11T13:37:02.6862467+07:00: typecheck PASS; prototype22/22 + app/unit80/80 PASS; production build PASS; test:app16/16 PASS. The first sandbox run hit EPERM replacing temporary JLPT fixture files; the unchanged implementation and tests passed outside the sandbox.
- Shadowing browser-check 2026-11-11T13:37:02.7102041+07:00 → 2026-11-11T13:37:25.8645515+07:00:21/21 PASS. Original synthetic YouTube captions only; no request before consent; origin-only Referer and strict-origin-when-cross-origin iframe policy verified with intercepted requests; sentence timing/highlight, microphone, private file playback and runtime omission after removing the fixture file pass. Live YouTube and phone playback remain pending owner review.
- Optional data/private/youtube-clip.json is gitignored and read at request time (NIHON_YOUTUBE_CLIP_PATH override for tests). Missing file omits only the YouTube clip; invalid metadata still fails validation. Owner's VI correction is private only. No schema, G0, OS/task, video/audio download, or AI change. Scope against origin/codex/shadowing-erin:PASS. No merge.

## 2026-11-14 — replacement YouTube PR rebased on master

- Checked 7c9057367c03b7738cae9f39a258e4608d8e69a9 based on master2d0a98e; preserved Safari seek tolerance/entered state/metadata fixes, Node range endpoint and launcher Job Object. All log entries from both sides retained.
- Full npm run check 2026-11-14T19:09:11.4241994+07:00 → 2026-11-14T19:11:24.8434776+07:00: typecheck PASS, prototype/unit counts 22/86 PASS, build PASS, test:app16/16 PASS; shadowing browser23/23 PASS (Safari simulation, YouTube deferred iframe/referrer and missing optional metadata, native media/microphone). Scope against origin/master shadowing PASS. No API calls/private caption commit. Metadata copied to ignored deploy data/private and SHA verified; deploy remains master until YouTube PR approved.
## 2026-11-10 — isolated JLPT draft from Frozen roadmap snapshot

- Checked implementation: `3c13bd5e8c4b26908b8c10b87d9759887ad5208b` (`codex/jlpt-first-week`), based on `origin/master` `0b43073c1fc051968af27d0ced44989d7674078a`.
- Windows, Node24.10.0/npm11.6.1; tests use synthetic fixtures and never call Gemini.
- Full `npm run check`: 2026-11-10T21:58:10.3727378+07:00 → 2026-11-10T21:59:46.7064411+07:00: typecheck PASS; prototype22/22 and app/unit77/77 PASS (12 JLPT tests); build PASS; test:app16 checks PASS.
- All `npm run test:browser`: 2026-11-10T22:00:32.5331615+07:00 → 2026-11-10T22:02:23.1007967+07:00, 8/8 routes PASS. Scope `node tools/check-route-scope.mjs origin/master jlpt-daily` PASS (7 route files, append-only log).
- Private pilot: mode=draft_roadmap, N5, actual Today roadmap weeks1–2, read-only Frozen snapshot. First day10 questions passed the existing structural + independent semantic QA after one repair round; accepted day is saved for resume. Next-day generation stopped on HTTP503 UNAVAILABLE/high demand. No app bank/DB publication; semantic quality and review remain tester-pending. Frozen live DB and snapshot SHA-256 were reverified unchanged. Requests contain only public OpenJLPT fields. Private banks, reviews, API outputs and quota ledger excluded from Git.
- Production learned-content gate is unchanged. Draft output is not SRS evidence. Remaining60 questions need a later model-available run; no background API worker is left running.

## 2026-11-10 — deterministic JLPT hard gate and selective repairs (PR33)

- Checked implementation `1d8c7ba634c9afdde60dd19d47c0083ac8efcc3b` on codex/jlpt-first-week, Windows/Node24.10.0/npm11.6.1.
- `npm run check` 2026-11-10T22:19:52.1849365+07:00 → 2026-11-10T22:22:00.3703738+07:00: typecheck PASS, prototype22/22 + app/unit84/84 PASS, build PASS, test:app16/16 PASS. New tests cover marked reading/no leak, spelling/near same-level distractors, plain choices, order/key/explanation/word overlap, paragraph/gap/type shape, selective hard rejection and 503 checkpoint preservation.
- `npm run test:browser` 2026-11-10T22:23:27.9155513+07:00 → 2026-11-10T22:25:38.5477698+07:00: 8/8 routes PASS. Scope `origin/master jlpt-daily` PASS (12 route files, append-only log).
- Private10-question repair: hard gate rejected8 original rows;2 kept unchanged. Exactly8 rejected slots regenerated. Four regenerated rows failed hard QA and never reached Gemini QA; other4 pending independent QA when the verify call returned HTTP503 UNAVAILABLE/high demand. Stopped immediately (2 real requests total: generate + failed verify), no repeated503 calls, no publication/app DB writes. Review0002 explicitly labels rejected/pending rows. Old review status marked superseded, original raw outputs preserved. Frozen snapshot unchanged; only public OpenJLPT payloads sent.
- Model QA is still required after the deterministic gate and tester review is still pending. No auto-correction of raw options/order keys; no gate relaxation or schema changes.
