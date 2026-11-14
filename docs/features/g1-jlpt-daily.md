# Dạng đề JLPT hằng tối

- **Nhánh:** `g1/jlpt-daily`
- **Giai đoạn:** Giai đoạn 1 – MVP (càng sớm càng tốt)
- **Phụ thuộc:** `g1/grammar`, `g1/vocab`, `g1/kanji`
- **Tài liệu gốc:** Đặc tả v2 mục 11, 15 (trên Claude: [Đặc tả chức năng v2](https://claude.ai/artifact/4ApVpJNZA9s3311eurPcCX), [Kế hoạch phát triển](https://claude.ai/artifact/HarDe5qR2isfbLRypcAboS), [Lộ trình N5 → N2](https://claude.ai/artifact/5eT7QNEDrNDnXousnhTbHb); chỉ mở được bằng tài khoản Claude của chủ dự án)
- **Giao diện:** theo [thiết kế giao diện học tập](../interface-redesign.md) (`docs/interface-redesign.md`) và prototype `prototype/` hiện hành.

Tài liệu này đọc riêng được: mọi quyết định cần cho nhánh đều nằm ở đây.

## Mục tiêu

Mỗi tối (trừ ngày shadowing) làm 10 câu theo dạng đề JLPT của cấp hiện tại, chỉ dùng nội dung đã học.

## Chức năng

- [x] Xoay vòng các dạng bài phần 文字・語彙 và 文法:

| Phần | Dạng bài |
| --- | --- |
| 文字・語彙 | Cách đọc kanji, chọn kanji, từ theo ngữ cảnh, đồng nghĩa, cách dùng |
| 文法 | Chọn ngữ pháp, sắp xếp câu ★, ngữ pháp trong đoạn văn |

- [x] Sinh câu hỏi từ dữ liệu OpenJLPT đúng cấp (AI hỗ trợ), chỉ từ/kanji/mẫu đã học
- [x] Giải thích đáp án ngay sau mỗi câu
- [x] Câu sai tự động vào SRS
- [x] Ghi kết quả theo dạng bài để biết điểm yếu

## Dữ liệu

- OpenJLPT; câu hỏi sinh sẵn và lưu lại để không tốn chi phí AI mỗi tối.

## Quy tắc và ràng buộc

- Ẩn dụ bóng đá chỉ ở bảng tỉ số, không chen vào câu hỏi.

## Không làm trong nhánh này

- 読解, 聴解, thi thử đầy đủ, ước điểm (`g2/jlpt-full`).

## Tiêu chí hoàn thành

- [ ] Mỗi tối có đủ 10 câu đúng cấp, không lặp câu trong 30 ngày
- [ ] Câu sai xuất hiện trong hàng ôn ngày hôm sau

## Câu hỏi còn mở

- Đã chốt sinh trước theo tuần (7 ngày × 10 câu); bank thật vẫn cần QA/duyệt.

## Bối cảnh chung (tóm tắt)

- Web học tiếng Nhật **cho riêng một người dùng**, miễn phí, không kinh doanh, **không công khai** (bắt buộc đăng nhập mọi trang).
- Chạy trên VPS nhỏ hoặc máy nhà + Tailscale; dùng chủ yếu trên điện thoại dưới dạng PWA.
- Lộ trình N5 → N2: 87 tuần, bắt đầu 02/11/2026; thi N4 04/07/2027 (tuỳ chọn), N3 05/12/2027, N2 02/07/2028.
- Nhịp ngày đi làm: **ban ngày 5–10 phút Ôn nhanh** (chỉ thẻ từ vựng + kanji, không âm thanh); **buổi tối 45–60 phút** cho bài mới, ngữ pháp, dạng đề JLPT, shadowing.
- Bắt buộc **2 buổi shadowing/tuần** (Thứ Ba, Thứ Năm; Thứ Bảy khuyến khích). Thiếu buổi → khoá bài mới tuần sau; **ôn tập SRS không bao giờ bị khoá**.
- Người dùng là người học, **không biên tập nội dung**: tiếng Việt lấy từ nguồn có sẵn, phần thiếu dùng dịch máy (luôn kèm bản tiếng Anh và nút Báo sai).

## Đối chiếu triển khai và bằng chứng — 2026-11-14

Các dấu tick xác nhận phần code đã chạy qua test/fixture; không thay cho nghiệm thu độ phủ dữ liệu hay benchmark thiết bị. Các mục ghép chỉ hoàn thành một phần vẫn để [ ]. Không đổi tiêu chí/luật học.

- Bằng chứng: `src/app/(study)/jlpt-daily/jlpt.test.ts`.
- Bằng chứng: `src/app/(study)/jlpt-daily/hard-qa.test.ts`.
- Bằng chứng: `src/app/(study)/jlpt-daily/browser-check.ts`.

Đánh dấu luồng code được kiểm bằng fixture, không tuyên bố bank thật đã phủ mọi tối. Generator sinh theo tuần7×10 và lọc nội dung đã ôn, không gọi AI lúc mở trang. Mục ngân hàng thật/nhắc ôn ngày hôm sau chưa nghiệm thu đủ nên vẫn để trống. Câu hỏi còn mở về chu kỳ sinh đã được chốt theo tuần, không đổi luật30ngày.
