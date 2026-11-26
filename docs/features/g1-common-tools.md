# Công cụ chung: tra cứu, tìm kiếm, Báo sai

- **Nhánh:** `g1/common-tools`
- **Giai đoạn:** Giai đoạn 1 – MVP (càng sớm càng tốt)
- **Phụ thuộc:** `g1/foundation`, `g0/data-import`
- **Tài liệu gốc:** Đặc tả v2 mục 12, 14.2–14.3 (trên Claude: [Đặc tả chức năng v2](https://claude.ai/artifact/4ApVpJNZA9s3311eurPcCX), [Kế hoạch phát triển](https://claude.ai/artifact/HarDe5qR2isfbLRypcAboS), [Lộ trình N5 → N2](https://claude.ai/artifact/5eT7QNEDrNDnXousnhTbHb); chỉ mở được bằng tài khoản Claude của chủ dự án)
- **Giao diện:** theo [thiết kế giao diện học tập](../interface-redesign.md) (`docs/interface-redesign.md`) và prototype `prototype/` hiện hành.

Tài liệu này đọc riêng được: mọi quyết định cần cho nhánh đều nằm ở đây.

## Mục tiêu

Ba công cụ có mặt ở mọi màn hình.

## Chức năng

- [x] **Popup tra từ:** chạm từ tiếng Nhật bất kỳ → cách đọc, Hán Việt, nghĩa Việt (nhãn nguồn), cấp, nút Thêm vào ôn (kèm câu gốc)
- [x] **Thanh tìm kiếm chung:** kanji, kana, romaji, Hán Việt, tiếng Việt; **gõ không dấu vẫn tìm ra** ("lam viec" → "làm việc")
- [x] Kết quả gồm từ, kanji, mẫu ngữ pháp, câu trong clip
- [ ] Từ ngoài JLPT tra qua JMdict + tu-dien-nhat-viet
  - Còn thiếu: chưa nạp kho từ ngoài JLPT từ JMdict (bản sao DB app chỉ đọc hiện chỉ có 4.741 mục `vocab` nguồn `openjlpt`, 0 mục JMdict) và `src/app/(study)/common-tools/lookup.ts:121-227` chưa có nhánh tra cứu ngoài JLPT qua JMdict + `tu-dien-nhat-viet`.
- [x] **Báo sai** trên mọi dòng tiếng Việt: chỉ đánh dấu, không phải sửa

## Dữ liệu

- Chỉ mục FTS5; bảng báo sai (mục, ngữ cảnh, ngày).

## Quy tắc và ràng buộc

- Mọi input chuẩn hoá NFC trước khi tìm.

## Không làm trong nhánh này

- Sổ tay, dịch lại mục bị báo hằng tuần (`g2/study-tools`).

## Tiêu chí hoàn thành

- [x] Tra từ trả kết quả < 200 ms
- [x] Gõ có dấu, không dấu, romaji đều tìm ra cùng từ

## Câu hỏi còn mở

- Tách từ cho popup dùng kuromoji hay Sudachi.

## Bối cảnh chung (tóm tắt)

- Web học tiếng Nhật **cho riêng một người dùng**, miễn phí, không kinh doanh, **không công khai** (bắt buộc đăng nhập mọi trang).
- Chạy trên VPS nhỏ hoặc máy nhà + Tailscale; dùng chủ yếu trên điện thoại dưới dạng PWA.
- Lộ trình N5 → N2: 87 tuần, bắt đầu 02/11/2026; thi N4 04/07/2027 (tuỳ chọn), N3 05/12/2027, N2 02/07/2028.
- Nhịp ngày đi làm: **ban ngày 5–10 phút Ôn nhanh** (chỉ thẻ từ vựng + kanji, không âm thanh); **buổi tối 45–60 phút** cho bài mới, ngữ pháp, dạng đề JLPT, shadowing.
- Bắt buộc **2 buổi shadowing/tuần** (Thứ Ba, Thứ Năm; Thứ Bảy khuyến khích). Thiếu buổi → khoá bài mới tuần sau; **ôn tập SRS không bao giờ bị khoá**.
- Người dùng là người học, **không biên tập nội dung**: tiếng Việt lấy từ nguồn có sẵn, phần thiếu dùng dịch máy (luôn kèm bản tiếng Anh và nút Báo sai).

## Đối chiếu triển khai và bằng chứng — 2026-11-14

Các dấu tick xác nhận phần code đã chạy qua test/fixture; không thay cho nghiệm thu độ phủ dữ liệu hay benchmark thiết bị. Các mục ghép chỉ hoàn thành một phần vẫn để [ ]. Không đổi tiêu chí/luật học.

- Bằng chứng: `src/app/(study)/common-tools/repository.ts`.
- Bằng chứng: `src/app/(study)/common-tools/repository.test.ts`.
- Bằng chứng: `src/app/(study)/common-tools/browser-check.ts`.
- Bằng chứng (2026-11-21): `src/app/(study)/common-tools/lookup-popup.tsx`, `src/app/(study)/common-tools/lookup.ts`, `src/app/(study)/common-tools/tokenize.ts`, `src/app/api/common-tools/lookup/route.ts`, `tests/lookup-popup.test.ts`.
- Bằng chứng (2026-11-22): `src/app/(study)/common-tools/fts5.ts`, `src/app/(study)/common-tools/clip-search.ts`, `src/app/(study)/common-tools/repository.ts`, `src/app/(study)/common-tools/search/page.tsx`, `tests/search-all-kinds.test.ts`.
- Bằng chứng (2026-11-22): `src/core/content.ts`, `src/app/(study)/common-tools/report-store.ts`, `src/app/(study)/common-tools/report-handler.ts`, `src/app/api/common-tools/reports/route.ts`, `src/app/(study)/common-tools/report-vi-button.tsx`, `src/app/(study)/common-tools/search/page.tsx`, `src/app/(study)/common-tools/lookup-popup.tsx`, `src/app/(study)/vocab/notebook/page.tsx`, `src/app/(study)/vocab/lesson/kanji/card-body.tsx`, `src/app/(study)/kanji/page.tsx`, `src/app/(study)/kanji/[character]/page.tsx`, `src/app/(study)/grammar/page.tsx`, `src/app/(study)/grammar/[id]/page.tsx`, `src/app/(study)/srs/review-session.tsx`, `tests/report-vi-line.test.ts`.
- Bằng chứng đo độ trễ server (2026-11-22): `tools/lookup-latency-benchmark.ts` chạy qua `NIHON_DB_PATH` trên bản sao chỉ-đọc DB cỡ thật G0 (`4,741` vocab, `1,038` kanji, `403` grammar, `9,248` câu; `6,182` mục chỉ mục FTS5 trigram, dựng chỉ mục lần đầu `607.91 ms`; máy đo Windows x64, Node v24.10.0, Intel Core i7-11800H 2.30GHz, 15.7 GB RAM). Phác đồ: 30 truy vấn cố định (6 kana, 6 kanji, 6 romaji, 6 tiếng Việt có dấu/không dấu, 6 chuỗi không kết quả) × 5 lượt, bỏ lượt đầu = 120 mẫu/đường tra:
  - `searchAllKinds` (4 nhóm): p50 `3.62 ms`, p95 `7.63 ms`, max `8.57 ms`
  - `lookupWord` (gọi trực tiếp): p50 `2.28 ms`, p95 `5.81 ms`, max `6.87 ms`
  - `GET /api/common-tools/lookup` (handler gồm mở/đóng DB + JSON): p50 `3.53 ms`, p95 `9.13 ms`, max `14.68 ms`
  - Ghi chú: mọi đường tra đều p95 `< 10 ms` (dưới ngưỡng `< 200 ms`); đây là độ trễ xử lý phía server trên máy nhà (chưa gồm RTT mạng/Tailscale và render trình duyệt; bản sao DB G0 hiện có `1` dòng `vi_translations` đang `selected`).

Tìm chung đã tách 4 nhóm kết quả (Từ, Kanji, Mẫu ngữ pháp, Câu trong clip — tối đa 10 mục/nhóm, link câu trong clip trỏ đúng `/shadowing?clip=...&segment=...` và loại clip đã xoá/inactive, so khớp NFKC); popup tra từ tại chỗ (tách từ `kuromoji` phía server, `/api/common-tools/lookup`, dialog có focus trap + `Esc`/click ngoài + nút Thêm vào ôn kèm câu gốc, không lấy nghĩa từ KanjiDictVN) đã triển khai và gắn trên phụ đề shadowing; nút Báo sai chỉ đánh dấu (`POST /api/common-tools/reports` lưu vào `translation_reports` sẵn có, idempotent, không sửa `vi_translations`) đã phủ mọi dòng tiếng Việt có `vi_translations` trên `common-tools` (tìm chung, popup tra từ), `vocab` (sổ từ, chi tiết, bài học từ/kanji, sổ từ cá nhân), `kanji` (danh sách, chi tiết và từ liên quan), `grammar` (danh sách, chi tiết gồm dễ nhầm và mẫu cùng nhóm) và `srs` (đáp án phiên ôn khi có mạng); phụ đề clip JSON ngoài không có dòng `vi_translations` nên không tạo thêm bảng mới; đo độ trễ server trên bản sao DB cỡ thật G0 đạt p95 `< 10 ms` (< 200 ms) trên cả tìm chung và popup tra từ. Từ điển ngoài JLPT vẫn giữ trống.
