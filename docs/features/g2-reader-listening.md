# Đọc và Nghe

- **Nhánh:** `g2/reader-listening`
- **Giai đoạn:** Giai đoạn 2 – Đọc + JLPT (xong trước 25/01/2027, lúc bắt đầu N4)
- **Phụ thuộc:** `g1/common-tools`, `g1/vocab`
- **Tài liệu gốc:** Đặc tả v2 mục 10 (trên Claude: [Đặc tả chức năng v2](https://claude.ai/artifact/4ApVpJNZA9s3311eurPcCX), [Kế hoạch phát triển](https://claude.ai/artifact/HarDe5qR2isfbLRypcAboS), [Lộ trình N5 → N2](https://claude.ai/artifact/5eT7QNEDrNDnXousnhTbHb); chỉ mở được bằng tài khoản Claude của chủ dự án)
- **Giao diện:** theo thiết kế 8-bit × bóng đá trong `docs/superpowers/specs/2026-11-01-giao-dien-8bit-bong-da-design.md` và prototype `prototype/`

Tài liệu này đọc riêng được: mọi quyết định cần cho nhánh đều nằm ở đây.

## Mục tiêu

Biến mọi đoạn tiếng Nhật thành bài đọc có furigana và tra từ một chạm; thêm chế độ nghe khi không nhìn màn hình.

## Chức năng

- [ ] Nguồn bài: dán văn bản bất kỳ (tin tức, Tadoku, IRODORI), bài AI sinh theo từ và ngữ pháp đã học + 5–10% từ mới, phụ đề clip
- [ ] Tách từ tự động; furigana: tất cả / chỉ chữ chưa học / tắt
- [ ] Tô màu từ theo trạng thái, % từ đã biết của bài
- [ ] Nghe từng câu hoặc cả bài (TTS); hiện/ẩn bản dịch từng câu
- [ ] Câu hỏi đọc hiểu tự sinh cho bài AI
- [ ] Nghe thụ động: phát liên tục clip và câu đã học khi tắt màn hình
- [ ] Chép chính tả: nghe một câu, gõ lại bằng kana

## Dữ liệu

- Bài dán và bài AI lưu riêng cho người dùng.

## Quy tắc và ràng buộc

- Văn bản dán từ nguồn có bản quyền chỉ dùng cá nhân.

## Không làm trong nhánh này

- Đề 読解 (`g2/jlpt-full`).

## Tiêu chí hoàn thành

- [ ] Dán một bài báo 500 chữ, có furigana và tra từ trong < 3 giây

## Câu hỏi còn mở

- Chọn mô hình AI sinh bài đọc.

## Bối cảnh chung (tóm tắt)

- Web học tiếng Nhật **cho riêng một người dùng**, miễn phí, không kinh doanh, **không công khai** (bắt buộc đăng nhập mọi trang).
- Chạy trên VPS nhỏ hoặc máy nhà + Tailscale; dùng chủ yếu trên điện thoại dưới dạng PWA.
- Lộ trình N5 → N2: 87 tuần, bắt đầu 02/11/2026; thi N4 04/07/2027 (tuỳ chọn), N3 05/12/2027, N2 02/07/2028.
- Nhịp ngày đi làm: **ban ngày 5–10 phút Ôn nhanh** (chỉ thẻ từ vựng + kanji, không âm thanh); **buổi tối 45–60 phút** cho bài mới, ngữ pháp, dạng đề JLPT, shadowing.
- Bắt buộc **2 buổi shadowing/tuần** (Thứ Ba, Thứ Năm; Thứ Bảy khuyến khích). Thiếu buổi → khoá bài mới tuần sau; **ôn tập SRS không bao giờ bị khoá**.
- Người dùng là người học, **không biên tập nội dung**: tiếng Việt lấy từ nguồn có sẵn, phần thiếu dùng dịch máy (luôn kèm bản tiếng Anh và nút Báo sai).
