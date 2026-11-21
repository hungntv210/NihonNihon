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

## 2026-11-10 — kana-only spelling stem edge case (PR33)

- Checked implementation `49ad2f77a974e1956098c0f8160cac7a05518995`, Windows/Node24.10.0/npm11.6.1. Spelling stems now reject every non-kana letter (including Latin instruction text), while allowing punctuation/numbers. Added a Latin-stem negative case to the spelling test; no further API calls.
- `npm run check` 2026-11-10T22:35:19.1404139+07:00 → 2026-11-10T22:37:09.5407599+07:00: typecheck PASS; prototype22/22 + app/unit84/84 PASS; build PASS; test:app16/16 PASS.
- `npm run test:browser` 2026-11-10T22:38:00.2467378+07:00 → 2026-11-10T22:39:42.6420863+07:00: 8/8 routes PASS. Scope `origin/master jlpt-daily` PASS (12 route files plus append-only audit). Private repair/review0002 remains2 retained +4 hard-rejected +4 awaiting Gemini QA after503; zero publication. Previous head e66aceb had CI runs42845189270/42845266564 SUCCESS; final-head CI must be checked separately after this push.

## 2026-11-10 — exact ★ reconstruction and typed distractors (PR33 tester follow-up)

- Checked implementation `f566e721e3c5d2f60faabb943a840c69c874ddac`, Windows/Node24.10.0/npm11.6.1. No PR32/G0/schema/shared changes.
- `npm run check` 2026-11-10T23:11:02.3349532+07:00 → 2026-11-10T23:12:25.8246267+07:00: typecheck PASS; prototype22/22 + app/unit88/88 PASS (23 JLPT tests); build PASS; test:app16/16 PASS.
- `npm run test:browser` 2026-11-10T23:12:25.8339407+07:00 → 2026-11-10T23:13:45.9138794+07:00: 8/8 routes PASS. Scope `origin/master jlpt-daily` PASS (12 route files plus append-only audit), base still0b43073.
- Order requires one quoted Câu field equal to the complete filled stem (NFC/whitespace only; preserves words/punctuation), a4-element permutation, strict sequence/key and all fragments exactly once. Tests reject substring-only answers, added/missing/repeated words, unused fragments and ★=10 matching a key of1.
- Reading distractors: same kana script, bounded weighted-mora similarity; dictionary alternatives same level/target lexical category, source-derived misreadings retain source level. Spelling requires near-sound/shape plus same category; synonym must be a same-level catalog word with Japanese word script. The target's first lexical POS is shared by all4 options; vt/vi are flags, not lexical types. Tests cover the supplied ことし/こんねん/きょねん/ことしい example and unrelated/wrong-script/wrong-level/wrong-POS negatives, including noun/adverb mixing.
- Read-only Frozen roadmap audit: 私 absent in weeks1–2; N5 word atweek10 (わたくし), N4 kanji atweek22. No whitelist exception added; test rejects when absent and allows when present in approved catalog. Prompt uses わたし when absent.
- Private resume/review0003: retained2 accepted rows unchanged;6 hard rejects;2 pending rows verified but returned4 possible answers and were semantic-rejected. Next generation of only8 rejects returned503 UNAVAILABLE/high demand; stopped after2 actual requests, no additional retries or app publication. Review0003 explicitly labels2 retained/6 hard/2 semantic rejects (not a completed bank). No new accepted question text. Frozen source/previous raw outputs preserved; private data excluded from Git.

## 2026-11-14 — PR33 rebase onto merged home/iOS master

- Checked 2237cdd5bcd9702eed9db8906ec0a6940fc6749f on codex/jlpt-first-week, rebased onto master2d0a98e; all verification entries from both sides retained. No generation/model calls or private data publication.
- Full npm run check 2026-11-14T19:09:25.9694216+07:00 → 2026-11-14T19:11:24.6952352+07:00: typecheck PASS, prototype/unit counts 22/99 PASS, build PASS, test:app16/16 PASS; JLPT browser-check PASS (auth/CSRF/alias/empty week/10 answers/resume/SRS/idempotency/no API). Old generated .next/types from the removed App media route were cleaned and regenerated; no source rule weakened. PR33 remains unmerged.

## 2026-11-14 — PR33 integration after YouTube merge

- Checked 819448797d5faea52f7b6a8083429b6c71f49580 rebased onto mastered6b8a6 after PR37 squash; all verification entries from both conflict sides retained. Owner-requested shadowing feature status now marks Erin and YouTube accepted on iPhone, with personal-file clip still pending; no unsupported full-feature completion claimed.
- npm run check 2026-11-14T19:27:11.4093703+07:00 → 2026-11-14T19:28:47.3200135+07:00: typecheck PASS, prototype/unit 22/101 PASS, build PASS, test:app16/16 PASS; JLPT browser PASS. No model call, source data change, private file publication or schema change.

## 2026-11-14 — automatic eligible shadowing and checklist reconciliation

- Checked implementation 0611cf24b442880d36d33aa6666ac67d10b46978 on codex/shadowing-auto-session from master3a90609; Windows/Nodev24.10.0, direct D worktree. Full npm run check 2026-11-14T20:35:15.5915522+07:00 → 2026-11-14T20:36:20.1432923+07:00: typecheck PASS,22/22 prototype+111/111 unit PASS, build PASS, test:app16/16 PASS. Focused shadowing browser 2026-11-14T20:36:20.2133472+07:00 → 2026-11-14T20:36:59.6498277+07:00:26/26 PASS. Prior full browser suite8/8 passed on9e75c4a before added strict restore-map validation/server-clock delayed delivery regression; CI must run all routes on the published head before merge.
- Conditions remain15min actual practice, all sentences in at least one real clip recorded, each duration70percent minimum, distinct local day. Metadata-only recording events; no audio endpoint. Active meter excludes hidden/paused/stalled/seeking/suspended playback, counts recording and moving own-audio replay. Server validates clip/sentence IDs, caps credit by server elapsed time without losing measured time on delayed network delivery, and deduplicates sequences/tabs/day. Inactive tab heartbeats do not steal active-tab credit.
- Progress and automatic regular entry atomically share existing locked roadmap JSON, session cookie hashed per-login/day. Existing Today/lesson gate accepts automatic regular entries; no automatic makeup or weaker unlock. Manual fallback retained. Tests cover every missing condition, same-day manual/auto/multiple logins, replay, parallel tabs, malformed restore, reload persistence, CSRF/audio rejection, delayed onstop and valid automatic status in Today. Browser seeds synthetic metadata at14m59s only in fixture storage, no production clock bypass.
- All nine feature checklists reconciled with named source/tests; incomplete composites and unmeasured coverage/performance remain unchecked. No schema, private dictionary/video/DB change, real AI calls or secrets committed. Owner explicitly authorized shared Today/progress integration and docs alongside shadowing for this PR.

### 2026-11-14 — JLPT draft resume and paced fallback

- Checked commit: 60de2356c8821dd918dd3a76eec17fe4e4d56dd7.
- Full check start: 11/14/2026 21:54:25; end: 11/14/2026 21:56:13. Windows, Node24, D: worktree; no real API in fixture tests.
- npm run check PASS: typecheck, prototype22/22, unit115/115, production build, test:app16/16.
- JLPT route browser-check PASS (auth/CSRF/alias, desktop/mobile, ten answers, resume/SRS/idempotency, no external API); scope guard against origin/master for jlpt-daily PASS.
- Added fixture checks: sparse accepted-slot checkpoint survives API interruption; 503 waits30/60s then switches and records actual fallback; quota stops without fallback; six-call outage cap and incomplete output rejection. Hard/semantic QA gates unchanged.
- Actual owner-authorized private draft run:2 retained unchanged+3 new=5/70;4 successful gemini-3.5-flash-lite requests;0 fallback/503/429. Stopped at existing two-repair bound with3 unlearned-kanji and2 spelling-marker rejections remaining. No bank publication/app DB writes, questions or private data committed.

### 2026-11-14 — partial JLPT days and bounded per-slot repair

- Checked commit c5ce2a90b4c872fd6294d731b31e235f6e445ec6, Windows/Node24/D: worktree. Start 11/14/2026 22:46:36; end 11/14/2026 22:48:08.
- Full check PASS: typecheck, prototype22/22, unit117/117, build, app16/16. JLPT browser-check and route scope guard PASS.
- Fixture tests cover seven-day-first scheduling, retained partial checkpoint, repair of only missing positions, explicit forbidden/allowed kanji and exact spelling rule, five-repair bound with hard rejects still excluded. Semantic payload labels each local audit index explicitly.
- hard-qa.ts, model.ts and retry/quota provider are byte-unchanged from master. No manual question/answer correction or app publication. Private generation started from5 retained questions; aggregate results/rejection reasons stay private and final PR summary will state actual totals.

### 2026-11-14 — strict draft QA and independent model audit

- Checked b558c025c61ebde142e907221c1376e91e582dff, Windows/Node24/D: worktree. Start 11/14/2026 23:27:19; end 11/14/2026 23:28:37.
- Full check PASS: typecheck, prototype22/22, unit120/120, build, app16/16; JLPT browser and route scope guard PASS.
- Tests reject conflicting answer ordinals (digits/fullwidth/written), misplaced order markers, verbatim key leaks and unattested word surfaces. Local Intl.Segmenter/dictionary checks fail closed; valid inflections without evidence may be rejected and are not silently whitelisted.
- Independent solving hides key/explanation, requires naturalness/factual correctness and a matching independently chosen answer; separate explanation audit follows. Fixture proves verifier differs from actual generator even after fallback. Existing hard/semantic/quota gates retained.
- Authorized private re-audit of54:46 hard rejects,8 independently accepted by3.1 Flash Lite before any new generation. Overlapping hard flags:14 answer-number,27 misplaced-order,24 unattested-word,4 key-leak. Generation continues privately with old per-slot repair counters; no app publication, question text or private dictionaries in this PR.

### 2026-11-14 — completed-choice grading and duplicate draft guards

- Checked 36bce920047144ccd838bf931384144fc0f60c3b, Windows/Node24/D: worktree, 11/14/2026 23:47:55 to 11/14/2026 23:49:18.
- Full check PASS: typecheck, prototype22/22, unit122/122, build, app16/16; JLPT browser and scope guard PASS.
- New regressions: all4 exact filled choices, multiple acceptable answers, wrong collocation/key, wrong verb form, silent conjugation rejected; stem-word/base-stem overlap and reading/spelling word-pair rejects. Isolated grades independently reject a competitor even when the first blind audit approves only its claimed key.
- Verifier now stores4 detailed optionGrades AND4 isolatedOptionGrades; both must admit exactly one stored answer. Isolated pass sees completed sentences without target/key/competing options. Stored order is also hidden; possible star completions must be independently assessed. Existing hard/lexical/semantic/quota gates retained.
- Actual first24 re-audit was completed before generation. A target-biased audit still missed tester examples; own worker was stopped and all24 re-audited with isolated pass before resuming. Final retained5/24:4 stem-word,1 reading/spelling-pair,5 multiple-answer,2 contradictory-grade,7 unexpected-order audit rejects. All text/key values unchanged. Fresh per-slot campaign counters explicitly authorized; counts already spent in the interrupted run were carried forward, quota ledger never reset. Draft results/sample remain private, unpublished.

### 2026-11-15 — grounded Japanese words, N5 context and typed draft prompts

- Checked 506d26339f5ebc188af45be21b20516593c0446f, Windows/Node24/D: worktree, 11/15/2026 10:27:45 to 11/15/2026 10:29:04.
- Full check PASS: typecheck, prototype22/22, unit129/129, build, app16/16; JLPT browser and route scope guard PASS.
- ICU boundary evidence resolves whole attested surfaces and closed N5 function/POS-derived forms; kana/on-kun fragments are never whitelisted as words. Tests cover all reported examples, real invented compound rejection, N5 irregular forms and N4 compound bypass prevention.
- Owner clarified dictionary CONTEXT evidence is N5-only. Target catalog/kanji/level remain roadmap-only; N4 context, dictionary-only targets and outside-roadmap kanji are tested rejects. Added marked meaning queries, Latin/kana-mix and all-type target uniqueness guards.
- Non-order wire prompts/schema omit order/starSlot and ordering explanation cues. Only neutral internal metadata defaults are added; Japanese/explanation/key are not rewritten. Each typed group is independently audited/checkpointed before another call may change actual generator model. Resume CLI isolated-payload provenance regression tested.
- Actual approved re-audit12:7 retained; overlapping flags2 unmarked query,1 Latin/kana mix,1 no N5 word evidence,1 repeated target,1 multiple acceptable choices.8 proven word-split false-positive positions received recorded counters, already-spent attempts carried; all other counters and Pacific quota unchanged. Generation plus checkpoint resume ended11/70, sample11/30 private, all final gates rechecked; no app publication. Latest remaining-candidate hard diagnostics are recomputed separately from historical reasons.

