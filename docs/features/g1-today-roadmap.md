# Hôm nay, Lộ trình và luật học

- **Nhánh:** `g1/today-roadmap`
- **Giai đoạn:** Giai đoạn 1 – MVP (càng sớm càng tốt)
- **Phụ thuộc:** `g1/foundation`, `g1/srs`
- **Tài liệu gốc:** Đặc tả v2 mục 3, 4, 13 (thông báo); Lộ trình N5 → N2 (trên Claude: [Đặc tả chức năng v2](https://claude.ai/artifact/4ApVpJNZA9s3311eurPcCX), [Kế hoạch phát triển](https://claude.ai/artifact/HarDe5qR2isfbLRypcAboS), [Lộ trình N5 → N2](https://claude.ai/artifact/5eT7QNEDrNDnXousnhTbHb); chỉ mở được bằng tài khoản Claude của chủ dự án)
- **Giao diện:** theo thiết kế 8-bit × bóng đá trong `docs/superpowers/specs/2026-11-01-giao-dien-8bit-bong-da-design.md` và prototype `prototype/` (trang chủ, lịch trận shadowing, thẻ vàng – treo giò)

Tài liệu này đọc riêng được: mọi quyết định cần cho nhánh đều nằm ở đây.

## Mục tiêu

"Người dẫn đường": biết hôm nay là tuần nào của lộ trình, giao việc theo **ban ngày / buổi tối**, đếm buổi shadowing và áp luật khoá.

## Chức năng

**Màn Hôm nay**
- [ ] Ban ngày: một nút lớn **Ôn nhanh** kèm số thẻ từ + kanji còn lại
- [ ] Từ giờ học tối: danh sách việc buổi tối, mỗi việc có nút bắt đầu và thời gian ước tính
- [ ] Thanh shadowing tuần này (ví dụ 1/2), ô thiếu chuyển đỏ từ tối Thứ Sáu
- [ ] Chuỗi ngày học, số lần "đóng băng" còn lại; đếm ngược kỳ thi; độ phủ cấp hiện tại
- [ ] Nút Tiếp tục quay lại việc đang dở

**Buổi tối (45–60 phút)**

| # | Việc | Thời lượng |
| --- | --- | --- |
| 1 | Ôn nốt thẻ còn lại + thẻ ngữ pháp | 5–10 phút |
| 2 | Kanji + từ mới của ngày | 10–15 phút |
| 3 | Ngữ pháp mới + bài tập | 10–15 phút |
| 4 | Dạng đề JLPT 10 câu | 10–15 phút |
| 5 | Shadowing (Thứ Ba, Thứ Năm, tuỳ chọn Thứ Bảy) thay cho bước 4 | 15–20 phút |

- [ ] Tối chỉ có 20 phút: rút gọn còn bước 1–3, dời phần còn lại sang Chủ nhật
- [ ] Chủ nhật: không bài mới; ôn SRS, kiểm tra tuần 20 phút, làm bù

**Lộ trình**
- [ ] 87 tuần N5 → N2; mỗi tuần có chủ đề, kanji, từ, mẫu ngữ pháp, clip gợi ý
- [ ] Chia kanji và từ tự động từ OpenJLPT theo cấp, ưu tiên tần suất cao
- [ ] Xem dạng dòng thời gian; đổi ngày bắt đầu, phút học, kỳ thi → tự tính lại

**Thông báo**
- [ ] Ban ngày: 2–3 nhắc Ôn nhanh vào giờ nghỉ tự chọn, tự tắt khi đã ôn hết; không nhắc bài mới trong giờ làm
- [ ] Buổi tối: nhắc giờ học; ngày shadowing chưa làm nhắc lại 21:00 và 22:00

## Dữ liệu

Khối lượng theo cấp (OpenJLPT): N5 84 kanji / 674 từ / 81 mẫu; N4 169 / 630 / 98; N3 387 / 1.659 / 101; N2 398 / 1.778 / 123.

## Quy tắc và ràng buộc

| Tình huống | Web làm gì |
| --- | --- |
| Thiếu buổi shadowing bắt buộc khi hết Chủ nhật | Khoá bài mới tuần sau; mở bằng buổi bù 25 phút (2 clip) |
| Lỡ 1–3 ngày | Chỉ giao ôn SRS đến khi hàng ôn về mức bình thường |
| Lỡ cả tuần | Lộ trình lùi 1 tuần, tính lại ngày thi dự kiến |
| Chậm hơn 4 tuần so với mốc thi | Đề xuất giảm 30% từ mới hoặc chuyển kỳ thi sau |
| Dự báo thẻ ban ngày > 60 | Giảm bài mới buổi tối, báo trên màn Hôm nay |
| Ốm, bận thật | Tạm nghỉ tối đa 2 tuần mỗi 6 tháng, khai báo trước |
| Có buổi shadowing thứ 3 | +1 lần đóng băng (giữ tối đa 2) |

Ẩn dụ bóng đá (thẻ vàng, treo giò) chỉ dùng ở lớp động lực, không chen vào nội dung học.

## Không làm trong nhánh này

- Điều kiện qua cấp, tự tính lại lộ trình nâng cao (nhánh `g2/jlpt-full`).

## Tiêu chí hoàn thành

- [ ] Màn Hôm nay tự đổi giữa ban ngày và buổi tối theo giờ cài đặt
- [ ] Thiếu buổi shadowing → tuần sau bị khoá bài mới, ôn SRS vẫn mở
- [ ] Buổi bù mở khoá đúng
- [ ] Thông báo không gửi bài mới trong giờ làm

## Câu hỏi còn mở

- Giờ học tối mặc định là mấy giờ.
- Thời lượng buổi tối thực tế (đang giả định 45–60 phút).

## Bối cảnh chung (tóm tắt)

- Web học tiếng Nhật **cho riêng một người dùng**, miễn phí, không kinh doanh, **không công khai** (bắt buộc đăng nhập mọi trang).
- Chạy trên VPS nhỏ hoặc máy nhà + Tailscale; dùng chủ yếu trên điện thoại dưới dạng PWA.
- Lộ trình N5 → N2: 87 tuần, bắt đầu 02/11/2026; thi N4 04/07/2027 (tuỳ chọn), N3 05/12/2027, N2 02/07/2028.
- Nhịp ngày đi làm: **ban ngày 5–10 phút Ôn nhanh** (chỉ thẻ từ vựng + kanji, không âm thanh); **buổi tối 45–60 phút** cho bài mới, ngữ pháp, dạng đề JLPT, shadowing.
- Bắt buộc **2 buổi shadowing/tuần** (Thứ Ba, Thứ Năm; Thứ Bảy khuyến khích). Thiếu buổi → khoá bài mới tuần sau; **ôn tập SRS không bao giờ bị khoá**.
- Người dùng là người học, **không biên tập nội dung**: tiếng Việt lấy từ nguồn có sẵn, phần thiếu dùng dịch máy (luôn kèm bản tiếng Anh và nút Báo sai).
