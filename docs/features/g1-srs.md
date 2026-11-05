# Ôn tập SRS và chế độ Ôn nhanh

- **Nhánh:** `g1/srs`
- **Giai đoạn:** Giai đoạn 1 – MVP (càng sớm càng tốt)
- **Phụ thuộc:** `g1/foundation`, `g0/data-import`
- **Tài liệu gốc:** Đặc tả v2 mục 5 (trên Claude: [Đặc tả chức năng v2](https://claude.ai/artifact/4ApVpJNZA9s3311eurPcCX), [Kế hoạch phát triển](https://claude.ai/artifact/HarDe5qR2isfbLRypcAboS), [Lộ trình N5 → N2](https://claude.ai/artifact/5eT7QNEDrNDnXousnhTbHb); chỉ mở được bằng tài khoản Claude của chủ dự án)
- **Giao diện:** theo thiết kế 8-bit × bóng đá trong `docs/superpowers/specs/2026-11-01-giao-dien-8bit-bong-da-design.md` và prototype `prototype/` (màn ôn tập)

Tài liệu này đọc riêng được: mọi quyết định cần cho nhánh đều nằm ở đây.

## Mục tiêu

Một hàng ôn chung cho mọi loại thẻ, lên lịch bằng FSRS (mức ghi nhớ mục tiêu 90%), có chế độ **Ôn nhanh** cho 5–10 phút ban ngày. Ôn tập không bao giờ bị khoá.

## Chức năng

**Loại thẻ**

| Loại | Mặt trước | Người học làm |
| --- | --- | --- |
| Kanji | Chữ | Nhớ Hán Việt + nghĩa |
| Từ – nhận mặt | Từ kanji | Nhớ cách đọc + nghĩa |
| Từ – gõ cách đọc | Từ kanji | Gõ hiragana (tự chuyển romaji) |
| Từ – nghe | Audio | Hiểu nghĩa |
| Câu shadowing | Audio một câu | Nói lại, có thể ghi âm |
| Ngữ pháp | Câu có chỗ trống | (Giai đoạn 2) |

**Phiên ôn**
- [ ] FSRS (ts-fsrs), thẻ khoá theo ID OpenJLPT
- [ ] 4 nút Quên / Khó / Được / Dễ hiện sẵn khoảng cách lần ôn tới
- [ ] Phiên nhỏ 20 thẻ, dừng bất kỳ lúc nào không mất tiến độ; chạy offline
- [ ] Dự báo số thẻ 7 ngày tới

**Ôn nhanh (ban ngày)**
- [ ] Chỉ thẻ từ vựng + kanji đến hạn; ưu tiên quá hạn lâu nhất và thẻ học tối hôm qua
- [ ] Chỉ kiểu nhận mặt; **không tự phát audio** (có nút loa)
- [ ] Vuốt một tay: trái = Quên, phải = Được, lên = Dễ; Khó qua nút
- [ ] 15 thẻ mỗi phiên, hết phiên báo "còn X thẻ"
- [ ] Thẻ chưa ôn hết ban ngày dồn sang đầu buổi tối

## Dữ liệu

- Thẻ, lịch sử ôn, trạng thái FSRS (stability, difficulty, due) lưu theo ID OpenJLPT.

## Quy tắc và ràng buộc

- Giới hạn từ + kanji mới mỗi tối sao cho thẻ đến hạn ban ngày ước tính ≤ 60 (khoảng 8 giây/thẻ).
- Hàng ôn vượt 200 thẻ: giảm nửa bài mới đến khi dưới 150.
- Nút chấm thẻ không dùng ẩn dụ bóng đá; không có chuyển cảnh giữa hai thẻ.

## Không làm trong nhánh này

- Thẻ ngữ pháp, xử lý leech (Giai đoạn 2).

## Tiêu chí hoàn thành

- [ ] Ôn 100 thẻ không giật trên điện thoại tầm trung; chuyển thẻ < 100 ms
- [ ] Ôn offline rồi đồng bộ không mất lượt ôn
- [ ] Phiên Ôn nhanh 15 thẻ xong trong khoảng 2 phút bằng một tay

## Câu hỏi còn mở

- Ngưỡng 60 thẻ/ngày ban ngày có cần chỉnh sau 2 tuần dùng thật không.

## Bối cảnh chung (tóm tắt)

- Web học tiếng Nhật **cho riêng một người dùng**, miễn phí, không kinh doanh, **không công khai** (bắt buộc đăng nhập mọi trang).
- Chạy trên VPS nhỏ hoặc máy nhà + Tailscale; dùng chủ yếu trên điện thoại dưới dạng PWA.
- Lộ trình N5 → N2: 87 tuần, bắt đầu 02/11/2026; thi N4 04/07/2027 (tuỳ chọn), N3 05/12/2027, N2 02/07/2028.
- Nhịp ngày đi làm: **ban ngày 5–10 phút Ôn nhanh** (chỉ thẻ từ vựng + kanji, không âm thanh); **buổi tối 45–60 phút** cho bài mới, ngữ pháp, dạng đề JLPT, shadowing.
- Bắt buộc **2 buổi shadowing/tuần** (Thứ Ba, Thứ Năm; Thứ Bảy khuyến khích). Thiếu buổi → khoá bài mới tuần sau; **ôn tập SRS không bao giờ bị khoá**.
- Người dùng là người học, **không biên tập nội dung**: tiếng Việt lấy từ nguồn có sẵn, phần thiếu dùng dịch máy (luôn kèm bản tiếng Anh và nút Báo sai).