## Wasoku phase 1 — 2026-11-15T11:56:27.7464617+07:00

Checked implementation: b7bbe6718989ff4a2a988d89e68fbe0ac9efa5d4.
Environment: Windows Node 24.10.0. Full check: 2026-11-15T11:55:25.0062394+07:00 to 2026-11-15T11:56:27.7464617+07:00.
Typecheck PASS; prototype 22/22 PASS; unit 132/132 PASS; production build PASS; test:app 16/16 PASS.
All 9 browser checks PASS, including 4 server periods at 390/1440, real computed contrast >=4.5:1, no horizontal overflow, no external requests, all-menu, and saved/device reduced motion.
The browser suite predates only a test assertion cleanup; its UI and browser inputs are unchanged.
Client JS gzip: 372307 -> 375473 bytes (+3166, below 40960). No new app dependency.
Fonts: Vietnamese UI coverage and Japanese scene specimen PASS via tools/subset-fonts.py.
Scope guard: ui-phase1 PASS. Screenshots and raw proof remain gitignored under data/private/wasoku-phase1 and data/reports.
Only this append-only audit entry changes after the successful full check.

## Wasoku phase 2 — 11/15/2026 12:16:53

Checked implementation: a4cd14dfba52888b5507f90473d023f464dca863.
Environment: Windows Node 24.10.0. Full check: 11/15/2026 12:15:43 to 11/15/2026 12:16:53.
Typecheck PASS; prototype 22/22 PASS; unit 132/132 PASS; production build PASS; test:app 16/16 PASS.
All 9 browser checks PASS, including 4 server periods x 2 widths x 4 primary screens, computed contrast >=4.5:1, no horizontal overflow, no external requests, local fonts and saved/device reduced motion.
Today reads actual due counts, manual activity and roadmap state. FSRS, offline outbox, media, recording and shadowing rules are unchanged.
Client JS gzip: 375469 -> 376000 bytes (+531, below 40960). No dependency added. Original mascot drawings are local static SVG, with no mock learner data.
Scope guard ui-phase2 PASS; screenshots remain gitignored under data/private/wasoku-phase2. Full browser logs remain under data/reports.
Only this append-only audit entry changes after the successful full check.

## Wasoku phase 3 — 11/15/2026 16:23:19

Checked implementation: 7610e86e210b7cdd051714ebd087a424303a81c8.
Environment: Windows Node 24.10.0. Full check: 11/15/2026 16:21:51 to 11/15/2026 16:23:19.
Typecheck PASS; prototype 22/22 PASS; unit 132/132 PASS; production build PASS; test:app 16/16 PASS.
All 9 browser checks PASS unchanged, with expanded appearance coverage: 19 screens x 4 server periods x 390/1440, text/control/placeholder contrast >=4.5:1, no overflow/external requests, local fonts, 87 map nodes opening real week details, completed 15-card SRS and reduced motion. Existing JLPT browser completes 10 questions.
Lesson title heading contracts remain intact for vocabulary and grammar detail pages; Vietnamese function labels sit above them. No learning repository, scheduler, schema or question generation logic changed.
Client JS gzip: 375989 -> 378023 bytes (+2034, below 40960). No dependency added. Local font coverage PASS.
Scope guard ui-phase3 PASS; private screenshots remain in data/private/wasoku-phase3, logs in data/reports. Physical phone performance and production HTTPS depend on the existing host connection.
Only this append-only audit entry changes after the successful full check.

### 2026-11-15 — compact quick label and hash-aware navigation

- Checked 71500a46a7068b95e5a50f8a9fafa82ec471aa52, Windows/Node24/D: worktree, 11/15/2026 20:16:40–11/15/2026 20:18:51.
- npm run check PASS: typecheck, all prototype/unit tests, production build, app16/16. Foundation app browser assertions also verify390px single-line/no-overflow label, mobile/desktop roadmap hash active without Today active, Today click reset, SRS query and shadowing child-path parent active. Synthetic child path uses native history in the fixture, no production route added.
- Scope guard foundation PASS. No schema/data/auth changes.
- Exact successful counts for checked71500a4: prototype22/22, unit132/132, app16/16.

### 2026-11-15 — tester-approved local JLPT bank

- Checked 8eae0e9f8ce182055dd8e898619bde6081df671c, Windows/Node24/D: worktree, 11/15/2026 20:42:57–11/15/2026 20:44:42.
- Full check PASS: typecheck, prototype22/22, unit136/136, build, app16/16. JLPT browser PASS for normal10-question bank AND approved one-question denominator/resume/source badge plus zero-question empty state. Route scope PASS.
- Tests: exact11 approved-set/model/source/QA evidence, reject tampered/rejected input, idempotent import,10→1→0 across weeks without repeat, wrong-answer SRS idempotency, main DB bytes preserved by bank-only import. Separate pinned target append test preserves existing reviews/FKs; no content/schema overwrite.
- Read-only production preflight found all11 target references absent. Real11-question dry-run on a SQLite backup of the app appended11 public OpenJLPT targets and11 approved questions successfully. Importer checks Frozen receipt/SHA, backs up app DB, copies only required public target/release rows and persists draft_roadmap/tester receipt. No rejected question, private dictionary, media or source question text committed. Live import waits for green CI/merge. Standard bank learned gate remains; only this explicitly owner-approved cohort uses its pinned roadmap evidence without fabricated reviews.

### 2026-11-08T23:16:10.7533786+07:00 — Node24 action runtimes, local verification

- Checked implementation4fcb17ac78c0c00ec889a2078a51c8673d28f80b; start2026-11-08T23:14:12.5055748+07:00,end2026-11-08T23:16:10.7533786+07:00. Windows Node24.10.0/npm11.6.1, production Next/installed Chrome and disposable fixtures.
- npm run check PASS86/86,typecheck/build/app16checks PASS; npm run test:browser PASS7/7. Only three workflow references changed: checkout@v5,setup-node@v5,upload-artifact@v7. No step/condition/input changes; merged scope-always, timeout cleanup and native microphone fix remain intact.
- Release verification: https://github.com/actions/checkout/releases/tag/v5.0.0 and https://github.com/actions/setup-node/releases/tag/v5.0.0 document Node24; latest upload major is7 (latestrelease7.0.2), https://github.com/actions/upload-artifact/releases/tag/v7.0.0 and https://raw.githubusercontent.com/actions/upload-artifact/v7/action.yml confirm default archive mode retained and runs.using node24.
- PR14 was already merged179de3d before this instruction; changes are a narrow successor PR from master17f3e3b. GitHub rerun/deprecation-log verification pending first push. Raw local logs remain ignored at data/reports/node24-*. Only this audit entry changes after successful local checks.

### 2026-11-08T23:19:41.2243912+07:00 — Node24 action runtime GitHub verification

- GitHub Actions run42499109186 (job128787763582), head1ef097400db5ed93d5a7ef40a52b341246a7c00e: SUCCESS on Ubuntu24.04. npm run check and all7route browser checks passed; artifact upload and checkout/setup cleanup passed.
- Read the completed job log and found zero Node.js20/node20 mentions or deprecation warnings. Log confirms checkout@v5, setup-node@v5 and upload-artifact@v7. Evidence: https://github.com/hungntv210/NihonNihon/actions/runs/42499109186 . Job finished2026-11-08T16:19:26.3455990Z.
- Exact workflow comparison confirms only the three requested uses references differ from master17f3e3b; scope-always condition, timeout handling, microphone test, all other steps/inputs remain unchanged. Checked application/test tree remains4fcb17a; only append-only audit entries changed after local checks. This entry records the completed remote run; next push changes only this audit.


### 2026-11-15 — PR16 rebased Node24 actions

- Checked 69366cecf1b3bc95fd434d3d6218a447e175cdc2, Windows/Node24/D: worktree, 2026-11-15T20:54:57.6934092+07:00–2026-11-15T20:56:26.4755508+07:00. Full check PASS: typecheck, prototype22/22, unit136/136, build, app16/16.
- Rebased onto master including approved JLPT/local bank. All master and original PR verification entries retained; normalized-prefix proof PASS. Only generated actions-node24/.next/types was removed to discard the deleted App media-route cache; no user data removed.
- Exact workflow comparison PASS: only checkout v4→v5, setup-node v4→v5, upload-artifact v4→v7; all steps/inputs/conditions retained. Primary upstream action.yml for all3 refs verified runs.using node24. This explicitly authorized workflow-only PR is outside feature-route ownership.
- PR23 closed with linked explanation: wait/poll/timeout behavior and tests already live in g0/data-import65d47a5; remaining3.6 example is obsolete under owner decision. No G0 code/data/worker changes.

### 2026-11-15 — Daily backup includes private JLPT bank and attempts

- Checked commit: `2c46453be622228f3516550cdc5b082eb930306e` (`codex/backup-jlpt`).
- Local full check: 2026-11-15T21:21:19+07:00–2026-11-15T21:22:56+07:00, Windows / Node 24, native D: worktree; unrestricted loopback needed for HTTP fixture tests (sandbox attempt denied localhost with EACCES).
- `npm run check`: PASS — typecheck, prototype 22/22, route/core tests 139/139, production build, test:app 16/16 checks.
- Targeted backup tests: 7/7 PASS, including WAL-backed approved bank, eleven synthetic questions, schedule, nonempty attempts and byte/hash comparison after restore into an isolated temporary app root. Existing source data remain unchanged. Legacy archives preserve current JLPT; same-day upgrade preserves the original archive. Fixtures contain no private questions.
- `node tools/check-route-scope.mjs origin/master backup-jlpt`: PASS (registered exact backup-related paths, including approved-store maintenance barrier).
- Existing 23:30 task/destination, integrity checks, file permissions and retention remain in use; no new encryption or task registration. Temporary extraction validates bank integrity/FK/schema and both JLPT file hashes.
- Logs: gitignored `data/reports/full-check-verified.log`, `data/reports/backup-tests.log`. CI and actual deployment/backup verification follow only after push; no claim of production restore at this point.

### 2026-11-15 — Approved route pixel scenes

- Checked SHA `5a24c587484be22a53bbc246af09e6873c6ddc80` (`codex/pixel-scenes`), native D: worktree, Windows / Node 24. Full check 2026-11-15T23:19:18+07:00–2026-11-15T23:20:21+07:00: PASS typecheck, prototype 22/22, core/route tests 145/145, production build, test:app 16/16 checks.
- `npm run test:browser`: 10/10 PASS (2026-11-15T23:15+07:00–23:19+07:00), all original routes retained. Existing appearance assertions now check the replacement canvas, retaining Settings/reduced-motion coverage. New matrix: four scenes × four server periods × 390/1440px = 32 screenshots.
- `node tools/check-route-scope.mjs origin/master pixel-scenes`: PASS (explicit registered scope). No package/dependency/schema/auth/API-gate/data changes. Renderers adapted from owner-approved local scenes; originals untouched.
- Real DAL-backed due count capped at 12, distinct active kanji with actual review events, existing cookie/day shadowing progress with qualifying recording/time fractions; no demo progress or AI calls. Fresh server due IDs prevent cached-session totals from overriding true due counts.
- Server Asia/Ho_Chi_Minh clock/date/month, four real seasons, original date-seeded weather. Production ignores preview query overrides. Scene-specific crop; engine/renderer dynamic imports only on scene routes. Browser checks cover lazy loading, <=30fps, hidden/offscreen pause, settings/reduced static frame and live progress. Koi test exercises 96 heading/tail poses with connected silhouette; pad shadows/slits use water colors.
- Compiled lazy engine + all four scenes: 19,519 bytes gzip; conservative duplicated client-wiring bound 7,750; total 27,269 < 40,960 bytes. Source gzip budget also tested. Private proof: `data/reports/pixel-scenes/bundle-budget.json`, `proof.json`, 32 screenshots, `data/reports/full-check-final.log`, `data/reports/browser-suite/summary.json`.
- CI/merge/deploy follow only after push and green CI. Deployment will acquire workspace deploy.lock; no production change claimed yet. Physical iPhone GPU/battery behavior is not established by desktop browser tests.

