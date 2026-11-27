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
  - Đã có bộ nhập cục bộ offline (`tools/import-irodori.ts`, `src/app/(study)/shadowing/irodori-importer.ts`) đọc thư mục IRODORI do người dùng tự tải về máy (`--dir` hoặc `NIHON_IRODORI_DIR`, mặc định `data/private/irodori`), hỗ trợ ánh xạ theo cấp `A1 → N5`, `A2-1/A2-2/A2 → N4`, `B1 → N3`, chế độ `--dry-run` in thống kê theo cấp, tự bổ sung furigana/tag/tuần lộ trình offline và đủ 7 trường metadata trong kho Shadowing; giữ nguyên chưa tick vì chờ người dùng tự tải tài liệu Japan Foundation IRODORI về máy nhà và chạy nhập dữ liệu thật (không tự tải từ Internet, không commit dữ liệu vào repo).
- [x] Mỗi clip: tiêu đề, nguồn, cấp, chủ đề, tốc độ nói, số câu, % từ đã biết
- [x] Lịch sử luyện, bản ghi tốt nhất

**Công cụ tạo clip** (mục tiêu < 15 phút/clip)
- [x] Tải file lên máy chủ riêng hoặc dán link YouTube
  - Đã có giao diện `+ Tạo clip mới` (tách chunk động) và API `/api/shadowing/clips` (bắt buộc đăng nhập + same-origin): tải file audio/video (MP4, WebM, MP3, M4A, OGG, WAV, tối đa 8 MB, kiểm MIME + magic bytes, tên tệp UUID chống path traversal, lưu riêng tại `data/private/shadowing-media/` kèm SHA-256) hoặc dán link YouTube (chỉ lưu `video_id` 11 ký tự và mốc thời gian, phát qua trình phát nhúng, không tải video).
- [x] Chọn đoạn trên sóng âm; lấy phụ đề có sẵn (.srt/.ass) hoặc Whisper
  - Đã có trình chọn đoạn kéo thả trên sóng âm (tái sử dụng bộ giải mã/tính peak của `#112`) và parser thuần `.srt`/`.ass` kèm xử lý tệp lỗi; máy nhà chưa cài bộ chạy Whisper cục bộ nên nút Whisper được ẩn, không cài thêm dependency nặng và không gửi audio ra dịch vụ ngoài.
- [x] Chia câu tự động, kéo chỉnh mốc thời gian
  - Đã có chia câu tự động từ phụ đề hoặc theo dấu `。！？`, thanh kéo + ô chỉnh mốc `start`/`end` từng câu chống chồng/ngoài biên, nghe thử từng câu và lưu thẳng vào kho Shadowing để luyện ngay.
- [ ] Tự thêm furigana, dịch máy tiếng Việt, gắn tag, gắn vào tuần lộ trình
  - Đã có phần offline trên máy chủ (`/api/shadowing/clips/analyze`, không gọi dịch vụ ngoài): tự sinh furigana theo từng câu bằng `kuromoji` phía server (hỗ trợ chỉnh sửa `{base|reading}` và xem trước `<ruby>` trước khi lưu, hiển thị `<ruby>` trên player và tôn trọng chế độ ẩn furigana), gợi ý cấp độ + tag từ danh mục OpenJLPT nội bộ (thêm/xóa tự do trước khi lưu) và gợi ý tuần lộ trình 87 tuần (`today-roadmap`, cho phép chọn lại/bỏ gắn); còn thiếu: dịch máy tiếng Việt (chờ duyệt gửi ra ngoài).

**Player**
- [x] Danh sách câu, câu đang phát được làm nổi
- [x] Lặp 1/3/5/∞, A–B; tốc độ 0.5×–1.25× giữ cao độ
- [x] Dừng để nói theo (độ dài câu × 1.2)
- [x] Phụ đề 4 chế độ: đầy đủ / tiếng Nhật / kana / ẩn; chạm từ để tra
- [x] Phím tắt máy tính: Space, ← →, R, L

**Ghi âm và so sánh**
- [x] Ghi từng câu hoặc cả clip; nghe gốc / giọng mình / xen kẽ; sóng âm xếp chồng
- [x] Thêm câu vào SRS

