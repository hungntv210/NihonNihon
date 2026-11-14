# Từ vựng

- **Nhánh:** `g1/vocab`
- **Giai đoạn:** Giai đoạn 1 – MVP (càng sớm càng tốt)
- **Phụ thuộc:** `g1/foundation`, `g0/data-import`
- **Tài liệu gốc:** Đặc tả v2 mục 7, 14.2 (trên Claude: [Đặc tả chức năng v2](https://claude.ai/artifact/4ApVpJNZA9s3311eurPcCX), [Kế hoạch phát triển](https://claude.ai/artifact/HarDe5qR2isfbLRypcAboS), [Lộ trình N5 → N2](https://claude.ai/artifact/5eT7QNEDrNDnXousnhTbHb); chỉ mở được bằng tài khoản Claude của chủ dự án)
- **Giao diện:** theo [thiết kế giao diện học tập](../interface-redesign.md) (`docs/interface-redesign.md`) và prototype `prototype/` hiện hành.

Tài liệu này đọc riêng được: mọi quyết định cần cho nhánh đều nằm ở đây.

## Mục tiêu

Học 4.741 từ N5–N2 theo thứ tự lộ trình, nghĩa tiếng Việt từ tu-dien-nhat-viet.

## Chức năng

- [ ] Thẻ từ: từ + furigana, âm Hán Việt (chỉ từ đọc On), từ loại, cấp
- [x] Nghĩa tiếng Việt (nhãn "từ điển"), dòng tiếng Anh OpenJLPT thu gọn, chạm để mở
- [x] Audio (TTS hoặc Kanji Alive)
- [ ] 1–2 câu ví dụ có furigana, audio, bản dịch (Tatoeba tiếng Việt nếu có, còn lại dịch máy kèm tiếng Anh)
- [x] Liên kết sang từng kanji cấu thành
- [x] **Từ cùng chữ khác cách đọc** (22 từ, ví dụ 方 かた/ほう): nghĩa dịch máy theo đúng cách đọc + cảnh báo "còn cách đọc khác"
- [ ] Bài học từ mới buổi tối; nghe audio, đọc to câu ví dụ
- [ ] Sổ từ cá nhân: từ thêm từ Reader, phụ đề, tra cứu, đề thi kèm câu gốc và nguồn

## Dữ liệu

- OpenJLPT, tu-dien-nhat-viet, Tatoeba, JMdict (cho từ ngoài JLPT).

## Quy tắc và ràng buộc

- Mọi dòng tiếng Việt có nhãn nguồn và nút Báo sai.

## Không làm trong nhánh này

- Xuất Anki/CSV (Giai đoạn 2), trọng âm (Giai đoạn 3).

## Tiêu chí hoàn thành

- [ ] Mọi từ N5–N2 có nghĩa tiếng Việt và nhãn nguồn đúng
- [ ] 22 từ cùng chữ hiện đúng nghĩa theo cách đọc

## Câu hỏi còn mở

- Chọn dịch vụ TTS tiếng Nhật.

## Bối cảnh chung (tóm tắt)

- Web học tiếng Nhật **cho riêng một người dùng**, miễn phí, không kinh doanh, **không công khai** (bắt buộc đăng nhập mọi trang).
- Chạy trên VPS nhỏ hoặc máy nhà + Tailscale; dùng chủ yếu trên điện thoại dưới dạng PWA.
- Lộ trình N5 → N2: 87 tuần, bắt đầu 02/11/2026; thi N4 04/07/2027 (tuỳ chọn), N3 05/12/2027, N2 02/07/2028.
- Nhịp ngày đi làm: **ban ngày 5–10 phút Ôn nhanh** (chỉ thẻ từ vựng + kanji, không âm thanh); **buổi tối 45–60 phút** cho bài mới, ngữ pháp, dạng đề JLPT, shadowing.
- Bắt buộc **2 buổi shadowing/tuần** (Thứ Ba, Thứ Năm; Thứ Bảy khuyến khích). Thiếu buổi → khoá bài mới tuần sau; **ôn tập SRS không bao giờ bị khoá**.
- Người dùng là người học, **không biên tập nội dung**: tiếng Việt lấy từ nguồn có sẵn, phần thiếu dùng dịch máy (luôn kèm bản tiếng Anh và nút Báo sai).

## Đối chiếu triển khai và bằng chứng — 2026-11-14

Các dấu tick xác nhận phần code đã chạy qua test/fixture; không thay cho nghiệm thu độ phủ dữ liệu hay benchmark thiết bị. Các mục ghép chỉ hoàn thành một phần vẫn để [ ]. Không đổi tiêu chí/luật học.

- Bằng chứng: `src/app/(study)/vocab/data.test.ts`.
- Bằng chứng: `src/app/(study)/vocab/browser-check.ts`.

Audio là speechSynthesis khi thiết bị có giọng Nhật, không cam kết nguồn audio nhập sẵn. Cơ chế từ đồng chữ/khác đọc đã test, chưa xác nhận dữ liệu đủ22từ. Ví dụ/Hán Việt/bài học đã có phần giao diện, nhưng các mục ghép còn thiếu audio/tính năng hoặc đầy đủ dữ liệu nên chưa tick; không tuyên bố phủ N5–N2.
