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
- [ ] Dòng phụ "nghĩa Hán Việt gốc" từ KanjiDictVN
- [ ] On/Kun có audio, số nét, cấp JLPT, cấu tạo và bộ thủ (chạm xem chữ cùng bộ)
- [x] Animation thứ tự nét (KanjiVG), phát lại từng nét
- [x] Từ chứa chữ: ưu tiên từ đã học, cùng cấp
- [x] Ô mẹo nhớ tự viết (tuỳ chọn)
- [ ] Bài học kanji mới buổi tối: kanji → từ đi kèm → vào hàng ôn
- [x] Tra kanji theo chữ, Hán Việt, On/Kun, nghĩa Việt, bộ thủ (chọn nhiều bộ), số nét

## Dữ liệu

- OpenJLPT (kanji, từ liên quan), KanjiDictVN (Hán Việt), KanjiVG, KRADFILE.

## Quy tắc và ràng buộc

- **Nghĩa kanji không lấy từ KanjiDictVN** (sai với kanji Nhật tự tạo); dịch từ nghĩa tiếng Anh của OpenJLPT, nhãn "dịch máy" kèm dòng tiếng Anh.
- Chữ học dùng font chữ Nhật thường, không dùng font pixel.

## Không làm trong nhánh này

- Tập viết có chấm nét (`g2/kanji-writing`).

## Tiêu chí hoàn thành

- [ ] 1.038 kanji N5–N2 đều có Hán Việt, nghĩa Việt, On/Kun, animation nét
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

Tick chức năng hiển thị/tra cứu/nét theo source và test fixture; không suy ra đủ1.038 chữ, nguyên nghĩa từ điển Hán Việt hoặc hiệu năng thiết bị thật. Memo chỉ lưu thiết bị. On/Kun/audio/bộ thủ là mục ghép, chưa đánh dấu trọn khi chưa đủ chứng cứ.