### 2026-11-15 — PR50 motion assertion race

- Before editing tracked code, exercised the original motion gate 20 times per browser with CDP CPU throttle6: Chrome immediate reduced failures0/20; Chromium headless-shell immediate reduced failures12/20, settings failures0/20. Headless-shell20/20 settled to raf0 within observed76.9ms maximum, with frame count unchanged for a further150ms. Example: media.matches=true, pending raf21, then raf0 and stable10frames. Confirms a premature observation rather than an engine that keeps drawing. Engine code is unchanged.
- Only change: settings-static and reduced-static checks wait with page.waitForFunction for the existing engine's raf===0, timeout2000ms, then retain the original exact assertions. Missing engine does not satisfy the predicate. No QA invariant or global timeout relaxed.
- Checked SHA `c52024d6d86dd523f14c8158ca3b224151a7e7d5`, Windows / Node24, D: worktree. Full check2026-11-15T23:36:40+07:00–23:37:54+07:00 PASS: typecheck, prototype22/22, core/route145/145, build, app16/16 checks. All10 browser checks PASS23:37:54–23:41:26+07:00 (including32 scene screenshots). Scope pixel-scenes PASS.
- Private logs/proof: data/reports/motion-race-before.json, motion-race-shell-before.json, motion-fix-full-check.log, motion-fix-browsers.log, browser-suite/summary.json. Chromium headless-shell cached only under gitignored data/private/pixel-scenes/browsers; no package/dependency change or system service installation. No secret/question data committed, no production change yet; wait for new CI before squash merge/deploy.

### 2026-11-16 — PR1 bounded UI motion and permanent koi

- Checked commit `7d8f1fccaa9ee3704b0ba393b9e0c860f6462955` (`codex/ui-motion`), Windows/Node24/native D: worktree. Existing completed full check2026-11-16T00:11:58+07:00–00:13:23+07:00 PASS: typecheck, prototype22/22, core/route148/148, build, test:app16/16. All11 browser checks PASS00:13:24–00:17:28+07:00. On resume17:35+07:00 confirmed clean matching SHA and master unchanged; no rebase or repeated implementation needed.
- Browser motion fixture:100 cached synthetic SRS cards with mock-success transport to isolate UI/outbox, old/new animation180ms together, answer160ms, reduced fade80ms, keyboard no card animation. First20 median214.84ms/last20 median214.12ms including Playwright action/poll overhead; no growing motion queue. Existing SRS suite separately checks real backend. Positive amplitude verified from fake microphone via real AnalyserNode; no audio sent to server.
- Additional private navigation probe17:35+07:00 PASS: two actual native pointer View Transitions complete, Enter navigation creates no transition, repeat daily corner does not show introduction. No tracked code changed during probe.
- Koi tests:two independent residents, <=10 small due fish; only small cohort departs at zero, reduced mode static completion. Geometry test96poses remains PASS. Updated existing scene browser expectation to capped10 small fish; all original browser scripts preserved. Scope ui-motion PASS.
- JS production static chunks gzip sum415,735 vs deployed baseline399,747 =15,988bytes added (<40,960). Unit gate also bounds complete changed client-source modules conservatively below40KiB. No new dependency/schema/private content. Skill inventory/timeline/mobile and hardware limits in src/components/motion/README.md.
- Private proof: data/reports/full-check.log, all-browsers.log, browser-suite/summary.json, ui-motion/proof.json, navigation-proof.json. CI/merge/deploy follow after push; PR2 not started. Physical iPhone motion/touch/GPU remains unverified locally.

### 2026-11-16 — PR51 paired-swap observation race

- Before tracked edits, ran original grade/absence/trace observation20 times on headless-shell at CDP CPU throttle6. Twelve premature reads had0 paired180ms records and unchanged current card; all20 later had both180ms records, a new card ID, pointer input/motion on/reduced false, and no clone left. No app swap failure reproduced. Private proof data/reports/swap-race-20.json/jsonl (max settling observation257ms includes exit animation and throttled driver/poll overhead, not nominal animation duration).
- Probe exposed a fixture issue: mocked success body{} does not satisfy syncReviews receipt.reviewId contract and left reviews pending, eventually exhausting the finite probe cards. Corrected the mock receipt for independent20-lap reproduction and the public100-card UI stress; no production app logic changed. Earlier aborted private probe logs retained.
- Fix only waits for >=2 card records duration180 via waitForFunction(timeout2000), then waits for snapshot absence and retains the exact paired assertion. Existing answer, keyboard, reduced and100-card gates unchanged.
- Checked SHA `5a5b55b8e9f380bc8d9757e7e28e689875539a9c`, Windows/Node24/native D:. Full check18:00:48–18:02:00+07 PASS(typecheck,22prototype,148core/route,build,app16). All11 browser checks PASS18:02–18:06+07. Scope ui-motion PASS. Raw logs swap-fix-check.log/swap-fix-browsers.log and browser-suite/summary.json remain private. New CI required before authorized squash/deploy; second task not started.

### 2026-11-16 — PR51 stress fixture overwrite diagnosis

- Before tracked fixes,10 independent focused100-card stresses on Chromium headless-shell/CDP CPU6:9passed,1failed at iteration16. Failure evidence shows loaded19/seen19, completed heading, outbox0, no overlays. Storage trace records injected100 then old active SRS persistence19; button absent because the wrong short session completed. Clock-aligned CPU1 control still reproduced4/5, so clock alignment alone does not fix this race. Initial full-flow CPU6 probes stopped at intro-duration assertion; focused private probes preseed only daily intro to isolate stress. Public700ms intro gate unchanged.
- Browser-check now leaves the old SRS document before seeding100, positively waits for actual progressbar max100/current card, and waits for the preceding reduced grade card change/outbox0. Fixture updated_at/reviewed_at precede the frozen server; page.clock.setFixedTime aligns browser Date without freezing animation timers/performance. No production app changes, timeout increases or gate weakening.
- After fix10/10 CPU6 stresses completed100 each, seen100/outbox0. Retained private evidence: stress-focused-summary.json, stress-fast-summary.json, stress-fixed-completion.json and browser-suite/motion-diagnostics/{focused,fast,fixed}-*/. Iteration n logged; failure PNG/SRS HTML/console/cache/outbox/control/overlay/motion state and server log now land under the already-uploaded browser-suite CI artifact path. No workflow change required.
- Checked SHA `ede26cd08f573ccfcbd853505deaefc0eae24bb6`, Windows/Node24/native D:. Full check2026-11-16T20:37:34+07:00–20:38:49+07:00 PASS: typecheck,22/22prototype,148/148core/route,build,16/16app gates. All11/11 browser scripts PASS20:38:49–20:42:56+07:00. Scope ui-motion PASS. Normal stress first/last20 medians226.09/230.41ms including driver overhead; nominal swap180ms unchanged. Logs stress-fix-check.log/stress-fix-browsers.log and summary.json private. CI must pass before squash/deploy; follow-up scenes not started.

### 2026-11-16 — Four additional study scenes

- Checked SHA `84324688a8a4bf541b13de6fec2bed44e5e963d9`, Windows/Node24/native D: worktree pixel-scenes-next. Full check2026-11-16T21:09:36+07:00–21:10:37+07:00 PASS: typecheck,22/22prototype,151/151core/route,build,16/16app checks. All12/12 browser scripts PASS21:10:38–21:15:27+07:00. Scope pixel-scenes-next PASS. Initial local suite exposed stale home-tokyo expectation for Roadmap and tsx-injected __name in a simulated hidden getter; corrected test contract/string serialization, retained initial logs. No timeout increases.
- Vocabulary uses distinct active words with actual review history; five stock levels. JLPT uses persisted attempts on the Vietnam day; a real fixture answer verifies live notes2→3. Journey uses actual todayPlan.week and preserves all87 functional roadmap controls/details.1920×216 atlas, four384px regions/three128px joins, focusable native horizontal scroller, initial train camera/follow control. Only intersecting tiles animate; no extra rAF loop. Narrow18%-alpha foot shadows at the market.
- New browser gate captures32 screenshots (four scenes×390/1440×four server periods) with aligned browser Date; tests real counts/week, no URL overrides, all four train camera positions, <=30fps, hidden tiles/tab, offscreen pause, settings/reduced static. Existing four-scene40KiB source/compiled gate preserved separately; added PR source/wiring and compiled group bounded at40KiB. Added lazy group28,317bytes gzip (includes shared engine); whole-build delta28,263 against deployed master6740146 (443986–415723), below40960. No dependency/schema/auth/private-data changes.
- Evidence private: data/reports/full-check.log/json,all-browsers.log/json,browser-suite/summary.json,pixel-scenes-next/{proof,budget,bundle-delta}.json and32 images; original local failure logs retained. Source artwork unchanged. CI must be green before authorized squash/deploy with deploy.lock; physical iPhone performance not established by desktop checks. Login/festival task not started.

### 2026-11-17 — Shoji login and five calendar festivals

- Checked SHA `82ef79eb007a3b3f1b0fbbd0f074488a6b98c52c`, Windows/Node24/native D: worktree login-festivals. Full check2026-11-17T10:14:23+07:00–10:16:03+07:00 PASS: typecheck,22/22prototype,155/155core/route,build,16/16app gates. All13/13 browser scripts PASS10:16:03–10:21:36+07:00. Scope login-festivals PASS. Continued the existing uncommitted work; original approved artwork files unchanged.
- Login keeps its password-only POST, configured/disabled state, Origin/cookie/error behavior. A scoped24px title span inside the semantic h1 avoids the global important h1 size without important declarations or global CSS edits. Opaque card colors pass actual computed contrast>=4.5 at all four times; card stays inside native form-clearance bounds on390/1440. Reviewed390px login and Matsuri images before PR.
- Calendar uses server Asia/Ho_Chi_Minh date and the existing NAOJ2021–2050 Tsukimi table (both2033 dates; no guess outside table). Hatsumode Shadowing, Hanami/summer Today, Tanabata Vocabulary, Tsukimi Grammar. Ordinary dates have no visible festival decorations. Fireworks:84 unequal rays, dense center, seven actor-only accent colors and falling tails; no shared-radius rings. Same dirty rectangles/30fps/reduced/settings lifecycle, no new animation loop.
- New browser fixture aligns page.clock/server Date, captures24 images, verifies auth/Origin/error/HttpOnly, ordinary-date reset and static controls. JS lazy group11663bytes gzip; complete static JS delta8750 (452746–443996) vs deployed9327efc, below40960. Source/client addition also capped at40KiB. No dependency/schema/private data changes or AI calls. Private proof: full-check.log/json,all-browsers.log/json,browser-suite/summary.json,login-festivals/{proof,budget,bundle-delta}.json and images. CI required before squash/deploy under deploy.lock; physical-phone performance not claimed.

### 2026-11-17 — Portrait Shoji room fills the login viewport

- Checked SHA `b73e0de80d1b7167589b8119e8f769ba5b190e16`, Windows/Node24/native D: worktree login-portrait. Full check2026-11-17T11:13:27+07:00–11:14:32+07:00 PASS: typecheck,22/22prototype,157/157core/route,build,16/16app gates. All13/13 browser scripts PASS11:14:32–11:19:55+07:00. Scope login-portrait PASS. Portrait390px day/night images visually reviewed before PR.
- Root cause was the fixed384×216 canvas in a vertically centered432px scene. Login opts into a taller native buffer on portrait screens; adds wood ceiling/beams/paper lantern, taller shoji and woven tatami rows. Original pond/garden pixel scale is retained, actors translated below the new ceiling, form stays below them. CSS removes portrait-only outer padding/letterbox. Default scene geometry and landscape login remain216native pixels high; no auth handler/form markup/global style changes.
- Browser fixtures align server/page Date and cover390×844,360×740 and1440×900 across six fixed-date cases (all four times). Phone canvas coverage100% at both sizes, native422/370 with integer2×scale and pixelated rendering; top/floor color samples verify drawn texture. Height-only resize also verified. Contrast>=4.5, form clearance/auth/error/cookie/calendar/static gates preserved. Desktop's seven canvas layers compare pixel-for-pixel with baseline8543834 via local Playwright-only module routes:0 differing channels in all six cases; no baseline source duplicated into repo.
- Source/compiled JS budgets remain green; complete build delta877bytes gzip vs deployed8543834 (453633–452756). No dependency/schema/private data or AI changes. Private evidence: full-check.log/json,all-browsers.log/json,browser-suite/summary.json,login-festivals/proof.json and30images,login-portrait/budget.json. CI green required before authorized squash/deploy with deploy.lock. Physical-device feel not inferred from desktop screenshots.

