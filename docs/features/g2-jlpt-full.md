# JLPT đầy đủ: luyện 4 phần, thi thử, điều kiện qua cấp

- **Nhánh:** `g2/jlpt-full`
- **Giai đoạn:** Giai đoạn 2 – Đọc + JLPT (xong trước 25/01/2027, lúc bắt đầu N4)
- **Phụ thuộc:** `g1/jlpt-daily`, `g2/reader-listening`
- **Tài liệu gốc:** Đặc tả v2 mục 11; Lộ trình mục 9 (trên Claude: [Đặc tả chức năng v2](https://claude.ai/artifact/4ApVpJNZA9s3311eurPcCX), [Kế hoạch phát triển](https://claude.ai/artifact/HarDe5qR2isfbLRypcAboS), [Lộ trình N5 → N2](https://claude.ai/artifact/5eT7QNEDrNDnXousnhTbHb); chỉ mở được bằng tài khoản Claude của chủ dự án)
- **Giao diện:** theo thiết kế 8-bit × bóng đá trong `docs/superpowers/specs/2026-11-01-giao-dien-8bit-bong-da-design.md` và prototype `prototype/` (bảng tỉ số thi thử)

Tài liệu này đọc riêng được: mọi quyết định cần cho nhánh đều nằm ở đây.

## Mục tiêu

Trả lời câu hỏi "đã sẵn sàng thi chưa" và quyết định khi nào được lên cấp.

## Chức năng

- [ ] Luyện đủ 4 phần: 文字・語彙, 文法, 読解, 聴解 (nghe dùng TTS)
- [ ] Thi thử đủ cấu trúc, bấm giờ từng phần, nghe chỉ phát một lần
- [ ] Chế độ thi thật và chế độ luyện (xem giải thích ngay)
- [ ] Ước lượng điểm theo thang JLPT, kiểm tra điểm liệt
- [ ] Phân tích dạng bài yếu; câu sai vào SRS
- [ ] Kiểm tra **điều kiện qua cấp**, chưa đạt thì chèn 2 tuần củng cố

## Dữ liệu

- Câu hỏi sinh từ OpenJLPT; bổ sung đề mẫu chính thức jlpt.jp cho mục đích cá nhân.

## Quy tắc và ràng buộc

| Cấp | Đề thi thử | Nhớ SRS 30 ngày | Shadowing |
| --- | --- | --- | --- |
| N5 → N4 | ≥ 100/180 | ≥ 85% | Đủ 2 buổi ở ≥ 10/12 tuần |
| N4 → N3 | ≥ 105/180, không phần nào dưới liệt | ≥ 85% | ≥ 14/16 tuần |
| N3 → N2 | ≥ 110/180, mỗi phần ≥ 25/60 | ≥ 85% | ≥ 26/29 tuần |
| Sẵn sàng thi N2 | ≥ 105/180 ở 2 đề liên tiếp | ≥ 85% | ≥ 27/30 tuần |

Điểm quy đổi chỉ là ước lượng (JLPT chấm theo thang tương đối).

## Không làm trong nhánh này

- Dạng đề hằng tối (đã có ở `g1/jlpt-daily`).

## Tiêu chí hoàn thành

- [ ] Làm trọn một đề N5 bấm giờ, ra điểm từng phần
- [ ] Điều kiện qua cấp chặn/mở cấp đúng

## Câu hỏi còn mở

- Không có.

## Bối cảnh chung (tóm tắt)

- Web học tiếng Nhật **cho riêng một người dùng**, miễn phí, không kinh doanh, **không công khai** (bắt buộc đăng nhập mọi trang).
- Chạy trên VPS nhỏ hoặc máy nhà + Tailscale; dùng chủ yếu trên điện thoại dưới dạng PWA.
- Lộ trình N5 → N2: 87 tuần, bắt đầu 02/11/2026; thi N4 04/07/2027 (tuỳ chọn), N3 05/12/2027, N2 02/07/2028.
- Nhịp ngày đi làm: **ban ngày 5–10 phút Ôn nhanh** (chỉ thẻ từ vựng + kanji, không âm thanh); **buổi tối 45–60 phút** cho bài mới, ngữ pháp, dạng đề JLPT, shadowing.
- Bắt buộc **2 buổi shadowing/tuần** (Thứ Ba, Thứ Năm; Thứ Bảy khuyến khích). Thiếu buổi → khoá bài mới tuần sau; **ôn tập SRS không bao giờ bị khoá**.
- Người dùng là người học, **không biên tập nội dung**: tiếng Việt lấy từ nguồn có sẵn, phần thiếu dùng dịch máy (luôn kèm bản tiếng Anh và nút Báo sai).
