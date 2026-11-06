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

### 2026-11-06T21:02:15.3528179+07:00 — g1/grammar

- Commit kiểm tra: 596953e3d26d210fb12b71241c94386205fd6efe.
- Bắt đầu: 2026-11-06T21:00:43.2698194+07:00; kết thúc: 2026-11-06T21:02:15.3528179+07:00.
- npm run check: PASS; typecheck, build production và test:app HTTP/Chrome desktop/mobile đều đạt.
- Kiểm thử: prototype 22/22 + foundation/grammar 21/21 = **43/43**, không lỗi hoặc bỏ qua.
- node tools/check-route-scope.mjs origin/master grammar: PASS; trước nhật ký có 14 file, tất cả trong src/app/(study)/grammar/.
- Log local: data/reports/grammar-check-596953e.log và data/reports/grammar-scope.log (gitignored).
- Có tìm kiếm/lọc/phân trang, chi tiết nguồn-aware, ví dụ/furigana, bài tập dựng lại câu gốc và Báo sai. Chưa nghiệm thu đủ403 mẫu/VI/clip vì G0 chưa merge; không tự tạo nội dung thiếu, không sửa schema.
