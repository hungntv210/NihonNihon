# Import dữ liệu và batch thử

- **Nhánh:** `g0/data-import`
- **Giai đoạn:** Giai đoạn 0 – Nền dữ liệu (làm ngay)
- **Phụ thuộc:** `g0/data-spec`
- **Tài liệu gốc:** Kế hoạch phát triển mục 4.2–4.4, Đặc tả v2 mục 14 (trên Claude: [Đặc tả chức năng v2](https://claude.ai/artifact/4ApVpJNZA9s3311eurPcCX), [Kế hoạch phát triển](https://claude.ai/artifact/HarDe5qR2isfbLRypcAboS), [Lộ trình N5 → N2](https://claude.ai/artifact/5eT7QNEDrNDnXousnhTbHb); chỉ mở được bằng tài khoản Claude của chủ dự án)

Tài liệu này đọc riêng được: mọi quyết định cần cho nhánh đều nằm ở đây.

## Mục tiêu

Viết script nhập dữ liệu từ các nguồn vào SQLite, chạy thử trên một batch nhỏ có chủ đích, đo chất lượng rồi mới nhập toàn bộ N5–N1.

## Chức năng

- [ ] Script tải và ghi checksum từng nguồn, ghi vào `data_sources`
- [ ] Nhập OpenJLPT (từ, kanji, ngữ pháp, câu ví dụ) giữ nguyên ID
- [ ] Khớp nghĩa tu-dien-nhat-viet: tra theo mặt chữ → cách đọc → **mọi cách viết của JMdict** (363 từ kana-only N5–N2 chỉ có dưới dạng kanji trong từ điển)
- [ ] Xử lý **22 từ cùng chữ khác cách đọc** (方 かた/ほう, 一日, 今日…): không dùng nghĩa từ điển, đánh dấu cần dịch máy theo cách đọc
- [ ] Âm Hán Việt kanji từ KanjiDictVN; **nghĩa kanji dịch từ nghĩa tiếng Anh của OpenJLPT** (KanjiDictVN sai nghĩa với kanji Nhật tự tạo, ví dụ 働)
- [ ] Ghép âm Hán Việt cho từ đọc âm On (勉強 → MIỄN CƯỜNG); từ đọc Kun để trống
- [ ] Dịch máy phần còn thiếu một lần, lưu lại, kèm cách đọc + Hán Việt + câu ví dụ làm ngữ cảnh
- [ ] Chuẩn hoá NFC mọi chữ Việt; còn bản ghi không phải NFC thì dừng và báo lỗi
- [ ] Chạy lại import (giả lập cập nhật tháng sau) không mất bản dịch, tiến độ SRS

## Dữ liệu

**Batch thử (chọn có chủ đích, không ngẫu nhiên):**

| Loại | Số lượng | Trường hợp phải có |
| --- | --- | --- |
| Từ | 100 (80 N5 + 20 N2) | Nhiều cách đọc, chỉ kana, katakana, động từ する, cùng chữ khác nghĩa, không có câu ví dụ, nhiều cách viết |
| Kanji | 50 | Nhiều âm On/Kun, kanji Nhật tự tạo (働), thiếu `kVietnamese`, có biến thể KanjiVG |
| Ngữ pháp | 20 | Mẫu ngắn và dài, cặp dễ nhầm, nhiều công thức nối |
| Clip shadowing | 3 | 1 Erin, 1 file phim cá nhân, 1 YouTube |

## Quy tắc và ràng buộc

- Script chạy lại được nhiều lần (idempotent).
- Dữ liệu nguồn và database tải về **không commit vào repo** (thêm vào `.gitignore`).

## Không làm trong nhánh này

- Giao diện hoàn chỉnh; chỉ cần giao diện thô để xem batch thử.

## Tiêu chí hoàn thành

- [ ] 100% từ có cách đọc, nghĩa, cấp JLPT
- [ ] Mọi kanji có animation nét
- [ ] Popup tra từ ra kết quả cho mọi từ trong câu ví dụ
- [ ] Chạy lại import không làm mất bản dịch và tiến độ SRS
- [ ] 3 clip shadowing chạy được với phụ đề chia câu
- [ ] 100% kanji có âm Hán Việt; mọi từ và mẫu ngữ pháp có nghĩa tiếng Việt
- [ ] 100% chữ tiếng Việt ở dạng NFC và hiển thị đúng dấu trên Chrome Android, Safari iOS

## Câu hỏi còn mở

- Chọn mô hình AI và ngân sách cho dịch máy.
- Đo tỉ lệ câu ví dụ có sẵn bản tiếng Việt trên Tatoeba.
- Độ phủ giải thích ngữ pháp IRODORI tiếng Việt (chờ file).

## Bối cảnh chung (tóm tắt)

- Web học tiếng Nhật **cho riêng một người dùng**, miễn phí, không kinh doanh, **không công khai** (bắt buộc đăng nhập mọi trang).
- Chạy trên VPS nhỏ hoặc máy nhà + Tailscale; dùng chủ yếu trên điện thoại dưới dạng PWA.
- Lộ trình N5 → N2: 87 tuần, bắt đầu 02/11/2026; thi N4 04/07/2027 (tuỳ chọn), N3 05/12/2027, N2 02/07/2028.
- Nhịp ngày đi làm: **ban ngày 5–10 phút Ôn nhanh** (chỉ thẻ từ vựng + kanji, không âm thanh); **buổi tối 45–60 phút** cho bài mới, ngữ pháp, dạng đề JLPT, shadowing.
- Bắt buộc **2 buổi shadowing/tuần** (Thứ Ba, Thứ Năm; Thứ Bảy khuyến khích). Thiếu buổi → khoá bài mới tuần sau; **ôn tập SRS không bao giờ bị khoá**.
- Người dùng là người học, **không biên tập nội dung**: tiếng Việt lấy từ nguồn có sẵn, phần thiếu dùng dịch máy (luôn kèm bản tiếng Anh và nút Báo sai).
