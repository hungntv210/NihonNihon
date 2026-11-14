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

- [ ] **Popup tra từ:** chạm từ tiếng Nhật bất kỳ → cách đọc, Hán Việt, nghĩa Việt (nhãn nguồn), cấp, nút Thêm vào ôn (kèm câu gốc)
- [x] **Thanh tìm kiếm chung:** kanji, kana, romaji, Hán Việt, tiếng Việt; **gõ không dấu vẫn tìm ra** ("lam viec" → "làm việc")
- [ ] Kết quả gồm từ, kanji, mẫu ngữ pháp, câu trong clip
- [ ] Từ ngoài JLPT tra qua JMdict + tu-dien-nhat-viet
- [ ] **Báo sai** trên mọi dòng tiếng Việt: chỉ đánh dấu, không phải sửa

## Dữ liệu

- Chỉ mục FTS5; bảng báo sai (mục, ngữ cảnh, ngày).

## Quy tắc và ràng buộc

- Mọi input chuẩn hoá NFC trước khi tìm.

## Không làm trong nhánh này

- Sổ tay, dịch lại mục bị báo hằng tuần (`g2/study-tools`).

## Tiêu chí hoàn thành

- [ ] Tra từ trả kết quả < 200 ms
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

Tìm chung đã có từ/kanji/ngữ pháp; popup mọi văn bản, câu trong clip và từ điển ngoài JLPT chưa có. Báo sai hiện có ở vocab/kanji/grammar, chưa phải mọi dòng Việt. Chưa đo mục tiêu200ms trên dữ liệu thật.
