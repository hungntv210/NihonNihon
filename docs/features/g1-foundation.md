# Nền tảng: dự án Next.js, đăng nhập, PWA, sao lưu

- **Nhánh:** `g1/foundation`
- **Giai đoạn:** Giai đoạn 1 – MVP (càng sớm càng tốt)
- **Phụ thuộc:** `g0/data-spec`
- **Tài liệu gốc:** Đặc tả v2 mục 13, 14.3; Kế hoạch mục 5.1, 8 (trên Claude: [Đặc tả chức năng v2](https://claude.ai/artifact/4ApVpJNZA9s3311eurPcCX), [Kế hoạch phát triển](https://claude.ai/artifact/HarDe5qR2isfbLRypcAboS), [Lộ trình N5 → N2](https://claude.ai/artifact/5eT7QNEDrNDnXousnhTbHb); chỉ mở được bằng tài khoản Claude của chủ dự án)
- **Giao diện:** theo [thiết kế giao diện học tập](../interface-redesign.md) (`docs/interface-redesign.md`) và prototype `prototype/` hiện hành.

Tài liệu này đọc riêng được: mọi quyết định cần cho nhánh đều nằm ở đây.

## Mục tiêu

Dựng khung ứng dụng mà mọi nhánh Giai đoạn 1 dựa vào: dự án, database, đăng nhập một tài khoản, PWA chạy offline, sao lưu, hiển thị chữ Việt – Nhật chuẩn.

## PR khung đầu tiên

Phạm vi đã thống nhất trước khi chia nhánh: dự án Next.js/React/Tailwind,
lớp đọc DB G0 nguyên schema, bản dịch selected kèm nhãn nguồn/model, đăng nhập
chặn mọi trang nội dung, robots/noindex, khung giao diện + token mới,
`<ViText>`/`<JaText>`, thêm thẻ vào hàng ôn và script kiểm thử.
Mẫu công khai chỉ từ OpenJLPT. Chi tiết API và tiêu chí kiểm thử tại
[`docs/foundation-contracts.md`](../foundation-contracts.md).

PWA/offline, sao lưu, FTS5, cài đặt và triển khai chưa thuộc PR khung này.
Chỉ sau khi khung được kiểm thử và merge mới triển khai đồng thời bốn nhánh
SRS, Từ vựng, Kanji và Ngữ pháp trong thư mục tuyến tương ứng; không sửa schema.

## Chức năng

- [ ] Next.js (React) + Tailwind; SQLite qua `node:sqlite` của Node 24 như G0; FTS5 cho bước tìm kiếm sau
- [ ] Dựng token giao diện mới theo `docs/interface-redesign.md`; không mang các token cũ của prototype sang.
- [ ] **Đăng nhập:** một tài khoản, mật khẩu hoặc passkey; mọi trang yêu cầu đăng nhập; `robots` chặn công cụ tìm kiếm
- [ ] **Triển khai:** VPS nhỏ hoặc máy nhà + Tailscale (không mở cổng ra Internet khi dùng Tailscale)
- [ ] **PWA:** cài lên màn hình điện thoại; service worker cache để ôn SRS, xem thẻ, đọc bài đã tải khi offline; đồng bộ khi có mạng
- [ ] **Sao lưu:** tự động sao lưu database và bản ghi âm mỗi ngày; nút tải về một file
- [ ] **Cài đặt:** giờ học, ngày shadowing, số thẻ mới/ngày, mức ghi nhớ FSRS, furigana mặc định, giọng TTS, sáng/tối
- [ ] Trang **Nguồn dữ liệu** ghi công theo giấy phép

## Dữ liệu

- Đọc database do `g0/data-import` tạo.

## Quy tắc và ràng buộc

**Chữ tiếng Việt và tiếng Nhật (bắt buộc):**

| Loại chữ | Font |
| --- | --- |
| Tiếng Việt (giao diện, nghĩa, giải thích) | Be Vietnam Pro |
| Tiếng Nhật nội dung | Zen Kaku Gothic New hoặc Noto Sans JP (thiết kế UI hiện dùng Shippori Mincho) |
| Kanji cỡ lớn | Shippori Mincho hoặc Noto Serif JP |
| Tiêu đề, số và giao diện | Be Vietnam Pro |

- **Không dùng font monospace cho chữ tiếng Việt** (không xếp được hai dấu chồng như Ộ).
- Tự lưu font trên máy chủ (không gọi Google Fonts lúc chạy) để PWA hiển thị đúng khi offline.
- Mọi đoạn chữ gắn `lang="vi"` hoặc `lang="ja"`; dòng trộn hai ngôn ngữ tách thành hai phần tử.
- Mọi input tiếng Việt chuẩn hoá NFC.

## Không làm trong nhánh này

- Chức năng học cụ thể (các nhánh g1 khác).

## Tiêu chí hoàn thành

- [ ] Đăng nhập được trên điện thoại qua Tailscale hoặc VPS; không đăng nhập thì không xem được trang nào
- [ ] Cài PWA lên màn hình Android và iOS
- [ ] Tắt mạng vẫn mở được app và các trang đã cache
- [ ] Bộ chữ thử Ộ Ệ Ờ Ữ Ỹ Đ 働 返 直 骨 hiển thị đúng trên Chrome Android, Safari iOS
- [ ] Khôi phục được từ file sao lưu

## Câu hỏi còn mở

- Chọn VPS hay máy nhà.
- Dịch vụ thông báo đẩy cho PWA trên iOS (yêu cầu cài PWA lên màn hình).

## Bối cảnh chung (tóm tắt)

- Web học tiếng Nhật **cho riêng một người dùng**, miễn phí, không kinh doanh, **không công khai** (bắt buộc đăng nhập mọi trang).
- Chạy trên VPS nhỏ hoặc máy nhà + Tailscale; dùng chủ yếu trên điện thoại dưới dạng PWA.
- Lộ trình N5 → N2: 87 tuần, bắt đầu 02/11/2026; thi N4 04/07/2027 (tuỳ chọn), N3 05/12/2027, N2 02/07/2028.
- Nhịp ngày đi làm: **ban ngày 5–10 phút Ôn nhanh** (chỉ thẻ từ vựng + kanji, không âm thanh); **buổi tối 45–60 phút** cho bài mới, ngữ pháp, dạng đề JLPT, shadowing.
- Bắt buộc **2 buổi shadowing/tuần** (Thứ Ba, Thứ Năm; Thứ Bảy khuyến khích). Thiếu buổi → khoá bài mới tuần sau; **ôn tập SRS không bao giờ bị khoá**.
- Người dùng là người học, **không biên tập nội dung**: tiếng Việt lấy từ nguồn có sẵn, phần thiếu dùng dịch máy (luôn kèm bản tiếng Anh và nút Báo sai).