### 2026-11-17 — Portrait login follows dynamic browser height

- Checked SHA `ed3aff4bd4d6259ead9fe08aa0d6d717d6e7b5ea`, Windows/Node24/native D:. Portrait-only height uses100dvh with100svh fallback so addressbar expansion/collapse follows the current viewport; default/landscape styles unchanged. Full check2026-11-17T11:24:09+07:00–11:25:16+07:00 PASS: typecheck,22/22prototype,157/157core/route,build,16/16app gates. All13/13 browser scripts PASS11:25:16–11:30:30+07:00; scope login-portrait PASS. Same100% phone coverage, integer2x, height-resize, contrast/auth/calendar and zero-difference desktop checks retained. JSdelta remains877bytes gzip. Initial PR54 run44016585145 SUCCESS on earlier head is historical; require new head CI before squash/deploy. No timeout increases.

### 2026-11-17 — Portrait Shoji tea corner and sleeping cat

- Checked SHA `d6152b59fa0872a8b4eeddffd3e5466fa47aaa83`, Windows/Node24/native D: worktree login-room-details. Full check2026-11-17T13:28:47+07:00–13:30:11+07:00 PASS: typecheck,22/22prototype,159/159core/route,build,16/16app checks. All13/13 browser scripts PASS13:30:11–13:36:27+07:00; scope login-room-details PASS. Initial7e263c8 suite also passed before the shorter-phone fit refinement; raw first logs retained.
- Only production renderer login-shoji.js changes: portrait-only low table/tea set, two cushions, sleeping four-pose cat, slow steam and three seasonal incoming particles. Twelve-percent shadows touch furniture/pads; paws anchored while breathing. Existing engine actor/dirty loop, no new timers or engine/CSS/form/dependency/schema changes. If browser height shrinks the group moves up only while it fits below the pond and above the form;390x664 covered too.
- Visually reviewed day390px/night360px before PR. Browser30screenshots cover two phones and1440/all four times, actual DOM object bounds, contrast/auth/Origin/cookie gates, height resize, animated cat/fps<=30 and settings/reduced static. Unit verifies four distinct drawn poses, static frame at different times and no landscape actors. All seven desktop layers compare with085ac5a baseline:0different pixel channels across six date cases. Phone coverage/pixelated2x gates retained.
- JS delta1048bytes gzip vs deployed085ac5a (454696–453648), below40960. Private evidence: data/reports/{full-check,all-browsers}.log/json,browser-suite/summary.json,login-festivals/proof.json/images,login-room-details/budget.json. No private data committed or AI calls. CI green required before authorized squash/deploy with deploy.lock; physical phone performance not claimed.


### Daily seasonal weather — 2026-11-17

- Checked implementation: `19453534a51a179003318c5b0118f0c8b5bad4c3`; Windows, Node v24.10.0, Chrome headless, isolated public fixtures only.
- Full check 2026-11-17T15:29:38.5090209+07:00–2026-11-17T15:30:58.6743273+07:00: typecheck PASS; prototype22/22, core/route164/164; production build PASS; app gate16/16 PASS.
- Browser suite 2026-11-17T15:30:58.7356839+07:00–2026-11-17T15:38:46.3666212+07:00:14/14 PASS; scope guard daily-weather PASS. 81weather screenshots/contact sheet (9scenes ×7day/morning states +heavy rain/snow at night); clear1440 visible scene pixels unchanged from27db394, including only visible panorama tiles.
- Server/client weather agrees across all9routes and ignores query tampering. 30-year (2000–2029;10,958days) monthly/tsuyu distribution PASS; clear44.93%, maximum extreme run3; winter-only snow/morning-only fog/festival respite/static controls/30fps PASS.
- Compiled static JS gzip 454704 -> 468464: +13760bytes, below15,000. Contact sheet self-reviewed, then roof/cap/exposure corrections and umbrella bounds tested. Raw logs/screenshots/budget are gitignored under data/reports/. Physical iPhone GPU/battery not measured.


### Rain clarity at390px — 2026-11-17

- Checked implementation `04d3e451be9648d913266556a4052c0c4cfa4545`; Windows, Node v24.10.0, Chrome headless, isolated public fixtures only.
- Full check 2026-11-17T17:17:45.0071440+07:00–2026-11-17T17:19:14.6535921+07:00: typecheck PASS;22/22prototype and166/166core/route tests PASS; production build PASS;16/16app gates PASS.
- All14browser scripts PASS 2026-11-17T17:19:14.6971823+07:00–2026-11-17T17:26:56.6231215+07:00; scope rain-clarity PASS.81weather cases plus27-image cloudy/drizzle/heavy390px sheet self-reviewed against accepted Inari; Tokyo night reviewed too. All9clear1440 visible scene pixel comparisons against0addddf are unchanged.
- Cloud/drizzle comparison fixes the date,time,season and static frame, composites layers and crops to the visible canvas, excluding labels. All9scenes exceed120native changed pixels: home-tokyo=11814; review-koi=245; kanji-himeji=162; shadowing-inari=312; vocab-market=6334; grammar-kinkakuji=157; jlpt-study=15589; roadmap-journey=191; login-shoji=12201. Initial99-pixel Himeji failure was corrected in rendering, without lowering the120gate.
- Wet login has0room petals, retains cat/tea/form; Tokyo uses a sheltered city rain plane plus wet platform, and the market keeps its interior dry. Existing30fps/static lifecycle PASS. Compiled JS gzip 468494->469052, +558bytes (<5000). Logs,budget,pixel proof and rain-contact-390.png remain gitignored in data/reports/. Physical iPhone GPU/battery not measured.

## JLPT deterministic source generator v2 — 2026-11-17

Checked implementation: a17a11250acedae0212746a03c13e2bef04cf71e. Windows / Node24.10.0 / Next16.4.5, isolated public fixtures, no API calls. Full check 11/17/2026 18:29:16 to 11/17/2026 18:30:33: typecheck PASS; prototype22/22 + core/route176/176 PASS (new v2 tests10/10); build PASS; test:app16/16 PASS. All route browser checks14/14 PASS from 11/17/2026 18:30:52 to 11/17/2026 18:37:55. Scope guard jlpt-deterministic against origin/master2f88571 PASS17 files; no timeout/gate increases.

Fixed server/browser-clock E2E wrong reading + grammar, next-day eligibility and actual review/sync both PASS; full SRS cloze enabled, quick recognition unchanged. Partial approved bank count/notice, blind verifier ambiguity, sourced noise, deterministic resume/quota, source/kana evidence and date cutoffs covered. All raw proof/logs and survey remain gitignored. No schema/dependency changes, private questions/paths/credentials committed, G0 writes or approved-bank import. Only this append-only audit entry follows the checked commit.


## JLPT verifier wire schema

Checked fcb38b30237b3b69b2e6dce9f34a6515c5094c65 on Windows Node 24 from 2026-11-18T11:48:27.2891136+07:00 to 2026-11-18T11:50:32.3394517+07:00. Typecheck, tests (ℹ pass 22, ℹ pass 177), production build, 16 app checks, JLPT browser-check and route scope PASS. The live two-question fixture probe succeeded on the first request.

## Dated JLPT approval

Windows Node 24, d2890ee9fdf3eb65c48dcaef91eafb22b9994f76, 2026-11-18T13:35:20.0107395+07:00 through 2026-11-18T13:37:16.8283554+07:00. Typecheck, tests (ℹ pass 22, ℹ pass 178), build, 16 app checks, JLPT browser-check and scope passed.

## JLPT grammar, order and daily balance

Checked e04dd8d1a63a3299b0bc4bdc4fc0d39b54d276b8 on Windows / Node 24, 2026-11-18T13:52:24.8066791+07:00 through 2026-11-18T13:54:24.1346698+07:00. Typecheck, tests (ℹ pass 22, ℹ pass 181), production build, 16 app checks, route browser and scope passed.

- 2026-11-18T14:41:57.2624878+07:00 — official JLPT sets, implementation 11cc1e77649e711cf1a7a5b5eeca4729393d4d64. Local full check passed (22 prototype, 182 core/route tests, production build, 16 app checks). All 14 browser checks and jlpt-daily route scope passed. Private approval, per-section grading, replay and separate results exercised with synthetic fixtures.

- 2026-11-18T15:41:54.7165930+07:00 — c45e1097b448d84d7459cfc9c4b9ac8f7391700b JLPT grammar evidence and bounded verifier retries. Local typecheck, 22 prototype + 184 core/route tests, build, 16 app checks, authenticated JLPT browser check and route scope passed.


## JLPT reported meanings and sentence history — 2026-11-19

Checked implementation `5c8cc36dcaa4456570c211e450676bec87e8db84` on Windows / Node 24 / Chrome headless. Full check 2026-11-19T08:58:41.5822678+07:00 through 2026-11-19T09:00:47.1548483+07:00: typecheck PASS; 22/22 prototype and 188/188 core/route tests PASS (19 v2 tests); production build PASS; 16/16 app checks PASS. Authenticated JLPT browser check 2026-11-19T09:01:13.0158226+07:00 through 2026-11-19T09:01:30.5591888+07:00 PASS. Scope pokabu/jlpt-week30-fix against origin/master PASS.

Regression coverage: live translation reports quarantine the exact Frozen meaning by provenance; resolved/unrelated reports do not block it. Grammar/order reject reconstructed sentence reuse across targets, gaps, order windows, batches and days; a different sentence may reuse the same grammar target within 30 days. Borrowed examples carry no unproven grammar-function label. Daily/weekly mix gates, four choices, learned characters and blind verifier remain unchanged. No API calls, imports, schema/dependency changes or private fixtures committed. Raw checks and the unverified source-capacity survey remain ignored.


## JLPT verifier batch result contract — 2026-11-19

Checked implementation 48523389b62473c3d2ba9722f16f6f5465a9e22a on Windows / Node24 / Chrome headless. Full check 2026-11-19T10:00:27.5167284+07:00 through 2026-11-19T10:02:03.0223112+07:00: typecheck PASS, 22/22 prototype and189/189 core-route tests PASS, build PASS, 16/16 app gates PASS. Authenticated JLPT browser check 2026-11-19T10:02:05.2535645+07:00 through 2026-11-19T10:02:19.7773760+07:00 PASS. Route scope pokabu/jlpt-verifier-count PASS.

Both blind passes now state expectedResultCount and expectedIndexes, without disclosing keys or explanations. Regression covers a three-question batch receiving only index0 and an isolated twelve-candidate batch receiving one row: both remain rejected without automatic retry. Wire schema, strict cardinality, option evidence and timeouts unchanged. No real API calls or imports for this change; provider-format acceptance still requires a private post-deploy run. Only this audit follows the checked implementation.


## Pokabu JLPT QA hardening ? 2026-11-19

Checked implementation: `eb9caeaf00bbf8b1896aba3e52c3c14f641e337c`. Windows local environment, Node v24.10.0; start 2026-11-19T11:45:16.945+07:00, end 2026-11-19T11:46:43.747+07:00. Complete `npm run check`: typecheck PASS; prototype tests 22/22, core/route tests 195/195; production build PASS; app gate PASS (16 checks). Authenticated route browser check PASS (2026-11-19T11:48:40.718+07:00?2026-11-19T11:48:55.129+07:00); no external API. Route scope guard against origin/master PASS.

Adds deterministic word-boundary, scrambling, ambiguous distractor, restricted-sense and grammar-level rejection with authored fixtures. Existing collision and permutation assertions retained; the former free-argument order fixture is explicitly rejected. Full checks ran on the implementation commit above; this append-only audit is the sole subsequent public change. No private bank, source questions or raw logs committed.


## Pokabu JLPT hardening 2 and overload fallback — 2026-11-19

Checked implementation: `c68ee46ec188363a3e8a9aec16f22ce2c9f3e142`. Complete `npm run check` in an isolated temporary worktree (Windows, Node v24.10.0), start 2026-11-19T12:52:16.885+07:00, end 2026-11-19T12:53:47.793+07:00: typecheck PASS; prototype 22/22, core/route 206/206; production build PASS; app gate PASS (16 checks). Authenticated JLPT browser check PASS from 2026-11-19T12:54:09.578+07:00 to 2026-11-19T12:54:23.238+07:00. Scope against origin/master PASS. No real generation or import; provider tests use mocked responses and authored questions.

