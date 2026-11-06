# Ngữ pháp cơ bản (trang mẫu câu + bài tập buổi tối)

- **Nhánh:** `g1/grammar`
- **Giai đoạn:** Giai đoạn 1 – MVP (càng sớm càng tốt)
- **Phụ thuộc:** `g1/foundation`, `g0/data-import`
- **Tài liệu gốc:** Đặc tả v2 mục 8 (trên Claude: [Đặc tả chức năng v2](https://claude.ai/artifact/4ApVpJNZA9s3311eurPcCX), [Kế hoạch phát triển](https://claude.ai/artifact/HarDe5qR2isfbLRypcAboS), [Lộ trình N5 → N2](https://claude.ai/artifact/5eT7QNEDrNDnXousnhTbHb); chỉ mở được bằng tài khoản Claude của chủ dự án)
- **Giao diện:** theo [thiết kế giao diện học tập](../interface-redesign.md) (`docs/interface-redesign.md`) và prototype `prototype/` hiện hành.

Tài liệu này đọc riêng được: mọi quyết định cần cho nhánh đều nằm ở đây.

## Mục tiêu

Mỗi tối học 1–2 mẫu ngữ pháp và làm bài tập ngay; 403 mẫu N5–N2 từ OpenJLPT.

## Chức năng

- [ ] Trang mẫu câu: tên mẫu, nghĩa tiếng Việt, cấp
- [ ] Công thức nối dạng khối màu (V-て + いく)
- [ ] 2–3 câu ví dụ có furigana, audio, bản dịch; phần mẫu câu được tô màu
- [ ] Ghi chú phân biệt mẫu dễ nhầm, có link sang mẫu kia
- [ ] Câu trong clip shadowing có dùng mẫu này (nếu có)
- [ ] Bài tập **chọn đáp án** (dạng 文法 JLPT)
- [ ] Bài tập **sắp xếp câu ★** (kéo 4 mảnh)
- [ ] Bài tập sinh từ câu ví dụ OpenJLPT

## Dữ liệu

- OpenJLPT grammar (pattern, meaning, formation, examples, notes); IRODORI tiếng Việt cho sơ cấp nếu có, còn lại dịch máy kèm tiếng Anh.

## Quy tắc và ràng buộc

- Giải thích tiếng Việt luôn kèm bản tiếng Anh gốc.

## Không làm trong nhánh này

- Bài tập chia dạng, phân biệt cặp, thẻ SRS ngữ pháp (`g2/grammar-advanced`).

## Tiêu chí hoàn thành

- [ ] 403 mẫu N5–N2 có trang đầy đủ
- [ ] Mỗi mẫu có ít nhất 3 câu bài tập mỗi dạng

## Câu hỏi còn mở

- Có dùng giải thích IRODORI tiếng Việt hay không (chờ file).

## Bối cảnh chung (tóm tắt)

- Web học tiếng Nhật **cho riêng một người dùng**, miễn phí, không kinh doanh, **không công khai** (bắt buộc đăng nhập mọi trang).
- Chạy trên VPS nhỏ hoặc máy nhà + Tailscale; dùng chủ yếu trên điện thoại dưới dạng PWA.
- Lộ trình N5 → N2: 87 tuần, bắt đầu 02/11/2026; thi N4 04/07/2027 (tuỳ chọn), N3 05/12/2027, N2 02/07/2028.
- Nhịp ngày đi làm: **ban ngày 5–10 phút Ôn nhanh** (chỉ thẻ từ vựng + kanji, không âm thanh); **buổi tối 45–60 phút** cho bài mới, ngữ pháp, dạng đề JLPT, shadowing.
- Bắt buộc **2 buổi shadowing/tuần** (Thứ Ba, Thứ Năm; Thứ Bảy khuyến khích). Thiếu buổi → khoá bài mới tuần sau; **ôn tập SRS không bao giờ bị khoá**.
- Người dùng là người học, **không biên tập nội dung**: tiếng Việt lấy từ nguồn có sẵn, phần thiếu dùng dịch máy (luôn kèm bản tiếng Anh và nút Báo sai).