**Buổi hợp lệ** (tính vào hạn mức tuần khi đủ cả 4):
- [x] Luyện thực tế ≥ 15 phút
- [x] Ghi âm đủ mọi câu của ít nhất 1 clip
- [x] Mỗi bản ghi ≥ 70% độ dài câu gốc
- [x] Khác ngày với buổi hợp lệ trước đó trong tuần

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
- [x] Đếm buổi hợp lệ đúng 4 điều kiện
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

## Đối chiếu triển khai và bằng chứng — 2026-11-14

Các dấu tick xác nhận phần code đã chạy qua test/fixture; không thay cho nghiệm thu độ phủ dữ liệu hay benchmark thiết bị. Các mục ghép chỉ hoàn thành một phần vẫn để [ ]. Không đổi tiêu chí/luật học.

- Bằng chứng: `src/app/(study)/shadowing/player.tsx`.
- Bằng chứng: `src/app/(study)/shadowing/controls.ts`.
- Bằng chứng: `src/app/(study)/shadowing/practice.test.ts`.
- Bằng chứng: `tests/shadowing-controls.test.ts`.
- Bằng chứng: `src/app/(study)/shadowing/browser-check.ts`.
- Bằng chứng (2026-11-21): `src/app/(study)/common-tools/lookup-popup.tsx`, `tests/lookup-popup.test.ts`.
- Bằng chứng (2026-11-21): `src/app/(study)/shadowing/history-store.ts`, `src/app/api/shadowing/history/handler.ts`, `src/core/backup.ts`, `tests/shadowing-history.test.ts` (lịch sử luyện theo từng clip xếp mới nhất lên trên, ghim/bỏ ghim bản ghi tốt nhất thủ công không chấm điểm AI, nghe lại qua `/api/shadowing/history`, lưu riêng ngoài repo, bản ghi ghim không bị dọn theo lịch và nằm trong sao lưu/khôi phục).
- Bằng chứng (2026-11-22): `src/app/(study)/shadowing/clip-meta.ts`, `src/app/(study)/shadowing/clip-meta-server.ts`, `src/app/(study)/shadowing/library.tsx`, `src/app/(study)/shadowing/page.tsx`, `src/app/(study)/shadowing/shadowing.module.css`, `tests/clip-meta.test.ts` (mỗi thẻ clip trong kho hiển thị đủ 7 trường: tiêu đề, nguồn, cấp, chủ đề, số câu = số dòng phụ đề, tốc độ nói = tổng ký tự nói chuẩn NFC không tính dấu câu/khoảng trắng chia tổng thời lượng nói `Σ(end - start)` tính bằng `ký tự/s`, và `% từ đã biết` = tỷ lệ từ duy nhất trong clip khớp thẻ SRS/sổ từ đang hoạt động của người dùng, trả `—` khi chưa có thẻ).
- Bằng chứng (2026-11-26): `src/app/(study)/shadowing/clip-maker-model.ts`, `src/app/(study)/shadowing/clip-maker-store.ts`, `src/app/(study)/shadowing/clip-maker.tsx`, `src/app/(study)/shadowing/clips.ts`, `src/app/(study)/shadowing/library.tsx`, `src/app/(study)/shadowing/page.tsx`, `src/app/api/shadowing/clips/handler.ts`, `src/app/api/shadowing/clips/route.ts`, `tests/shadowing-clip-maker.test.ts`, `src/app/(study)/shadowing/browser-check.ts` (công cụ tạo clip shadowing tách chunk động: tải tệp audio/video tối đa 8 MB kiểm MIME + magic bytes + chống path traversal + lưu riêng tư ngoài repo có SHA-256, dán link YouTube chỉ lưu ID + mốc và phát nhúng không tải video, chọn đoạn trên sóng âm, parser thuần `.srt`/`.ass` kèm xử lý tệp lỗi, chia câu tự động `。！？`, kéo chỉnh mốc `start`/`end` không chồng và nằm trong độ dài clip, nghe thử từng câu và lưu phát ngay trên `/shadowing`; máy không có Whisper cục bộ nên ẩn nút).
- Bằng chứng (2026-11-26): `src/app/(study)/shadowing/auto-meta-model.ts`, `src/app/(study)/shadowing/auto-meta-server.ts`, `src/app/api/shadowing/clips/analyze/handler.ts`, `src/app/api/shadowing/clips/analyze/route.ts`, `src/app/(study)/shadowing/clip-maker-model.ts`, `src/app/(study)/shadowing/clip-maker-store.ts`, `src/app/(study)/shadowing/clip-maker.tsx`, `src/app/(study)/shadowing/player.tsx`, `src/app/(study)/shadowing/library.tsx`, `src/app/(study)/shadowing/page.tsx`, `tests/shadowing-auto-meta.test.ts`, `src/app/(study)/shadowing/browser-check.ts` (phần offline mục `:30`: tự thêm furigana bằng `kuromoji` chỉ chạy phía server không đưa vào bundle client, cho sửa `{base|reading}` + xem trước `<ruby>` và hiển thị `<ruby>` trên player kèm tra từ tại chỗ; gợi ý cấp độ + tag từ danh mục OpenJLPT nội bộ `source_id='openjlpt'` cho thêm/xóa trước khi lưu; gợi ý tuần lộ trình 87 tuần qua `allocateRoadmap` cho chọn lại/bỏ gắn; không gọi dịch vụ ngoài; giữ nguyên chưa tick do còn thiếu: dịch máy tiếng Việt (chờ duyệt gửi ra ngoài)).
- Bằng chứng (2026-11-27): `src/app/(study)/shadowing/irodori-importer.ts`, `src/app/(study)/shadowing/clip-maker-store.ts`, `src/app/(study)/shadowing/page.tsx`, `src/app/(study)/shadowing/README.md`, `tools/import-irodori.ts`, `tests/shadowing-irodori.test.ts` (bộ nhập cục bộ offline cho tài liệu Japan Foundation IRODORI theo cấp `A1 → N5`, `A2-1/A2-2/A2 → N4`, `B1 → N3`: hỗ trợ cấu trúc thư mục lẫn `manifest.json`, phụ đề `.srt`/`.vtt`/`.ass`/`.txt`/`.json`, chế độ `--dry-run` in số lượng theo từng cấp không ghi đĩa, nhập idempotent có kiểm magic bytes/SHA-256/chống path traversal + symlink, tự bổ sung furigana/tag/tuần lộ trình offline, hiển thị đủ 7 trường metadata trong kho Shadowing, không gọi mạng và không commit dữ liệu IRODORI; giữ nguyên chưa tick mục `:21` vì chờ người dùng tự tải bộ IRODORI về máy nhà và nhập dữ liệu thật).

