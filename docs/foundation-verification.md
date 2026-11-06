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
