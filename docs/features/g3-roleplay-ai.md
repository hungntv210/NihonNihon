# Giao tiếp: roleplay với AI

- **Nhánh:** `g3/roleplay-ai`
- **Giai đoạn:** Giai đoạn 3 – Nâng cao (xong trước 17/05/2027, lúc bắt đầu N3)
- **Phụ thuộc:** `g1/foundation`, `g1/common-tools`
- **Tài liệu gốc:** Đặc tả v2 mục 15 (Hệ thống, Giai đoạn 3) (trên Claude: [Đặc tả chức năng v2](https://claude.ai/artifact/4ApVpJNZA9s3311eurPcCX), [Kế hoạch phát triển](https://claude.ai/artifact/HarDe5qR2isfbLRypcAboS), [Lộ trình N5 → N2](https://claude.ai/artifact/5eT7QNEDrNDnXousnhTbHb); chỉ mở được bằng tài khoản Claude của chủ dự án)
- **Giao diện:** theo thiết kế 8-bit × bóng đá trong `docs/superpowers/specs/2026-11-01-giao-dien-8bit-bong-da-design.md` và prototype `prototype/`

Tài liệu này đọc riêng được: mọi quyết định cần cho nhánh đều nằm ở đây.

## Mục tiêu

Luyện phản xạ hội thoại theo tình huống công sở và đời thường; AI sửa lỗi ngữ pháp và mức lịch sự.

## Chức năng

- [ ] Tình huống có mục tiêu (ví dụ xin sếp nghỉ thứ Sáu), AI đóng vai sếp, khách hàng, nhân viên cửa hàng
- [ ] Trả lời bằng giọng nói (nhận dạng) hoặc gõ
- [ ] Gợi ý 2–3 câu mẫu theo các mức lịch sự khi bí
- [ ] Nhận xét cuối phiên: lỗi ngữ pháp, sai mức lịch sự, câu tự nhiên hơn, từ nên thêm vào SRS
- [ ] Bảng văn phong: thể thường / です・ます / tôn kính / khiêm nhường

## Dữ liệu

- Lịch sử hội thoại lưu riêng; khoá API gọi qua backend.

## Quy tắc và ràng buộc

- Giới hạn số phiên/ngày theo ngân sách API cá nhân.

## Không làm trong nhánh này

- Không có.

## Tiêu chí hoàn thành

- [ ] Hoàn thành một tình huống công sở, nhận được nhận xét có câu sửa

## Câu hỏi còn mở

- Chọn mô hình AI và ngân sách hằng tháng.

## Bối cảnh chung (tóm tắt)

- Web học tiếng Nhật **cho riêng một người dùng**, miễn phí, không kinh doanh, **không công khai** (bắt buộc đăng nhập mọi trang).
- Chạy trên VPS nhỏ hoặc máy nhà + Tailscale; dùng chủ yếu trên điện thoại dưới dạng PWA.
- Lộ trình N5 → N2: 87 tuần, bắt đầu 02/11/2026; thi N4 04/07/2027 (tuỳ chọn), N3 05/12/2027, N2 02/07/2028.
- Nhịp ngày đi làm: **ban ngày 5–10 phút Ôn nhanh** (chỉ thẻ từ vựng + kanji, không âm thanh); **buổi tối 45–60 phút** cho bài mới, ngữ pháp, dạng đề JLPT, shadowing.
- Bắt buộc **2 buổi shadowing/tuần** (Thứ Ba, Thứ Năm; Thứ Bảy khuyến khích). Thiếu buổi → khoá bài mới tuần sau; **ôn tập SRS không bao giờ bị khoá**.
- Người dùng là người học, **không biên tập nội dung**: tiếng Việt lấy từ nguồn có sẵn, phần thiếu dùng dịch máy (luôn kèm bản tiếng Anh và nút Báo sai).
