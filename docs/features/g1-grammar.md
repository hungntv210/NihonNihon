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

- [x] Trang mẫu câu: tên mẫu, nghĩa tiếng Việt, cấp
- [x] Công thức nối dạng khối màu (V-て + いく) (xác minh 21/11: `src/app/(study)/grammar/formula.ts:1-327`, `src/app/(study)/grammar/[id]/page.tsx:75-122`, `src/app/(study)/grammar/grammar.test.ts:202-313`)
- [ ] 2–3 câu ví dụ có furigana, audio, bản dịch; phần mẫu câu được tô màu (DB G0 đóng băng còn 16/1.160 câu ví dụ thiếu furigana)
  - Còn thiếu: trên bản sao DB app chỉ đọc còn 15/1.136 câu ví dụ ngữ pháp thiếu `furigana_notation` và 9/1.136 câu chưa có bản dịch Việt `selected` khớp hash; UI ví dụ có furigana, tô mẫu câu và audio TTS đã có ở `src/app/(study)/grammar/[id]/page.tsx:197-233`.
- [x] Ghi chú phân biệt mẫu dễ nhầm, có link sang mẫu kia (xác minh 22/11: `src/app/(study)/grammar/confusables.ts:1-273`, `src/app/(study)/grammar/repository.ts:154`, `src/app/(study)/grammar/[id]/page.tsx:163-191`, `tests/grammar-confusables.test.ts`, `tests/grammar-ticks.test.ts`; DB G0 đóng băng: 158/403 mẫu có ghi chú dễ nhầm, 202 link sang mẫu còn hoạt động, 0 link hỏng)
- [x] Câu trong clip shadowing có dùng mẫu này (nếu có) (xác minh 22/11: `src/app/(study)/grammar/repository.ts:60-61,148-153`, `src/app/(study)/grammar/[id]/page.tsx:255-270`, `src/app/(study)/shadowing/query.ts:13-33`, `tests/grammar-ticks.test.ts`; sửa lệch 1 câu ở `?segment=` sang 1-based để mở đúng clip & câu, ẩn link khi clip/câu bị tắt hoặc xoá; DB G0 đóng băng có 0/403 mẫu do chưa nạp clip riêng)
- [x] Bài tập **chọn đáp án** (dạng 文法 JLPT)
- [x] Bài tập **sắp xếp câu ★** (kéo 4 mảnh)
- [x] Bài tập sinh từ câu ví dụ OpenJLPT

## Dữ liệu

- OpenJLPT grammar (pattern, meaning, formation, examples, notes); IRODORI tiếng Việt cho sơ cấp nếu có, còn lại dịch máy kèm tiếng Anh.

## Quy tắc và ràng buộc

- Giải thích tiếng Việt luôn kèm bản tiếng Anh gốc.

## Không làm trong nhánh này

- Bài tập chia dạng, phân biệt cặp, thẻ SRS ngữ pháp (`g2/grammar-advanced`).

## Tiêu chí hoàn thành

- [x] 403 mẫu N5–N2 có trang đầy đủ (xác minh 21/11: 403/403 trên DB G0 đóng băng, `src/app/(study)/grammar/grammar.test.ts:63-75`)
- [ ] Mỗi mẫu có ít nhất 3 câu bài tập mỗi dạng
  - Còn thiếu: trên bản sao DB app chỉ đọc có 57/403 mẫu ngữ pháp N5–N2 chưa đủ 3 câu ví dụ (346/403 có ≥3 câu), và bộ sinh bài tập ở `src/app/(study)/grammar/practice.ts:31-91` còn lọc theo `focusOf` và câu ≥4 mảnh nên nhiều mẫu chưa đạt ≥3 câu mỗi dạng.

## Câu hỏi còn mở

- Có dùng giải thích IRODORI tiếng Việt hay không (chờ file).

## Bối cảnh chung (tóm tắt)

- Web học tiếng Nhật **cho riêng một người dùng**, miễn phí, không kinh doanh, **không công khai** (bắt buộc đăng nhập mọi trang).
- Chạy trên VPS nhỏ hoặc máy nhà + Tailscale; dùng chủ yếu trên điện thoại dưới dạng PWA.
- Lộ trình N5 → N2: 87 tuần, bắt đầu 02/11/2026; thi N4 04/07/2027 (tuỳ chọn), N3 05/12/2027, N2 02/07/2028.
- Nhịp ngày đi làm: **ban ngày 5–10 phút Ôn nhanh** (chỉ thẻ từ vựng + kanji, không âm thanh); **buổi tối 45–60 phút** cho bài mới, ngữ pháp, dạng đề JLPT, shadowing.
- Bắt buộc **2 buổi shadowing/tuần** (Thứ Ba, Thứ Năm; Thứ Bảy khuyến khích). Thiếu buổi → khoá bài mới tuần sau; **ôn tập SRS không bao giờ bị khoá**.
- Người dùng là người học, **không biên tập nội dung**: tiếng Việt lấy từ nguồn có sẵn, phần thiếu dùng dịch máy (luôn kèm bản tiếng Anh và nút Báo sai).

## Đối chiếu triển khai và bằng chứng — 2026-11-14

Các dấu tick xác nhận phần code đã chạy qua test/fixture; không thay cho nghiệm thu độ phủ dữ liệu hay benchmark thiết bị. Các mục ghép chỉ hoàn thành một phần vẫn để [ ]. Không đổi tiêu chí/luật học.

- Bằng chứng: `src/app/(study)/grammar/grammar.test.ts`.
- Bằng chứng: `src/app/(study)/grammar/browser-check.ts`.
- Bằng chứng (2026-11-22): `tests/grammar-confusables.test.ts` và `tests/grammar-ticks.test.ts` — xác minh ghi chú phân biệt mẫu dễ nhầm (158/403 mẫu trên DB G0 đóng băng, 202 link = 124 chiều đi + 78 chiều đến, 0 link hỏng) và liên kết câu trong clip shadowing (`grammarClipHref` truyền `?segment=` 1-based khớp `resolveShadowingSelection`, không phát link khi clip/câu bị tắt hoặc đã xoá; DB G0 đóng băng có 0/403 mẫu vì chưa nạp clip riêng).

Cloze và sắp xếp dùng ví dụ thật/fixture, không bịa câu khi nguồn thiếu. Câu clip chỉ hiện khi đã có liên kết; chưa chứng minh đủ403 mẫu,3bài/mẫu hoặc đủ audio/bản dịch cho mọi ví dụ. Các mục ghép thiếu thành phần vẫn để trống.
