# Shadowing v1

- **Nhánh:** `g1/shadowing`
- **Giai đoạn:** Giai đoạn 1 – MVP (càng sớm càng tốt)
- **Phụ thuộc:** `g1/foundation`, `g1/srs`
- **Tài liệu gốc:** Đặc tả v2 mục 9; Kế hoạch mục 9 (trên Claude: [Đặc tả chức năng v2](https://claude.ai/artifact/4ApVpJNZA9s3311eurPcCX), [Kế hoạch phát triển](https://claude.ai/artifact/HarDe5qR2isfbLRypcAboS), [Lộ trình N5 → N2](https://claude.ai/artifact/5eT7QNEDrNDnXousnhTbHb); chỉ mở được bằng tài khoản Claude của chủ dự án)
- **Giao diện:** theo [thiết kế giao diện học tập](../interface-redesign.md) (`docs/interface-redesign.md`) và prototype `prototype/` hiện hành.

Tài liệu này đọc riêng được: mọi quyết định cần cho nhánh đều nằm ở đây.

## Mục tiêu

Tính năng chủ lực: luyện nói theo từng câu của đoạn hội thoại thật 10–60 giây, lấy từ video có sẵn.

## Chức năng

**Kho clip**
- [x] Đã có clip Erin – Bài 1: Giới thiệu, N5; tester iPhone đã duyệt.
- [x] Đã có clip YouTube nhúng “Làm quen ở trường đại học”; tester iPhone đã duyệt. Metadata/phụ đề giữ trong data/private, không commit.
- [ ] Còn thiếu clip từ file phim/anime cá nhân để đủ ba nguồn nghiệm thu.
- [ ] Bổ sung IRODORI và mở rộng kho theo cấp.
- [ ] Mỗi clip: tiêu đề, nguồn, cấp, chủ đề, tốc độ nói, số câu, % từ đã biết
- [ ] Lịch sử luyện, bản ghi tốt nhất

**Công cụ tạo clip** (mục tiêu < 15 phút/clip)
- [ ] Tải file lên máy chủ riêng hoặc dán link YouTube
- [ ] Chọn đoạn trên sóng âm; lấy phụ đề có sẵn (.srt/.ass) hoặc Whisper
- [ ] Chia câu tự động, kéo chỉnh mốc thời gian
- [ ] Tự thêm furigana, dịch máy tiếng Việt, gắn tag, gắn vào tuần lộ trình

**Player**
- [ ] Danh sách câu, câu đang phát được làm nổi
- [ ] Lặp 1/3/5/∞, A–B; tốc độ 0.5×–1.25× giữ cao độ
- [ ] Dừng để nói theo (độ dài câu × 1.2)
- [ ] Phụ đề 4 chế độ: đầy đủ / tiếng Nhật / kana / ẩn; chạm từ để tra
- [ ] Phím tắt máy tính: Space, ← →, R, L

**Ghi âm và so sánh**
- [ ] Ghi từng câu hoặc cả clip; nghe gốc / giọng mình / xen kẽ; sóng âm xếp chồng
- [ ] Thêm câu vào SRS

**Buổi hợp lệ** (tính vào hạn mức tuần khi đủ cả 4):
- [ ] Luyện thực tế ≥ 15 phút
- [ ] Ghi âm đủ mọi câu của ít nhất 1 clip
- [ ] Mỗi bản ghi ≥ 70% độ dài câu gốc
- [ ] Khác ngày với buổi hợp lệ trước đó trong tuần

## Dữ liệu

- Video và bản ghi âm lưu trên đĩa máy chủ riêng, **không commit vào repo, không đưa lên dịch vụ công khai**.

## Quy tắc và ràng buộc

- Kỹ thuật mặc định theo cấp: N5 đọc theo, phụ đề kana, 0.75× → N4 có phụ đề, 1× → N3 trễ 1 nhịp → N2 đồng thời, 1–1.25×.
- YouTube nhúng không lấy được tín hiệu âm thanh → không có pitch cho nguồn này.
- Web chỉ dùng cá nhân; video có bản quyền và tài liệu Japan Foundation không được công khai.

## Không làm trong nhánh này

- Pitch, chấm điểm, nhập vai (`g3/pitch-scoring`); gợi ý clip theo % từ đã biết (`g2/study-tools`).

## Tiêu chí hoàn thành

- [ ] Ghi âm chạy trên Chrome Android và Safari iOS
- [ ] Đếm buổi hợp lệ đúng 4 điều kiện
- [x] Có 1 clip Erin; tester iPhone đã duyệt.
- [x] Có 1 clip YouTube; tester iPhone đã duyệt.
- [ ] Còn thiếu 1 clip file cá nhân.

## Câu hỏi còn mở

- Chạy Whisper trên máy chủ hay qua API.

## Bối cảnh chung (tóm tắt)

- Web học tiếng Nhật **cho riêng một người dùng**, miễn phí, không kinh doanh, **không công khai** (bắt buộc đăng nhập mọi trang).
- Chạy trên VPS nhỏ hoặc máy nhà + Tailscale; dùng chủ yếu trên điện thoại dưới dạng PWA.
- Lộ trình N5 → N2: 87 tuần, bắt đầu 02/11/2026; thi N4 04/07/2027 (tuỳ chọn), N3 05/12/2027, N2 02/07/2028.
- Nhịp ngày đi làm: **ban ngày 5–10 phút Ôn nhanh** (chỉ thẻ từ vựng + kanji, không âm thanh); **buổi tối 45–60 phút** cho bài mới, ngữ pháp, dạng đề JLPT, shadowing.
- Bắt buộc **2 buổi shadowing/tuần** (Thứ Ba, Thứ Năm; Thứ Bảy khuyến khích). Thiếu buổi → khoá bài mới tuần sau; **ôn tập SRS không bao giờ bị khoá**.
- Người dùng là người học, **không biên tập nội dung**: tiếng Việt lấy từ nguồn có sẵn, phần thiếu dùng dịch máy (luôn kèm bản tiếng Anh và nút Báo sai).