Bốn điều kiện giữ nguyên. API progress lưu metadata theo hash phiên đăng nhập/ngày trong roadmap JSON với khóa nguyên tử; không nhận audio. Bộ đếm chỉ nhận tab hiện, phát có tiến triển hoặc ghi âm; server chặn cộng thời gian song song/replay bằng đồng hồ server. Cùng ngày (kể cả đã ghi tay) không thêm buổi tự động. Ghi tay vẫn dự phòng. Đã bổ sung tốc độ phát 1.2× cùng chế độ dừng để nói theo (độ dài câu × 1.2), phím tắt máy tính (`Space`, `←`, `→`, `R`, `L` có chặn vùng nhập liệu), nút thêm câu vào SRS dùng lại `/api/review/cards` + `enqueueCard()` (không tạo thẻ trùng, không đổi schema), deep-link `?clip=<id>&segment=<n>`, chạm từ trên phụ đề (chế độ đầy đủ / tiếng Nhật / kana, tách từ `kuromoji` phía server) để mở popup tra từ tại chỗ + Thêm vào ôn kèm câu gốc, 7 trường metadata trên mỗi thẻ clip trong kho shadowing (số câu, tốc độ nói theo `ký tự/s`, `% từ đã biết` hiển thị `—` khi 0 thẻ), ghi âm cả clip + phát xen kẽ + sóng âm xếp chồng, công cụ tạo clip shadowing (tải file riêng tư/dán link YouTube, chọn đoạn trên sóng âm, nhập `.srt`/`.ass`, chia câu `。！？`, chỉnh mốc và nghe thử từng câu; nút Whisper ẩn do máy chưa cài Whisper cục bộ), phần offline tự thêm furigana + gợi ý tag + gợi ý tuần lộ trình 87 tuần và công cụ nhập cục bộ IRODORI theo cấp kèm `--dry-run` + hướng dẫn tải dữ liệu. Mục `:21` (IRODORI chờ dữ liệu thật trên máy nhà) và mục `:30` (còn thiếu: dịch máy tiếng Việt (chờ duyệt gửi ra ngoài)) cùng clip file cá nhân nghiệm thu vẫn giữ trống.