Tests cover auxiliary/no-ka cuts, limiting distractors, false upper-level matches, 503/429 and repeated timeout routing, shared 200-call budget, exhausted-chain checkpoint, cross-verifier rejection and actual provenance. Updated retry assertions reflect the newly authorized overload-switch policy; collision assertions remain intact with an eligible authored fixture. This append-only audit is the only public change after the checked implementation.

## Naetoru /today-roadmap CLS and Journey mount/resize perf — 2026-11-19

Checked implementation `87aa5579f4d8637c90d9ea3f8aded4905233fb61` on branch `naetoru/roadmap-perf` (Windows, Node v24.10.0, headless Chrome, production Next build, disposable OpenJLPT fixture).
- `npm run check`: PASS — typecheck PASS; 22/22 prototype + 207/207 core/route tests PASS (zero failures/skips); production build PASS; `test:app` 16/16 checks PASS.
- `npx tsx src/app/(study)/today-roadmap/browser-check.ts`: PASS (desktop/mobile, 87 weeks, 20-minute plan, manual shadow persistence, invalid makeup, CSRF, duplicate).
- Mobile perf (`/today-roadmap`, 3 runs median, 390x844, DPR 3, CPU 4x, Fast 4G, cache disabled): CLS 0.2684 -> 0 (eliminated +432px shift on `button.text-link` and `div.today_page__IsMqV` caused by unreserved `.journeyFrame`/`.strip` height at `scene.module.css:8`); TTI 2265.6ms -> 2090.2ms (-7.7%); LCP 952ms -> 864ms (-9.2%); TBT 347ms -> 305ms (-12.1%); `staticBuilds` 7/7 (1 per tile, unchanged after repeated `resize()` at same dimensions). Before/after 390x844 screenshots are byte-identical (0px UI diff).
- Core 5 pages (`npm run perf:mobile`, 3 runs median): `/login` TTI 1041 -> 1006.3ms (-3.3%), `/` 1487 -> 1486.2ms (-0.1%), `/srs` 1555.9 -> 1590ms (+2.2%), `/kanji/日` 1235.6 -> 1242.4ms (+0.6%), `/grammar/wa` 1207.2 -> 1247.6ms (+3.3%); all <= +5% TTI gate and CLS=0.
- Unit test added in `tests/pixel-scenes-next.test.ts` covering fixed CSS height reservation, 1x static build per tile on mount, no-op `resize()` on unchanged dimensions, mist smoothstep pixel accuracy, and scale change without static rebuild. Route scope check against `origin/master` PASS. Only this append-only audit entry follows the checked implementation commit.

## Naetoru Shippori Mincho unicode-range split — 2026-11-19

Checked implementation `5f49df15e010e4fd38acaac897d67cabf7309058` on branch `naetoru/font-split` (base `439d828fc5f98d769d6116c1e87de88f267a692d`; Windows, Node v24.10.0, headless Chrome, production Next build, disposable OpenJLPT fixture).
- `tools/subset-fonts.py` (rebuilt with `fonttools[woff]==4.68.0` against pinned OpenJLPT JSON commit `0d1d3410bec90bd4098a7c72de820543cb4f707c`): split Shippori Mincho into 6 strictly disjoint WOFF2 subsets — `Core` (83,048 B, 600 chars: kana/punctuation/UI/scene/specimen), `N5` (109,296 B, 556 chars), `N4` (88,216 B, 414 chars), `N3` (111,472 B, 497 chars), `N2` (89,532 B, 376 chars), `N1` (165,900 B, 726 chars) — preserving all 3,169 glyphs, all OFL licenses, and all original TTF files untouched. Fixed `fallback_ranges()` so every TTF fallback `@font-face` has a strictly disjoint `unicode-range` from all WOFF2 subsets and missing UI characters.
- `npm run check`: PASS — typecheck PASS; 22/22 prototype + 210/210 core/route tests PASS (including 3 new assertions in `tests/font-split.test.ts`); production build PASS; `test:app` 16/16 checks PASS (including `document.fonts.check` for `働 返 直 骨` and `Subset.woff2` loading).
- Mobile font bytes across 5 core pages (390x844 DPR 3, 4x CPU, Fast 4G, 3 runs median, cache disabled): total file bytes 3,349,164 B -> 826,284 B (-75.3%; wire 3,358,480 B -> 835,595 B, -75.1%). Per-page: `/login` 620,508 -> 115,932 B (-81.3%), `/` / `/srs` / `/kanji/日` / `/grammar/wa` 682,164 -> 177,588 B each (-74.0%); Shippori Mincho 587,624 -> 83,048 B (-85.9%); zero `.ttf` downloads across all 5 core pages and all runs; `document.fonts.check` passes natively before explicit load on `/kanji/日` and `/srs` (zero tofu).
- Mobile perf (`npm run perf:mobile`, 3 runs median, 390x844 DPR 3, 4x CPU, Fast 4G): `/login` TTI 1024.9 -> 983.0 ms (-4.1%), `/` 1609.6 -> 1363.2 ms (-15.3%), `/srs` 1525.3 -> 1323.0 ms (-13.3%), `/kanji/日` 1202.6 -> 1077.1 ms (-10.4%), `/grammar/wa` 1238.2 -> 1095.5 ms (-11.5%); all <= +5% TTI gate and CLS = 0 across all 5 pages.
- Route scope guard `node tools/check-route-scope.mjs origin/master naetoru/font-split`: PASS. Only this append-only audit entry follows the checked implementation commit.
## Naetoru /srs scene due deduplication and mode prefetch — 2026-11-19

Checked implementation `ac73fc16e710e9ca7f4a9f56ae0226f880898c49` on branch `naetoru/srs-perf` (measured BEFORE/AFTER on base `439d828fc5f98d769d6116c1e87de88f267a692d`, then merged latest `origin/master` `da96f0ede75bf736d78da2838b3cd06597cc0c35` preserving all prior verification entries; Windows, Node v24.10.0, headless Chrome, production Next build, disposable OpenJLPT fixture).
- `src/app/(study)/srs/review-session.tsx`: extracted `dispatchSceneDueIfChanged()` so `nihon-scene-due` is dispatched only when `remainingDue(initial, seen)` actually changes from the last announced value (initialized to server-rendered `remainingDue(initial, [])` and reset when `initial` changes), avoided replacing an already-empty `seen` array when `pendingReviews()` resolves empty, and added `prefetch={false}` to the `/srs?mode=full` and `/srs?mode=quick` mode links.
- `tests/srs-perf.test.ts`: unit tests proving `nihon-scene-due` does not fire when the due count is unchanged (initial mount, empty pending array, stale cached card IDs, duplicate IDs, mode prop switch without seen changes) and still fires whenever active due count decreases, plus assertion that both mode links set `prefetch={false}`.
- `npm run check`: PASS — typecheck PASS; 22/22 prototype + 209/209 core/route tests PASS on `ac73fc1` (zero failures/skips); production build PASS; `test:app` 16/16 checks PASS; re-verified after merging `da96f0e`.
- `npx tsx src/app/(study)/srs/browser-check.ts`: PASS.
- Mobile perf on `/srs` (390x844 DPR 3, 4x CPU, Fast 4G, cache disabled, 3 runs median): `staticBuilds` 2 -> 1 (redundant `nihon-scene-due` events on load 2 -> 0); TTI 1364.7 -> 1317.2 ms (-3.5%); TBT 199.0 -> 185.0 ms (-7.0%); LCP 520.0 -> 500.0 ms (-3.8%); CLS 0 -> 0; requests 34 -> 32 (-2 mode RSC prefetches).
- Route scope guard `node tools/check-route-scope.mjs origin/master naetoru/srs-perf`: PASS.

## Naetoru Shell menu prefetch deduplication — 2026-11-19

Checked implementation `331f39f9fa8fb4cfb6b08f56901cd65a0f09f17b` on branch `naetoru/nav-prefetch` (base `7ae4a98908cc526b781e3152b0f1f38441ff0f61`; Windows, Node v24.10.0, headless Chrome, production Next build, disposable OpenJLPT fixture).
- `src/components/shell.tsx`: added `prefetch={false}` to all 9 menu `<Link>` elements (`/`, `/settings` x2, `/sources` x2, `/srs`, `/shadowing`, `/common-tools/reports`, `/common-tools/progress`) while preserving all `href` targets, labels, and DOM structure.
- `tests/nav-prefetch.test.ts`: added 2 unit tests asserting that every `<Link>` rendered by `Shell` passes `prefetch={false}` with exact expected `href`/label and that no `<Link>` in `src/components/shell.tsx` omits `prefetch={false}`.
- `npm run check`: PASS — typecheck PASS; 22/22 prototype + 214/214 core/route tests PASS (zero failures/skips); production build PASS; `test:app` 16/16 checks PASS.
- Mobile perf on `/` (390x844 DPR 3, 4x CPU, Fast 4G, cache disabled, 3 runs median, paired before/after): `?_rsc=` requests 8 -> 0 (-100%, eliminating duplicate prefetches for `/settings`, `/shadowing`, `/common-tools/reports`, `/common-tools/progress`); total requests 31 -> 23 (-8); TTI 1886.6 -> 1693.3 ms (-10.2%); TBT 339.0 -> 284.0 ms (-16.2%); LCP 748.0 -> 748.0 ms; CLS 0 -> 0; JS gzip 158.85 -> 158.85 KB.
- Route scope guard `node tools/check-route-scope.mjs origin/master naetoru/nav-prefetch`: PASS. Only this append-only audit entry follows the checked implementation commit.


## Pokabu JLPT provider cooldown — 2026-11-20

Checked implementation `c078862cd456e1b0ba5ea0180b53b26639c6ae40` on `pokabu/jlpt-provider-cooldown` (base `47ea3bc95581ecc2a4c9d2e8ccbd69110bc810a3`). Windows, Node v24.10.0, production Next build, disposable OpenJLPT fixture. Check window 2026-11-20 11:11:25.755–11:12:46.265 ICT (UTC+07:00).
- `npm run check`: typecheck PASS, prototype 22/22 and core/route 218/218 PASS, production build PASS, app gate 16/16 PASS.
- Four fake-fetch and fake-clock tests verify full-chain 503 recovery and quota accounting, Retry-After in both formats, bounded exhaustion, and shared-budget enforcement during recovery. The over-cap fixture keeps its original assertions and supplies Retry-After 61 seconds. The fallback and V2 verifier tests pass unchanged.
- `node tools/check-route-scope.mjs origin/master pokabu/jlpt-provider-cooldown`: PASS. This append-only entry follows the checked implementation commit.


## Pokabu JLPT V2 grammar functions and context alternatives

Checked implementation `bd874c942cfb849c554724559e406141d04cb3b2` on base `0bfe99df71d483304eb9d9be88c00be96140ec6f` on Windows with Node v24.10.0, a disposable OpenJLPT fixture, and local Chromium. The check started at 12:37:24.533 and ended at 12:39:06.439 on 2026-11-20 (UTC+07:00).
- `npm run check` passed typecheck, 22/22 prototype tests and 223/223 core/route tests (245 total), production build, and 16/16 app checks.
- Five self-authored regression tests cover subject vs connective, question vs disjunction, the deadline suffix, rejection of plausible or unevaluated context alternatives, and the required `contextFits` wire field in batches containing context. The suite uses fake verifier responses.
- The revised verifier fingerprint requires new verification for checkpoints made under the prior rules. Route scope verified before push.


## Pokabu JLPT V2 context explanation sense

Checked implementation 05c2dd039b0011911c89e86db08ff0080dcc8b52 on base e7326266ca679c4dda97af3d57b758407f5f3659 with Windows, Node v24.10.0, a disposable OpenJLPT fixture, and local Chromium. The check ran from 13:19:58.740 to 13:21:45.218 on 2026-11-20 (UTC+07:00).
- npm run check passed typecheck, 22/22 prototype tests, 225/225 core and route tests, production build, and 16/16 app checks.
- Two self-authored regressions cover exact sense matching, rejection without evidence, and keeping Vietnamese explanations tied to the validated gloss. General naturalness continues to be evaluated by the existing verifier.
- The verifier fingerprint invalidates prior checkpoints for the changed explanation rule. Route scope checked before push.
- Offline on the same frozen snapshot, 30 November through 6 December: context candidates 366 to 197 before history filtering and 234 to 140 after history filtering. Other types stayed constant. The minimum daily history-eligible pool was 11 grammar and 7 order across the week. No dailyMix claim after verifier.

