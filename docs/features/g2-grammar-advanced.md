# Ngữ pháp nâng cao: bài tập và thẻ SRS

- **Nhánh:** `g2/grammar-advanced`
- **Giai đoạn:** Giai đoạn 2 – Đọc + JLPT (xong trước 25/01/2027, lúc bắt đầu N4)
- **Phụ thuộc:** `g1/grammar`, `g1/srs`
- **Tài liệu gốc:** Đặc tả v2 mục 8.2, 5.1 (trên Claude: [Đặc tả chức năng v2](https://claude.ai/artifact/4ApVpJNZA9s3311eurPcCX), [Kế hoạch phát triển](https://claude.ai/artifact/HarDe5qR2isfbLRypcAboS), [Lộ trình N5 → N2](https://claude.ai/artifact/5eT7QNEDrNDnXousnhTbHb); chỉ mở được bằng tài khoản Claude của chủ dự án)
- **Giao diện:** theo thiết kế 8-bit × bóng đá trong `docs/superpowers/specs/2026-11-01-giao-dien-8bit-bong-da-design.md` và prototype `prototype/`

Tài liệu này đọc riêng được: mọi quyết định cần cho nhánh đều nằm ở đây.

## Mục tiêu

Hoàn thiện ngữ pháp cho N4–N3: thêm dạng bài khó hơn và đưa mỗi mẫu đã học vào hàng ôn.

## Chức năng

- [ ] Bài tập **chia dạng**: cho từ gốc, gõ dạng đúng để nối với mẫu
- [ ] Bài tập **phân biệt cặp** mẫu dễ nhầm
- [ ] **Thẻ SRS ngữ pháp**: câu có chỗ trống, gõ hoặc chọn mẫu đúng

## Dữ liệu

- OpenJLPT grammar.

## Quy tắc và ràng buộc

- Thẻ ngữ pháp vào chung hàng ôn, chỉ xuất hiện buổi tối (không có trong Ôn nhanh).

## Không làm trong nhánh này

- Dạng đề JLPT (`g2/jlpt-full`).

## Tiêu chí hoàn thành

- [ ] Mỗi mẫu đã học có thẻ SRS
- [ ] Mọi cặp mẫu dễ nhầm trong ghi chú OpenJLPT có bài phân biệt

## Câu hỏi còn mở

- Không có.

## Bối cảnh chung (tóm tắt)

- Web học tiếng Nhật **cho riêng một người dùng**, miễn phí, không kinh doanh, **không công khai** (bắt buộc đăng nhập mọi trang).
- Chạy trên VPS nhỏ hoặc máy nhà + Tailscale; dùng chủ yếu trên điện thoại dưới dạng PWA.
- Lộ trình N5 → N2: 87 tuần, bắt đầu 02/11/2026; thi N4 04/07/2027 (tuỳ chọn), N3 05/12/2027, N2 02/07/2028.
- Nhịp ngày đi làm: **ban ngày 5–10 phút Ôn nhanh** (chỉ thẻ từ vựng + kanji, không âm thanh); **buổi tối 45–60 phút** cho bài mới, ngữ pháp, dạng đề JLPT, shadowing.
- Bắt buộc **2 buổi shadowing/tuần** (Thứ Ba, Thứ Năm; Thứ Bảy khuyến khích). Thiếu buổi → khoá bài mới tuần sau; **ôn tập SRS không bao giờ bị khoá**.
- Người dùng là người học, **không biên tập nội dung**: tiếng Việt lấy từ nguồn có sẵn, phần thiếu dùng dịch máy (luôn kèm bản tiếng Anh và nút Báo sai).
