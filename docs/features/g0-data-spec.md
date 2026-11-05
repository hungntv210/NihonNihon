# Đặc tả nguồn dữ liệu (Data Source Specification)

- **Nhánh:** `g0/data-spec`
- **Giai đoạn:** Giai đoạn 0 – Nền dữ liệu (làm ngay)
- **Phụ thuộc:** không có; mọi nhánh khác dựa vào nhánh này
- **Tài liệu gốc:** Kế hoạch phát triển mục 4, Đặc tả v2 mục 14 (trên Claude: [Đặc tả chức năng v2](https://claude.ai/artifact/4ApVpJNZA9s3311eurPcCX), [Kế hoạch phát triển](https://claude.ai/artifact/HarDe5qR2isfbLRypcAboS), [Lộ trình N5 → N2](https://claude.ai/artifact/5eT7QNEDrNDnXousnhTbHb); chỉ mở được bằng tài khoản Claude của chủ dự án)

Tài liệu này đọc riêng được: mọi quyết định cần cho nhánh đều nằm ở đây.

## Mốc triển khai hiện tại — bản nháp 05/11/2026

Theo yêu cầu hiện tại: **hoàn thành khi có đủ 5 phần tài liệu và có bản nháp schema**.
Mốc này đã đạt tại [đặc tả 5 phần](../data/data-source-spec.md) và
[SQLite schema Draft 0.1](../data/schema.draft.sql). Khảo sát 15 file OpenJLPT thật
được lưu bằng metadata/counts/checksum ở [source-audit.json](../data/source-audit.json).
Không đưa dữ liệu raw hay dữ liệu riêng tư vào Git.

Kiểm tra: Node 24 có `node:sqlite`, chạy `node --test tests/data/schema.test.cjs`
(9 bài); không cài thêm thư viện. Kiểm thử dùng fixture tự tạo trong database bộ nhớ,
không phải batch nhập thật của nhánh `g0/data-import`.

Các tiêu chí ban đầu về batch thử/chốt schema bên dưới vẫn là mốc sau; không đánh
dấu Frozen khi chưa có báo cáo batch. Nguồn chưa tải được ghi Planned/Unverified,
đặc biệt không giả định CVDICT có artifact hợp lệ hay KanjiDictVN được phép phát hành lại.

## Mục tiêu

Chốt cấu trúc database dựa trên **dữ liệu thật** của các nguồn trước khi viết code giao diện, để không phải sửa database về sau.

## Chức năng

Tài liệu `docs/data/data-source-spec.md` gồm 5 phần:

- [x] **Danh mục nguồn:** tên, URL, định dạng, giấy phép, phiên bản, phạm vi của từng nguồn (ghi rõ nguồn chưa pin/tải)
- [x] **Map trường:** từng trường nguồn → cột database, quy tắc chuyển đổi (adapter nguồn chưa tải có điều kiện khảo sát trước import)
- [x] **Schema:** bảng, khoá chính, khoá ngoại, quan hệ; bảng `data_sources` — bản nháp
- [x] **Quy trình import:** tải, làm sạch, chuẩn hoá NFC, loại trùng, kiểm tra, cập nhật hằng tháng
- [x] **Lớp nội dung tiếng Việt:** bảng dịch riêng, ghi nguồn từng bản dịch (từ điển / Hán Việt / Tatoeba / dịch máy), giữ bản dịch khi nguồn cập nhật

Thứ tự làm: tải dữ liệu thật → nháp phần 1–3 → batch thử (nhánh `g0/data-import`) → sửa schema → chốt phần 3–5.

## Dữ liệu

| Nội dung | Nguồn | Giấy phép | Ghi chú |
| --- | --- | --- | --- |
| Từ, kanji, ngữ pháp, cấp N5–N1, câu ví dụ | [OpenJLPT](https://github.com/evanclan/OpenJLPT) | CC BY-SA 4.0 | 4.741 từ, 1.038 kanji, 403 mẫu ở N5–N2; ID cố định |
| Tra từ, furigana, bộ thủ | JMdict, JmdictFurigana, KRADFILE (EDRDG) | CC BY-SA 4.0 | Dùng đúng bản JMdict ghi trong `meta.json` của OpenJLPT |
| Nét viết | KanjiVG | CC BY-SA 3.0 | |
| Âm Hán Việt kanji | [KanjiDictVN](https://github.com/trungnt2910/KanjiDictVN) | Code MIT; dữ liệu © hvdic.thivien.net | Phủ 100% N5–N2; **chỉ dùng cá nhân** |
| Nghĩa tiếng Việt của từ | [tu-dien-nhat-viet](https://github.com/bunchaway/tu-dien-nhat-viet) | CC BY-SA 4.0 | 360.083 mục, 2 cột (từ, nghĩa), không có cách đọc |
| Câu ví dụ tiếng Việt | Tatoeba | CC BY 2.0 FR | Khi có bản tiếng Việt |
| Đối chiếu Hán Việt | Unihan `kVietnamese`, CVDICT | Unicode / CC BY-SA 4.0 | Dự phòng |
| Audio | Kanji Alive (CC BY 4.0), TTS | | |

## Quy tắc và ràng buộc

- Bảng `data_sources`: `source_id, name, url, license, version, imported_at, checksum, attribution`.
- Mỗi bản ghi có `source_id`; bản ghi gộp nhiều nguồn có thêm cột `field_sources` (JSON).
- Dữ liệu gốc và bản dịch tiếng Việt ở **hai bảng riêng**; cập nhật nguồn không ghi đè bản dịch.
- Thẻ SRS khoá theo **ID của OpenJLPT** để không mất tiến độ khi cập nhật.
- Mọi chữ tiếng Việt chuẩn hoá **NFC** (KanjiDictVN có 52/10.383 mục ở dạng tổ hợp).
- Không đưa dữ liệu KanjiDictVN, video, bản ghi âm vào repo công khai.

## Không làm trong nhánh này

- Code import (nhánh `g0/data-import`), giao diện.

## Tiêu chí hoàn thành

- [x] Đủ 5 phần, mỗi bảng có khoá và quan hệ rõ ràng (Draft 0.1)
- [ ] Mỗi nguồn ghi đủ giấy phép, phiên bản, cách ghi công
- [ ] Schema đã được sửa theo kết quả batch thử và được chốt

## Câu hỏi còn mở

- Chọn công cụ ORM: Drizzle hay Prisma.
- Draft chọn giữ tập JMdict liên quan trước; chưa dựng full dictionary. Đánh giá lại theo bộ đo batch và nhu cầu tra cứu.

## Bối cảnh chung (tóm tắt)

- Web học tiếng Nhật **cho riêng một người dùng**, miễn phí, không kinh doanh, **không công khai** (bắt buộc đăng nhập mọi trang).
- Chạy trên VPS nhỏ hoặc máy nhà + Tailscale; dùng chủ yếu trên điện thoại dưới dạng PWA.
- Lộ trình N5 → N2: 87 tuần, bắt đầu 02/11/2026; thi N4 04/07/2027 (tuỳ chọn), N3 05/12/2027, N2 02/07/2028.
- Nhịp ngày đi làm: **ban ngày 5–10 phút Ôn nhanh** (chỉ thẻ từ vựng + kanji, không âm thanh); **buổi tối 45–60 phút** cho bài mới, ngữ pháp, dạng đề JLPT, shadowing.
- Bắt buộc **2 buổi shadowing/tuần** (Thứ Ba, Thứ Năm; Thứ Bảy khuyến khích). Thiếu buổi → khoá bài mới tuần sau; **ôn tập SRS không bao giờ bị khoá**.
- Người dùng là người học, **không biên tập nội dung**: tiếng Việt lấy từ nguồn có sẵn, phần thiếu dùng dịch máy (luôn kèm bản tiếng Anh và nút Báo sai).