## Naetoru /srs lazy wanakana dynamic import — 2026-11-20

Checked implementation `d82ee8fde3e87820bdd996d77bc6386a5610ea90` on branch `naetoru/srs-lazy-wanakana` (base `e7326266ca679c4dda97af3d57b758407f5f3659`; Windows, Node v24.10.0, headless Chrome, production Next build, disposable OpenJLPT fixture). Check window: `2026-11-20T13:28:11.1228343+07:00` through `2026-11-20T13:29:27.9494058+07:00` (UTC+07:00).
- `src/app/(study)/srs/review-session.tsx`: removed static `import { toHiragana } from 'wanakana'`, added memoized `createWanakanaLoader()` using dynamic `import('wanakana')`, pre-warmed on reading input focus, backfilled IME conversion on input change if typed while loading, and made `reveal()` await `wanakana.isReadingMatch()` so fast romaji submissions still convert and compare identically without skipping conversion.
- `tests/srs-lazy-wanakana.test.ts`: added 4 unit tests covering absence of static `wanakana` import, lazy dynamic loading + module caching + IME/reading matching, rapid romaji check awaiting an in-flight dynamic import, and recovery after a failed dynamic import.
- `npm run check`: PASS — typecheck PASS; 22/22 prototype + 227/227 core/route tests PASS (249/249 total, 0 failures/skips); production build PASS; `test:app` 16/16 checks PASS.
- Mobile perf on `/srs` (390x844 DPR 3, 4x CPU, Fast 4G, cache disabled, 3 runs median, single before/after pass): `wanakana` in initial JS `true -> false`; initial JS raw `583,383 -> 574,380 B` (`-9,003 B`, `-1.54%`), gzip `183,906 -> 180,127 B` (`-3,779 B`, `-2.05%`); TTI `1392.2 -> 1314.7 ms` (`-5.6%`); TBT `220.0 -> 204.0 ms` (`-7.3%`); LCP `576.0 -> 568.0 ms` (`-1.4%`); CLS `0 -> 0`; requests `24 -> 24`.
- Route scope guard `node tools/check-route-scope.mjs origin/master naetoru/srs-lazy-wanakana`: PASS. Only this append-only audit entry follows the checked implementation commit.

## Naetoru pixel-scenes offscreen water reflection -- 2026-11-21

Checked implementation `6b70eceb7b2bb121f37429fab7861af1204a085e` on `naetoru/scene-reflection` (base `285c8a4c5d181699d5b8c64b49a0282d27a61183`) on Windows with Node v24.10.0, disposable OpenJLPT fixture, and local Chromium. Check window 2026-11-21 11:21:48.608-11:23:14.023 +07:00.
- `npm run check`: typecheck PASS, prototype 22/22 and core/route 228/228 PASS (250 total, including 3 new tests in `tests/scene-reflection.test.ts`), production build PASS, app gate 16/16 PASS.
- 32-frame static canvas pixel comparison (2 scenes x 4 seasons x 4 times in headless Chromium): 0 differing pixels across all 32 composited frames and all 32 layer-1 frames.
- Paired mobile A/B measurement (390x844 DPR 3, 4x CPU, Fast 4G, cache disabled, 3-run median): `/kanji` TBT 240 -> 219 ms (-8.7%), TTI 1378.5 -> 1389.7 ms (+0.8%), LCP 596 -> 604 ms; `/grammar` TBT 269 -> 222 ms (-17.5%), TTI 1617.8 -> 1306.3 ms (-19.3%), LCP 784 -> 584 ms.
- `node tools/check-route-scope.mjs origin/master naetoru/scene-reflection`: PASS. Append-only entry recorded after the checked implementation commit.

## Naetoru grammar formula blocks -- 2026-11-21

Checked implementation `8b16df7cd8f56b00bdcb0a23bd9de8c38e4a6da5` on branch `naetoru/grammar-formula` (base `6b0a110029c91a49b841315fe3bce4f9c07bce25`) on Windows with Node v24.10.0, disposable OpenJLPT fixture, and local headless Chrome. Check window: 2026-11-21T12:28:31+07:00 through 2026-11-21T12:29:48+07:00 (UTC+07:00).
- `npm run check`: PASS -- typecheck PASS; prototype 22/22 and core/route 235/235 PASS (257 total, 0 failures/skips, including `parseGrammarFormula` coverage in `src/app/(study)/grammar/grammar.test.ts` and `tests/font-split.test.ts`); production build PASS; `test:app` 16/16 checks PASS.
- Route browser check `node --import tsx src/app/(study)/grammar/browser-check.ts`: PASS (18 listing/related clicks across 1440px and 390px viewports, shortId PASS, malformedIds 404, 0 browser errors).
- Read-only offline audit against the frozen local 403-pattern G0 grammar dataset (uncommitted): 403/403 patterns render >= 1 typed formula block (387/403 with >= 1 POS block for verb/i-adj/na-adj/noun, 16/403 fixed-only, 0/403 neutral-only; 23 neutral tokens kept verbatim without fabricated POS labels).
- Production `/grammar/[id]` initial JS gzip (server-rendered component, zero client JS logic added): 147,511 B -> 147,778 B (+267 B / +0.26 KiB from CSS module class map); 360px and 390px viewports have zero horizontal overflow; live computed contrast on formula blocks is 9.25-10.58:1 (text) and 7.49-8.93:1 (tags) in light mode, 11.14-11.37:1 (text) and 8.70-9.25:1 (tags) in dark mode.
- Limitations: no physical-phone or production home-host deployment verification claimed; original `formationEn` text remains verbatim in the detail panel.
- `node tools/check-route-scope.mjs origin/master naetoru/grammar-formula`: PASS. Only this append-only audit entry follows the checked implementation commit.

## Naetoru SRS settings (newCardsPerDay + fsrsRetention) -- 2026-11-21

Checked implementation `426dad5f42df12e65a344b701304ac51e726f4e3` on `naetoru/srs-settings` (base `1de1ca6dde2773aac17b36b4169a7ee5b6ce0a7f`) on Windows with Node v24.10.0, disposable OpenJLPT fixture, production Next build, and local headless Chromium. Check window 2026-11-21 12:06:27-12:08:04 +07:00.
- `npm run check`: typecheck PASS, prototype 22/22 and core/route 238/238 PASS (260 total, including 3 new tests in `tests/srs-settings.test.ts` and expanded validation/fallback coverage in `tests/preferences.test.ts`), production build PASS, app gate 16/16 PASS.
- `node --import tsx "src/app/(study)/srs/browser-check.ts"`: PASS.
- Production browser/API verification (isolated fixture, 390x844 mobile viewport): 6 out-of-range/invalid `/api/settings` payloads rejected with HTTP 400; `/settings` edits for `newCardsPerDay` (0-100) and `fsrsRetention` (0.80-0.97) persist across reload with zero horizontal overflow; `/srs` enforces the daily new-card cap without blocking due reviews, updates client preview/header retention dynamically, and persists matching FSRS scheduler version (`ts-fsrs@6.0.0/FSRS-6/r85`) without DB schema changes.
- `node tools/check-route-scope.mjs origin/master naetoru/srs-settings`: PASS. Append-only entry recorded after the checked implementation commit.

## Naetoru SRS settings CI browser-check fixes -- 2026-11-21

Checked implementation `06fbe2c3008f59d5110d26e886b9e4654cf9e63f` on branch `naetoru/srs-settings` (follow-up on `bf560deb3aa72b8a5c12f2497026a09448c8ab7c`, base `1de1ca6dde2773aac17b36b4169a7ee5b6ce0a7f`) on Windows with Node v24.10.0, disposable OpenJLPT fixture, and local headless Chrome. Check window: `2026-11-21T12:41:01.1236020+07:00` through `2026-11-21T12:44:12.8784578+07:00` (UTC+07:00).
- Root cause 1 (`appearance/motion/browser-check.ts:24` timeout): `src/app/(study)/srs/review-session.tsx:64` strictly compared `(saved.session?.newCardsPerDay ?? null) === (initial.newCardsPerDay ?? null)`, discarding any legacy or unoptioned cached session lacking `newCardsPerDay` when preferences were at default `10`. Fixed by extracting `isCompatibleSessionCache()` in `src/app/(study)/srs/model.ts` using `normalizeNewCardsPerDay()` alongside `normalizeRetention()` (zero edits to `appearance/motion/browser-check.ts`).
- Root cause 2 (`appearance/browser-check.ts:77` timeout): `fixtureCatalog(db)` left all `srs_cards` in `pending:g1/srs` new-card state, so enforcing default `newCardsPerDay = 10` capped `/srs?mode=quick` at 10 cards before iteration 11 of the 15-card quick review loop. Updated fixture setup in `src/app/(study)/appearance/browser-check.ts` to seed due reviewed FSRS cards (`reps = 1`, `VERSION`, `due_at = 2026-11-14T00:00:00.000Z`) while keeping the 15-card loop, assertions, timeouts, and default `newCardsPerDay = 10` unchanged.
- `npm run check`: PASS -- typecheck PASS; prototype 22/22 and core/route 240/240 PASS (262 total, 0 failures/skips, including 2 new regression tests in `tests/srs-settings.test.ts` for quick 15-card sessions and `isCompatibleSessionCache()`); production build PASS; `test:app` 16/16 checks PASS.
- Route browser checks on `06fbe2c`: `appearance/motion/browser-check.ts` PASS (100-card stress, first20Median 226.2ms / last20Median 227.2ms, swap 180ms); `appearance/browser-check.ts` PASS (4 themes x 2 widths x 19 screens + 15-card SRS quick session); `srs/browser-check.ts` PASS.
- `node tools/check-route-scope.mjs origin/master naetoru/srs-settings`: PASS (13 files, including `src/app/(study)/appearance/browser-check.ts`). Only this append-only audit entry follows the checked implementation commit.

## Naetoru SRS settings full browser-suite and scope restore -- 2026-11-21

