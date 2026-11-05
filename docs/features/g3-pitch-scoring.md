# Pitch, chấm phát âm, trọng âm, nhập vai

- **Nhánh:** `g3/pitch-scoring`
- **Giai đoạn:** Giai đoạn 3 – Nâng cao (xong trước 17/05/2027, lúc bắt đầu N3)
- **Phụ thuộc:** `g1/shadowing`, `g1/vocab`
- **Tài liệu gốc:** Đặc tả v2 mục 9.4, 7; Kế hoạch mục 7 (trên Claude: [Đặc tả chức năng v2](https://claude.ai/artifact/4ApVpJNZA9s3311eurPcCX), [Kế hoạch phát triển](https://claude.ai/artifact/HarDe5qR2isfbLRypcAboS), [Lộ trình N5 → N2](https://claude.ai/artifact/5eT7QNEDrNDnXousnhTbHb); chỉ mở được bằng tài khoản Claude của chủ dự án)
- **Giao diện:** theo thiết kế 8-bit × bóng đá trong `docs/superpowers/specs/2026-11-01-giao-dien-8bit-bong-da-design.md` và prototype `prototype/` (biểu đồ pitch)

Tài liệu này đọc riêng được: mọi quyết định cần cho nhánh đều nằm ở đây.

## Mục tiêu

Phản hồi phát âm chi tiết, cần nhất khi lên N3 (shadowing trễ một nhịp, tắt phụ đề).

## Chức năng

- [ ] **Đường cao độ** của bản gốc và giọng mình chồng nhau (thuật toán YIN); chỉ với file cá nhân, Erin, IRODORI
- [ ] **Chấm phát âm:** Whisper so với phụ đề, tô đúng/sai từng từ; điểm 0–100 gồm đúng từ, nhịp, ngữ điệu
- [ ] **Trọng âm** (pitch accent) trên thẻ từ
- [ ] **Nhập vai:** tắt tiếng một nhân vật, người học nói phần đó

## Dữ liệu

- **Nguồn trọng âm: chưa chọn.** Cần tìm và kiểm tra giấy phép: phủ phần lớn 4.741 từ N5–N2, khớp được với JMdict (từ + cách đọc), cho dùng cá nhân. Không lấy từ Mazii (dữ liệu cào).

## Quy tắc và ràng buộc

- YouTube nhúng không có pitch.

## Không làm trong nhánh này

- Roleplay AI (`g3/roleplay-ai`).

## Tiêu chí hoàn thành

- [ ] Pitch hiển thị trong < 2 giây sau khi ghi âm một câu

## Câu hỏi còn mở

- Nguồn dữ liệu trọng âm.
- Whisper chạy máy chủ hay API.

## Bối cảnh chung (tóm tắt)

- Web học tiếng Nhật **cho riêng một người dùng**, miễn phí, không kinh doanh, **không công khai** (bắt buộc đăng nhập mọi trang).
- Chạy trên VPS nhỏ hoặc máy nhà + Tailscale; dùng chủ yếu trên điện thoại dưới dạng PWA.
- Lộ trình N5 → N2: 87 tuần, bắt đầu 02/11/2026; thi N4 04/07/2027 (tuỳ chọn), N3 05/12/2027, N2 02/07/2028.
- Nhịp ngày đi làm: **ban ngày 5–10 phút Ôn nhanh** (chỉ thẻ từ vựng + kanji, không âm thanh); **buổi tối 45–60 phút** cho bài mới, ngữ pháp, dạng đề JLPT, shadowing.
- Bắt buộc **2 buổi shadowing/tuần** (Thứ Ba, Thứ Năm; Thứ Bảy khuyến khích). Thiếu buổi → khoá bài mới tuần sau; **ôn tập SRS không bao giờ bị khoá**.
- Người dùng là người học, **không biên tập nội dung**: tiếng Việt lấy từ nguồn có sẵn, phần thiếu dùng dịch máy (luôn kèm bản tiếng Anh và nút Báo sai).
