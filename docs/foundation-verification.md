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