Checked implementation `b29e0538bfec9c1944008963d9c535c11888c60d` on branch `naetoru/srs-settings` (merged `origin/master` `f9883771a9ff9a3b049f5ba823cb877a95c8007e` without force push) on Windows with Node v24.10.0, clean `.next` build, disposable OpenJLPT fixture, and local headless Chrome. Check window: `2026-11-21T12:49:36.6042631+07:00` through `2026-11-21T12:57:34.1343702+07:00` (UTC+07:00).
- Restored verbatim `ownership.set('pokabu/g1-tick-a', ...)` entry directly before `'rain-clarity'` in `tools/check-route-scope.mjs` (accidentally dropped in #84).
- Deleted `.next` before running full gates to avoid stale chunk inflation in `daily-weather` gzip budget.
- `npm run check`: PASS -- typecheck PASS; prototype 22/22 and core/route 241/241 PASS (263 total, 0 failures/skips); clean `next build --webpack` PASS; `test:app` 16/16 checks PASS.
- `npm run test:browser`: PASS 14/14 (`appearance`, `daily-weather`, `login-festivals`, `motion`, `pixel-scenes-next`, `pixel-scenes`, `common-tools`, `grammar`, `jlpt-daily`, `kanji`, `shadowing`, `srs`, `today-roadmap`, `vocab`).
- `node tools/check-route-scope.mjs origin/master naetoru/srs-settings`: PASS (13 files). Only this append-only audit entry follows `b29e053`.

## Naetoru shadowing controls (1.2x speed/pause, shortcuts, SRS add, deep-link) -- 2026-11-21

Checked implementation `f3e5d3188e4a862a462b329bd35ff76e96a3bc14` on branch `naetoru/shadowing-controls` (base `0f7cc42276d5b6842050ce183acbb8d39d99ea42`) on Windows with Node v24.10.0, clean `.next` build, disposable OpenJLPT fixture, and local headless Chrome.
- `npm run check`: PASS -- typecheck PASS; prototype 22/22 and core/route 245/245 PASS (267 total, 0 failures/skips, including 4 new tests in `tests/shadowing-controls.test.ts`); clean `next build --webpack` PASS; `test:app` 16/16 checks PASS.
- `npm run test:browser`: PASS 14/14 (`appearance`, `daily-weather`, `login-festivals`, `motion`, `pixel-scenes-next`, `pixel-scenes`, `common-tools`, `grammar`, `jlpt-daily`, `kanji`, `shadowing` 27/27, `srs`, `today-roadmap`, `vocab`).
- `daily-weather` JS gzip budget: 473,289 B vs baseline 468,494 B (+4,795 B <= 5,000 B limit, +205 B margin) after moving server-only deep-link selection to `query.ts`, playback helpers to `playback.ts`, and static notices to `page.tsx`.
- `shadowing` browser-check covers `?clip=<id>&segment=<n>` deep-link + invalid-query fallback, `1.2x` speed + pause-to-shadow `x1.2`, desktop shortcuts (`Space`/`Left`/`Right`/`R`/`L`) with editable-target focus guard, and `Th?m c?u v?o SRS` via `/api/review/cards` (idempotent duplicate handling, zero DB schema changes).
- `node tools/check-route-scope.mjs origin/master naetoru/shadowing-controls`: PASS. Only this append-only audit entry follows `f3e5d31`.


## Pokabu JLPT IPADIC tokenizer

Checked implementation `1b2e14e097cc5fe8ed4c98364525a6334756e066` on base `6b0a110029c91a49b841315fe3bce4f9c07bce25` with Windows, Node v24.10.0, a disposable OpenJLPT fixture, and local Chromium. The check ran from `2026-11-21T12:22:13.4549588+07:00` through `2026-11-21T12:23:46.9005706+07:00`.
- `npm run check` passed typecheck, 22/22 prototype tests, 236/236 core and route tests, production build, and 16/16 app checks.
- Authored fixtures cover split verb tokens in grammar and order, case and conjunctive particles, embedded and final questions versus alternatives, deadline versus duration, and the copular reading.
- Same-path production builds emitted identical browser chunk hashes and route references (79 JavaScript chunks, 1,385,672 bytes, and 39 route manifests). Route scope passed before push.
- Frozen offline audit confirmed a valid 10-candidate daily mix independently for each of seven dates. The draft recheck retained 33 of 35 questions. The new fingerprint prevents older checkpoints from bypassing the gate.

## Naetoru vocab lesson examples, TTS replay, and read-aloud step -- 2026-11-21

Checked implementation `6e674ad1437c877dca6b5105cd807346f13a3241` on branch `naetoru/vocab-lesson` (base `150cb125ae4ad2b4409960d6bed4ca4ce4a21d24`) on Windows with Node v24.10.0, clean `.next` build, disposable OpenJLPT fixture, and local headless Chrome.
- `npm run check` (`2026-11-21T15:27:07+07:00` to `2026-11-21T15:29:42+07:00`): PASS -- typecheck PASS; prototype 22/22 and core/route 251/251 PASS (273 total, 0 failures/skips, including 4 new tests in `tests/vocab-lesson.test.ts`); clean `next build --webpack` PASS; `test:app` 16/16 checks PASS.
- Clean `.next` -> `npm run build` -> `npm run test:browser` (`2026-11-21T15:31:29+07:00` to `2026-11-21T15:40:14+07:00`): PASS 14/14 (`appearance`, `daily-weather`, `login-festivals`, `motion`, `pixel-scenes-next`, `pixel-scenes`, `common-tools`, `grammar`, `jlpt-daily`, `kanji`, `shadowing`, `srs`, `today-roadmap`, `vocab`).
- `daily-weather` JS gzip budget (`data/reports/daily-weather/budget.json`): `473,225 B` vs baseline `468,494 B` (`+4,731 B <= 5,000 B` limit, `+269 B` margin; down from `473,276 B` on clean `6c25083` and `474,146 B` on clean `150cb12`) after moving static markup/styles to Server Components + `lesson.module.css` and unifying word/example TTS in `session.tsx`.
- Feature checks: `/vocab/lesson` loads 1-2 example sentences from existing detail tables (furigana `<ruby>`, Vietnamese translation + source label + English `<details>`, empty state `Chưa có câu ví dụ`), Web Speech API `ja-JP` playback/replay (`Nghe câu` -> `Dừng đọc` + `Phát lại` -> `Phát lại`), read-aloud prompt + `Đã đọc` -> `Đã đọc ✓` (auto-revealing meaning once all examples are read), and preserves existing `Mở nghĩa` / `Thêm vào ôn` / `Từ tiếp theo →` flow without blocking when no Japanese browser voice is available. Verified desktop and mobile 390px with zero horizontal overflow and zero browser errors.
- `node tools/check-route-scope.mjs origin/master naetoru/vocab-lesson`: PASS. Only this append-only audit entry follows `6e674ad`.


## Pokabu JLPT v2 free verifier providers — 2026-11-21

Checked implementation `85913729a0b69c031096c48fea7c2666b49e9990` against `fde286d06ba0a647e469887a7ca3079df77c8f92` on Windows with Node v24.10.0 and the local Chromium disposable OpenJLPT fixture.
- `npm run check` PASS, 2026-11-21T16:26:24.9878861+07:00–2026-11-21T16:29:09.2352372+07:00. Typecheck PASS, 22/22 prototype tests, 259/259 core and route tests, production build PASS, and 16/16 app checks. The shell was assigned 8 logical CPUs for the Windows launcher test. Test settings and assertions were unchanged.
- `node tools/check-route-scope.mjs origin/master pokabu/jlpt-free-providers` PASS. Only this append-only verification record follows the checked implementation.
- Same-path build comparison matched all 80 emitted browser chunk hashes and all 39 route client references. Both builds measured 473,227 B gzip, 4,733 B above the daily-weather baseline and 267 B under its 5,000 B limit. Generated build-ID references in the shared manifest differ by build.
- Read-only OpenJLPT benchmark on 20 approved items, 16:19–16:21 ICT. Groq GPT-OSS scored 20/20 blind and Groq Qwen scored 13/20 reviewing Vietnamese meaning and grammar labels, with 7 false rejections and no false acceptances. OpenRouter Gemma returned HTTP 429 at 16:21:18 ICT and the benchmark stopped that provider after 1 completion attempt. The approved database SHA-256 matched before and after.

## Naetoru shared client component chunk deduplication -- 2026-11-21

Checked implementation `588876c354ccc88fe8bf9f78a01bff40dc5770b1` on branch `naetoru/shared-chunk-dedup` (base `fde286d06ba0a647e469887a7ca3079df77c8f92`) on Windows with Node v24.10.0, clean `.next` build, disposable OpenJLPT fixture, and local headless Chrome.
- Change: added client-only (`!isServer && nextRuntime !== 'edge'`) webpack `splitChunks.cacheGroups.sharedComponents` in `next.config.ts` matching `src/components/**/*.(js|jsx|ts|tsx|mjs|cjs|mts|cts)` with `minChunks: 2`, `minSize: 0`, `priority: 25`, `reuseExistingChunk: true`, preserving all existing Next.js webpack config and adding zero dependencies. `src/proxy.ts` untouched.
- `npm run check` (clean `.next`, `2026-11-21T16:48:15+07:00` to `2026-11-21T16:51:27+07:00`): PASS -- typecheck PASS; prototype 22/22 and core/route 251/251 PASS (273 total, 0 failures/skips); clean `next build --webpack` PASS; `test:app` 16/16 checks PASS (including `encrypted cold offline SRS password unlock`, `offline review outbox reconnect synchronization`, and `logout clears private offline cache`).
- Browser checks (14/14 PASS): `appearance`, `daily-weather`, `login-festivals`, `motion`, `pixel-scenes-next`, `pixel-scenes`, `common-tools`, `grammar`, `jlpt-daily`, `kanji` passed in `npm run test:browser` before the 600s host command timeout, and the remaining 4 (`shadowing` 27/27, `srs`, `today-roadmap`, `vocab`) passed sequentially immediately after on the same clean build; CI `foundation` runs the uninterrupted 14/14 suite.
- `daily-weather` JS gzip budget (`data/reports/daily-weather/budget.json`, baseline/limit unchanged): `435,600 B` vs baseline `468,494 B` (`added: -32,894 B <= 5,000 B` limit; down `37,633 B` from `473,233 B` on clean `origin/master` `fde286d`). Zero `.next/static/chunks/**/*.js` files contain `node:sqlite` or `better-sqlite`.
- Top 3 largest `page-*.js` chunks (gzip): `today-roadmap` `12,108 B -> 8,655 B`, `shadowing` `11,495 B -> 8,575 B`, `srs` `11,064 B -> 7,567 B`.
- `node tools/check-route-scope.mjs origin/master naetoru/shared-chunk-dedup`: PASS (3 files: `next.config.ts`, `tools/check-route-scope.mjs`, `docs/foundation-verification.md`). Only this append-only audit entry follows `588876c`.

## Naetoru evening kanji lesson (PR-B5) -- 2026-11-21

Checked implementation `4571e88d335ab93c18eff64e11da12efc8899cbd` on branch `naetoru/kanji-lesson` (rebased onto `origin/master` `41ba4ef18b1f3ac7ba8a61dcd94b7db9e11db6ab` including #88) on Windows with Node v24.10.0, clean `.next` build, disposable OpenJLPT fixture, and local headless Chrome.
- `npm run check` (clean `.next`, `2026-11-21T17:31:18+07:00` to `2026-11-21T17:32:53+07:00`): PASS -- typecheck PASS; prototype 22/22 and core/route 262/262 PASS (284 total, 0 failures/skips, including `tests/kanji-lesson.test.ts`); clean `next build --webpack` PASS; `test:app` 16/16 checks PASS.
- Clean `.next` -> `npm run build` -> `npm run test:browser` (`2026-11-21T17:33:06+07:00` to `2026-11-21T17:41:01+07:00`): PASS 14/14 (`appearance`, `daily-weather`, `login-festivals`, `motion`, `pixel-scenes-next`, `pixel-scenes`, `common-tools`, `grammar`, `jlpt-daily`, `kanji`, `shadowing`, `srs`, `today-roadmap`, `vocab`).
- `daily-weather` JS gzip budget (`data/reports/daily-weather/budget.json`, `next.config.ts` and baseline/limit unchanged): `437,454 B` vs baseline `468,494 B` (`added: -31,040 B <= 5,000 B` limit; `36,040 B` under the `473,494 B` ceiling; `+1,854 B` vs clean `origin/master` #88 `435,600 B`).
- Production browser check on `/vocab/lesson` -> `/vocab/lesson/kanji` with unmodified OpenJLPT fixture (`seedDemo`, zero hardcoded translations): 0 page errors, `Shippori Mincho` kanji font, zero horizontal overflow at 390px mobile width, `srs_cards` stays 0 until explicit `Th?m v?o ?n` click (then increments to 1 while staying on card), done screen links back to `/vocab/lesson`.
- `node tools/check-route-scope.mjs origin/master naetoru/kanji-lesson`: PASS (9 files including this append-only audit entry). Only this append-only audit entry follows `4571e88`.

## Pokabu JLPT free verifier roles -- 2026-11-21

Checked implementation `9c926245cbb228dcdfd9ea4bd2e4279cc9beea28` against `41ba4ef18b1f3ac7ba8a61dcd94b7db9e11db6ab` on Windows with Node v24.10.0 and npm 11.6.1. The worktree started without a .next directory. The check shell used eight logical CPUs and the app gate used a disposable OpenJLPT fixture.
- `npm run check` (2026-11-21T17:47:48.8198271+07:00 to 2026-11-21T17:49:40.0596694+07:00) passed typecheck, 22/22 prototype tests, 269/269 core and route tests, the production build, and 16/16 app checks.
- The full check includes 10 new offline routing regressions. All 17 existing provider tests and 4 existing Gemini fallback tests pass. The regressions use mock Gemini, Groq, and OpenRouter responses.
- `node tools/check-route-scope.mjs origin/master pokabu/jlpt-free-roles` passed. A credential-pattern scan of additions found zero matches. Only this append-only entry follows the checked implementation.

## Naetoru in-place word lookup popup and shadowing tap-to-lookup (PR-B13 part 1) -- 2026-11-21

Checked implementation `c915a6d31ea254fe391cf3e30c5d8afefdb87597` on branch `naetoru/lookup-popup` (base `4950c46baac8ac37be79c91603bf04e81598c2bf` including #89) on Windows with Node v24.10.0, clean `.next` build, disposable OpenJLPT fixture, and local headless Chrome.
- `npm run check` (clean `.next`, `2026-11-21T18:31:17+07:00` to `2026-11-21T18:32:46+07:00`): PASS -- typecheck PASS; prototype 22/22 and core/route 267/267 PASS (289 total, 0 failures/skips, including 5 new tests in `tests/lookup-popup.test.ts`); clean `next build --webpack` PASS; `test:app` 16/16 checks PASS.
- `npm run test:browser` (`2026-11-21T18:32:57+07:00` to `2026-11-21T18:40:11+07:00`): PASS 14/14 (`appearance`, `daily-weather`, `login-festivals`, `motion`, `pixel-scenes-next`, `pixel-scenes`, `common-tools`, `grammar`, `jlpt-daily`, `kanji`, `shadowing` 28/28 checks including lookup-popup E2E, `srs`, `today-roadmap`, `vocab`).
- `daily-weather` JS gzip budget (`data/reports/daily-weather/budget.json`, `next.config.ts` and baseline/limit unchanged): `440,581 B` vs baseline `468,494 B` (`added: -27,913 B <= 5,000 B` limit; `32,913 B` under the `473,494 B` ceiling; `+3,127 B` vs clean `origin/master` `4950c46` `437,454 B`). Zero `.next/static/chunks/**/*.js` files contain `node:sqlite`, `better-sqlite`, or `kuromoji`.
- Feature checks: server-only lazy `kuromoji` word segmentation (`src/app/(study)/common-tools/tokenize.ts`) for shadowing subtitles (`both`/`ja`/`kana` modes), quick lookup API `GET`/`POST /api/common-tools/lookup` (auth-gated 401, `Cache-Control: private, no-store`, no `Set-Cookie`, CSRF `sameOrigin` on POST, KanjiDictVN meanings explicitly excluded while allowing `han_viet`, atomic `lookup-sentences.json` sidecar preserving `srs_cards.state_json` `hydrate()` compatibility and zero DB schema changes), accessible `LookupPopup` dialog (`role="dialog"`, `aria-modal="true"`, focus trap, `Esc`/outside/Close button, focus restoration, zero horizontal overflow at 390px mobile width), and explicit-only `Them vao on` SRS enqueue with original sentence context.
- `node tools/check-route-scope.mjs origin/master naetoru/lookup-popup`: PASS (18 files including this append-only audit entry; `tools/check-route-scope.mjs` diff `+2/-0`). Only this append-only audit entry follows `c915a6d`.

## Naetoru lookup-sentences backup and restore follow-up (PR #91) -- 2026-11-21

Checked implementation `9a1fed48cd98d5c025f1aecaf5d6d3f0a494a026` on branch `naetoru/lookup-popup` (base `4950c46baac8ac37be79c91603bf04e81598c2bf`) on Windows with Node v24.10.0, clean `.next` build, disposable OpenJLPT fixture, and local headless Chrome.
- Change: added `lookup-sentences.json` (`NIHON_LOOKUP_CONTEXT_PATH`, default `<dbDir>/private/lookup-sentences.json`) to backup creation, structural validation (`validateLookupSentences`), and atomic restore/rollback in `src/core/backup.ts`, preserving sha256, total size, symlink/root checks, and allowed-file checks; skipped silently when absent and compatible with legacy archives lacking `lookup-sentences.json`. Added unit tests in `tests/lookup-popup.test.ts` and registered `src/core/backup.ts` in `tools/check-route-scope.mjs`.
- `npm run check` (clean `.next`, `2026-11-21T18:59:19+07:00` to `2026-11-21T19:00:47+07:00`): PASS -- typecheck PASS; prototype 22/22 and core/route 268/268 PASS (290 total, 0 failures/skips); clean `next build --webpack` PASS; `test:app` 16/16 checks PASS.
- `npm run test:browser` (`2026-11-21T19:00:57+07:00` to `2026-11-21T19:08:10+07:00`): PASS 14/14 (`appearance`, `daily-weather`, `login-festivals`, `motion`, `pixel-scenes-next`, `pixel-scenes`, `common-tools`, `grammar`, `jlpt-daily`, `kanji`, `shadowing` 28/28, `srs`, `today-roadmap`, `vocab`).
- `daily-weather` JS gzip budget (`data/reports/daily-weather/budget.json`, baseline/limit unchanged): `440,581 B` vs baseline `468,494 B` (`added: -27,913 B <= 5,000 B` limit; `32,913 B` under `473,494 B`). Zero `.next/static/chunks/**/*.js` files contain `node:sqlite`, `better-sqlite`, or `kuromoji`.
- `node tools/check-route-scope.mjs origin/master naetoru/lookup-popup`: PASS (19 files including this append-only audit entry; `tools/check-route-scope.mjs` diff `+2/-0`). Only this append-only audit entry follows `9a1fed4`.

## Pokabu JLPT free-provider rate pacing -- 2026-11-21

Checked implementation `d6ccb01b54d2c76ab0de7ad5c91527e11d18a111` against `133b0068aeac08d3989a5e6c5d959ab60589e157` on Windows, Node v24.10.0 and npm 11.6.1. Build started without .next and the app gate used a disposable OpenJLPT fixture. Check window: 2026-11-21T19:43:33.1636447+07:00 through 2026-11-21T19:45:05.2099562+07:00.
- `npm run check` passed typecheck, 22/22 prototype tests, 279/279 core/route tests, production build, and 16/16 app checks.
- Seven new mock regressions cover Groq retry, long-reset fallback, consecutive 429s, day cap, token pacing, OpenRouter retry and preflight, and rate-limit log redaction. Focused provider suite passed 34/34.
- Route-scope and diff checks passed. No live model calls. The prior campaign explicitly excluded Gemini in its invocation; default model routing is unchanged.

## Naetoru grammar confusables notes and links -- 2026-11-21

Checked implementation `313c50e8f05d1d53880373e15f6c3e4918340f36` on branch `naetoru/grammar-confusables` (synced with `origin/master` `11163c5`) on Windows with Node v24.10.0, clean `.next` build, disposable OpenJLPT fixture, and local headless Chrome.
- Feature: added read-only grammar confusable extraction (`src/app/(study)/grammar/confusables.ts`), attached `confusables` on `GrammarDetail` (`src/app/(study)/grammar/repository.ts`), and rendered the `"Dễ nhầm với"` section on `src/app/(study)/grammar/[id]/page.tsx` with Wasoku styling (`src/app/(study)/grammar/grammar.module.css`). Zero schema or G0 DB mutations; zero hand-written or AI-generated grammar content. Extracts licensed contrast sentences directly from OpenJLPT `grammar.notes_en` (`CC-BY-SA-4.0`) paired with existing selected Vietnamese `vi_translations` (`field='notes'`) when present, displays canonical `/grammar/<encoded-id>` links + level badges + provenance labels, hides inactive/broken targets (`is_active=0`), and omits the entire section when no active confusables exist.
- Frozen G0 DB read-only audit (403 active grammar rows: N5=81, N4=98, N3=101, N2=123): 101 unique undirected confusable pairs (N5=6, N4=11, N3=40, N2=44 by higher-level bucket), 124 directed contrast notes (N5=8, N4=14, N3=53, N2=49 by source level), covering 158/403 grammar detail pages (N5=19, N4=30, N3=58, N2=51), 202/202 rendered rows with exact single-sentence Vietnamese + English contrast notes and 0 false positives.
- `npm run check` (clean `.next`, `2026-11-21T20:29:10+07:00` to `2026-11-21T20:30:47+07:00`): PASS -- typecheck PASS; prototype 22/22 and core/route 282/282 PASS (304 total, 0 failures/skips, including 4 new tests in `tests/grammar-confusables.test.ts`); clean `next build --webpack` PASS; `test:app` 16/16 checks PASS.
- `npm run test:browser` (`2026-11-21T20:30:53+07:00` to `2026-11-21T20:38:10+07:00`): PASS 14/14 (`appearance`, `daily-weather`, `login-festivals`, `motion`, `pixel-scenes-next`, `pixel-scenes`, `common-tools`, `grammar`, `jlpt-daily`, `kanji`, `shadowing`, `srs`, `today-roadmap`, `vocab`).
- `daily-weather` JS gzip budget (`data/reports/daily-weather/budget.json`, baseline/limit unchanged): `440,793 B` vs baseline `468,494 B` (`added: -27,701 B <= 5,000 B` limit; `32,701 B` under `473,494 B`). Zero `.next/static/chunks/**/*.js` files contain `node:sqlite`, `better-sqlite`, or `kuromoji`.
- Mobile 390px production verification on `/grammar/openjlpt%3Agrammar%3Akanenai` with disposable frozen G0 copy: `"Dễ nhầm với"` visible with 2 active links (`〜かねる`, `〜おそれがある`), click navigation verified to `/grammar/openjlpt%3Agrammar%3Akaneru`, `scrollWidth 390 <= innerWidth 390` (0 horizontal overflow), 0 page errors.
- `node tools/check-route-scope.mjs origin/master naetoru/grammar-confusables`: PASS (7 files including this append-only audit entry; `tools/check-route-scope.mjs` diff `+1/-0`; `docs/features/g1-grammar.md` left untouched while PR #92 remains OPEN). Only this append-only audit entry follows `313c50e`.

## Naetoru common-tools FTS5 search index (PR-B8) -- 2026-11-21

Checked implementation `5f89c3cc379df77eb7bb3be558317f0e11c2bb64` on branch `naetoru/search-fts5` (base `133b006a564f579d33e1e8251500c0f14e512e85`) on Windows with Node v24.10.0 (SQLite 3.50.4 with `ENABLE_FTS5`), clean `.next` build, disposable OpenJLPT fixture, local headless Chrome, and read-only frozen G0 snapshot benchmark.
- Architecture & tokenizer: sidecar SQLite FTS5 index (`private/<db>.search-fts5.sqlite`, with `:memory:` fallback for in-memory or read-only directories) using `tokenize='trigram case_sensitive 1'` over pre-normalized (`normalize()` NFC/lowercase/Katakana-to-Hiragana/diacritic-stripped/`?->d` + `toRomaji()`) fields. `trigram` supports arbitrary substring matching for space-less Japanese (Kanji, Hiragana, Katakana) plus Romaji, English, and accent-free Vietnamese with zero external dependencies, while `1-2` codepoint queries use `instr()` against the pre-normalized sidecar `search_items` table ordered by `(level, kind, title, id)` rowid. Source G0 DB schema and bytes remain untouched (preserving `openContentDatabase` read-only mode and `src/core/backup.ts` `SCHEMA_MISMATCH`/restore compatibility).
- Real G0 snapshot benchmark (read-only frozen G0 snapshot, 6,182 active vocab/kanji/grammar items + 8,616 selected translations, 50 representative queries covering kana, kanji, romaji, Han Viet, accented/unaccented Vietnamese, English, `%`, SQL-injection pattern): cold build `1,187.1 ms` (`4.86 MB` sidecar), idempotent re-check `2.95 ms` (`rebuilt=false`), exact parity `50/50` with legacy scan; FTS5 end-to-end (`openContentDatabase` + `searchContent` + `selectedTranslation` hydration + `close`) `p50=4.62 ms`, `p95=8.99 ms`, `max=11.07 ms` (`< 200 ms` target) vs legacy SQL scan (without hydration) `p50=3,223.68 ms`, `p95=3,625.89 ms`, `max=3,733.05 ms`.
- `npm run check` (clean `.next`, `2026-11-21T19:59:08+07:00` to `2026-11-21T20:00:41+07:00`): PASS -- typecheck PASS; prototype 22/22 and core/route 275/275 PASS (297 total, 0 failures/skips, including unmodified `src/app/(study)/common-tools/repository.test.ts` and new `tests/search-fts5.test.ts`); clean `next build --webpack` PASS; `test:app` 16/16 checks PASS. Zero `.next/static` client JS chunks contain `node:sqlite`, `better-sqlite`, or `kuromoji`.
- `npm run test:browser` (`2026-11-21T20:00:50+07:00` to `2026-11-21T20:07:59+07:00`): PASS 14/14 (`appearance`, `daily-weather`, `login-festivals`, `motion`, `pixel-scenes-next`, `pixel-scenes`, `common-tools`, `grammar`, `jlpt-daily`, `kanji`, `shadowing`, `srs`, `today-roadmap`, `vocab`).
- `daily-weather` JS gzip budget (`data/reports/daily-weather/budget.json`, baseline/limit unchanged): `437,469 B` vs baseline `468,494 B` (`added: -31,025 B <= 5,000 B` limit; ceiling `473,494 B`).
- `node tools/check-route-scope.mjs origin/master naetoru/search-fts5`: PASS (5 files including this append-only audit entry; `tools/check-route-scope.mjs` `+2/-0`). Checklist ticks for `docs/features/g1-foundation.md:31` (PR #92 open) and `docs/features/g1-common-tools.md:37` (PR #91 open) deferred to avoid overlapping open PRs. Only this append-only audit entry follows `5f89c3c`.
