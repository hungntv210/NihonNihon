# Kanji

- **Nhánh:** `g1/kanji`
- **Giai đoạn:** Giai đoạn 1 – MVP (càng sớm càng tốt)
- **Phụ thuộc:** `g1/foundation`, `g0/data-import`
- **Tài liệu gốc:** Đặc tả v2 mục 6, 14.2 (trên Claude: [Đặc tả chức năng v2](https://claude.ai/artifact/4ApVpJNZA9s3311eurPcCX), [Kế hoạch phát triển](https://claude.ai/artifact/HarDe5qR2isfbLRypcAboS), [Lộ trình N5 → N2](https://claude.ai/artifact/5eT7QNEDrNDnXousnhTbHb); chỉ mở được bằng tài khoản Claude của chủ dự án)
- **Giao diện:** theo [thiết kế giao diện học tập](../interface-redesign.md) (`docs/interface-redesign.md`) và prototype `prototype/` hiện hành.

Tài liệu này đọc riêng được: mọi quyết định cần cho nhánh đều nằm ở đây.

## Mục tiêu

Học 1.038 kanji N5–N2 qua âm Hán Việt và luôn đi kèm 2–3 từ dùng ngay.

## Chức năng

- [x] Thẻ chi tiết: chữ lớn, **âm Hán Việt in đậm** (働 – ĐỘNG), nghĩa tiếng Việt theo cách dùng tiếng Nhật (働 = làm việc)
- [x] Dòng phụ "nghĩa Hán Việt gốc" từ KanjiDictVN (xác minh 25/11: UI PR #104 + 993/1.038 chữ có nghĩa gốc dạng candidate, 45 chữ rỗng ẩn sạch)
- [x] On/Kun có audio, số nét, cấp JLPT, cấu tạo và bộ thủ (chạm xem chữ cùng bộ) (xác minh 21/11: `src/app/(study)/kanji/repository.test.ts:70-86,122-146`, `src/app/(study)/kanji/reading-tools.tsx:33-65`)
- [x] Animation thứ tự nét (KanjiVG), phát lại từng nét
- [x] Từ chứa chữ: ưu tiên từ đã học, cùng cấp
- [x] Ô mẹo nhớ tự viết (tuỳ chọn)
- [x] Bài học kanji mới buổi tối: kanji → từ đi kèm → vào hàng ôn
- [x] Tra kanji theo chữ, Hán Việt, On/Kun, nghĩa Việt, bộ thủ (chọn nhiều bộ), số nét

## Dữ liệu

- OpenJLPT (kanji, từ liên quan), KanjiDictVN (Hán Việt), KanjiVG, KRADFILE.

## Quy tắc và ràng buộc

- **Nghĩa kanji không lấy từ KanjiDictVN** (sai với kanji Nhật tự tạo); dịch từ nghĩa tiếng Anh của OpenJLPT, nhãn "dịch máy" kèm dòng tiếng Anh.
- Chữ học dùng font chữ Nhật thường, không dùng font pixel.

## Không làm trong nhánh này

- Tập viết có chấm nét (`g2/kanji-writing`).

## Tiêu chí hoàn thành

- [x] 1.038 kanji N5–N2 có nghĩa Việt, cách đọc Nhật và dữ liệu animation nét. Âm Hán Việt đạt 1.037/1.038 với một ngoại lệ đã duyệt.
  - Ngoại lệ `畑` do anh duyệt 27/11/2026: “quốc tự Nhật, không có âm Hán Việt chuẩn”. [Kanjipedia](https://www.kanjipedia.jp/kanji/0005671000/) ghi cách đọc Kun はた・はたけ. [Từ điển Hán Nôm](https://hvdic.thivien.net/wpy/%E7%95%91) ghi các âm Nôm và Quan thoại. Bản sao DB app có đủ nghĩa Việt, nét viết và ít nhất một cách đọc Nhật cho cả 1.038 chữ.
- [ ] Animation chạy mượt trên điện thoại tầm trung

## Câu hỏi còn mở

- Có hiển thị cả nghĩa CVDICT không, hay chỉ KanjiDictVN làm dòng phụ.

## Bối cảnh chung (tóm tắt)

- Web học tiếng Nhật **cho riêng một người dùng**, miễn phí, không kinh doanh, **không công khai** (bắt buộc đăng nhập mọi trang).
- Chạy trên VPS nhỏ hoặc máy nhà + Tailscale; dùng chủ yếu trên điện thoại dưới dạng PWA.
- Lộ trình N5 → N2: 87 tuần, bắt đầu 02/11/2026; thi N4 04/07/2027 (tuỳ chọn), N3 05/12/2027, N2 02/07/2028.
- Nhịp ngày đi làm: **ban ngày 5–10 phút Ôn nhanh** (chỉ thẻ từ vựng + kanji, không âm thanh); **buổi tối 45–60 phút** cho bài mới, ngữ pháp, dạng đề JLPT, shadowing.
- Bắt buộc **2 buổi shadowing/tuần** (Thứ Ba, Thứ Năm; Thứ Bảy khuyến khích). Thiếu buổi → khoá bài mới tuần sau; **ôn tập SRS không bao giờ bị khoá**.
- Người dùng là người học, **không biên tập nội dung**: tiếng Việt lấy từ nguồn có sẵn, phần thiếu dùng dịch máy (luôn kèm bản tiếng Anh và nút Báo sai).

## Đối chiếu triển khai và bằng chứng — 2026-11-14

Các dấu tick xác nhận phần code đã chạy qua test/fixture; không thay cho nghiệm thu độ phủ dữ liệu hay benchmark thiết bị. Các mục ghép chỉ hoàn thành một phần vẫn để [ ]. Không đổi tiêu chí/luật học.

- Bằng chứng: `src/app/(study)/kanji/repository.test.ts`.
- Bằng chứng: `src/app/(study)/kanji/browser-check.ts`.
- Ghi nhận (2026-11-22, PR #104 — giữ `[ ]` chờ dữ liệu): `src/app/(study)/kanji/repository.ts` (`kanjiDictVnOriginalMeaning`), `src/app/(study)/kanji/[character]/page.tsx`, `src/app/(study)/kanji/kanji.module.css`, `src/app/(study)/vocab/lesson/kanji/model.ts`, `src/app/(study)/vocab/lesson/kanji/card-body.tsx`, `tests/kanji-hanviet-goc.test.ts` (UI và unit test đã sẵn sàng cho dòng phụ `Hán Việt gốc:` từ `vi_translations` với `source_id='kanjidictvn'` và `field='meaning'`, ưu tiên `status='selected'` rồi `candidate` đầu theo `translation_id`, giữ nguyên dòng Hán Việt chính và nghĩa tiếng Nhật, gắn nút Báo sai `ReportViButton`, ẩn hoàn toàn khi thiếu dữ liệu; chưa tick vì DB production kiểm ngày 22/11 hiện chỉ có `han_viet`, `0` dòng `meaning`).
- Cập nhật (2026-11-25, PR #104 — đã tick `[x]`): đã nhập `993/1.038` dòng `vi_translations` (`field='meaning'`, `source_id='kanjidictvn'`, `status='candidate'`, không đổi dòng `selected`) vào DB app máy nhà; `45` chữ có `row[4]` rỗng ẩn sạch không tạo khung rỗng.

Tick chức năng hiển thị/tra cứu/nét theo source và test fixture; không suy ra đủ 1.038 chữ, độ phủ dòng `meaning` của KanjiDictVN trong DB G0 hay hiệu năng thiết bị thật. Memo chỉ lưu thiết bị. On/Kun/audio/bộ thủ là mục ghép, chưa đánh dấu trọn khi chưa đủ chứng cứ.
