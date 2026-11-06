# Kiểm tra PR khung G1 — 06/11/2026

Trên Windows, Node 24.10.0, chạy `npm run check` thành công:

| Cổng | Kết quả |
| --- | --- |
| TypeScript và route types | Đạt |
| Kiểm thử prototype hiện hành | 22/22 |
| Kiểm thử foundation | 12/12 |
| Build production Next.js/Webpack | Đạt |
| HTTP và Chrome headless | Đạt |
| Desktop 1440px, mobile 390px | Đã quan sát ảnh, không tràn ngang |
| Lỗi JavaScript trong trình duyệt | 0 |
| Request trình duyệt tới nguồn bên ngoài | 0 |

Đã kiểm tra trang chưa đăng nhập (kể cả tuyến không tồn tại/RSC), API chưa
đăng nhập, Origin giả, cookie ký/hết hạn/bị sửa, mật khẩu NFC, robots/noindex,
bản dịch selected và nhãn model, database đọc-only, thẻ không trùng và không
reset lịch/state, giới hạn thư mục kể cả đổi tên file từ ngoài tuyến vào tuyến.
Mẫu seed chỉ có nguồn OpenJLPT, không có bản dịch máy hay dữ liệu riêng tư.
Schema khớp blob G0 nguyên bản và thao tác thêm thẻ không thay đổi sqlite_schema.

Report và ảnh tái tạo bằng `npm run test:app` nằm ở `data/reports/`, gitignored.
Kiểm thử tạo database/credential tạm và không gọi Gemini hoặc DB của worker G0.

## Giới hạn xác minh

- GitHub Actions chưa chạy: lần đầu bị chặn trước mọi step với annotation
  “The job was not started because your account is locked due to a billing issue.”
  Workflow vẫn được giữ để chạy lại sau khi chủ tài khoản xử lý; chưa kết luận
  đã pass CI Linux. Runner pin Ubuntu 24.04 để tránh thay đổi ubuntu-latest.
- Chưa thử trên thiết bị Android/Safari iOS thật hoặc triển khai qua VPS/Tailscale.
- PWA/offline, sao lưu, scheduler FSRS và tính năng học chi tiết chưa thuộc PR khung.
