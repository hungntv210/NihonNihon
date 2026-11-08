# Máy nhà Windows — triển khai theo từng bước được duyệt

Đích đã chọn: `C:\Users\Admin\NihonNihon`, backup thứ hai
`D:\NihonNihonBackup\`. Tài liệu/tập lệnh không tự thực thi bước cài đặt.
Chủ dự án xác nhận từng bước trước khi chạy lệnh thay đổi checkout, cấu hình,
Tailscale hoặc Task Scheduler. Không dùng systemd/pm2/NSSM.

## 1. Chuẩn bị checkout và cấu hình (cần xác nhận)

Kiểm tra `git status` tại đích, giữ mọi thay đổi chưa commit. Chỉ cập nhật master
khi thư mục sạch và không ảnh hưởng worker G0. Không chép dữ liệu private lên GitHub.
Chạy `npm ci`, chọn DB G1 riêng có dữ liệu đã nghiệm thu, cấu hình `.env.local`
theo `.env.example`; không seed đè DB thật. DB phải tên `demo.sqlite` hoặc
`NIHON_DB_ROLE=snapshot`. Tạo mật khẩu bằng `npm run auth:password`, tạo
`SESSION_SECRET` riêng; không gửi các giá trị đó qua chat.

Chạy `npm run check` rồi `npm run build`. Chạy thử foreground bằng
`npm run start`; kiểm tra đăng nhập localhost. Chưa đăng ký task ở bước này.

## 2. Tailscale và HTTPS (chủ dự án cài/đăng nhập)

Cài Tailscale từ trang chính thức trên Windows và điện thoại, đăng nhập cùng
tailnet, bật HTTPS certificates theo hướng dẫn Serve. Sau khi được xác nhận:

```powershell
tailscale serve --bg http://127.0.0.1:3000
tailscale serve status
```

Đặt `APP_ORIGIN` bằng đúng URL HTTPS mà Serve in ra (không thêm path), khởi động
lại app, mở URL đó từ điện thoại trong tailnet. Giữ đăng nhập của app, không bật
Funnel/public access và không phục vụ thư mục data/backup. Theo
[tài liệu Serve](https://tailscale.com/docs/reference/tailscale-cli/serve).

## 3. Xem kế hoạch rồi đăng ký Task Scheduler (hai bước xác nhận riêng)

```powershell
powershell -NoProfile -File tools/home-tasks.ps1
```

Lệnh mặc định chỉ in kế hoạch, không tạo task. Khi chủ dự án duyệt kế hoạch,
chạy cùng lệnh với `-Apply -Confirm`. Hai task dùng tài khoản Windows hiện tại,
không lưu mật khẩu: app chạy lúc đăng nhập; backup chạy lúc đăng nhập và 22:00
hằng ngày. App/task lỗi được thử lại 3 lần, cách 1 phút; không chạy trùng.
Đây là chạy **sau đăng nhập**, không phải dịch vụ trước màn hình đăng nhập.
App chạy ở127.0.0.1:3000; log tại `data/reports/home/app.log`.

Sau xác nhận riêng, dùng `Start-ScheduledTask -TaskName NihonNihon-App` để thử.
Xem LastTaskResult/History khi lỗi. Cần dừng/xóa task thì xin xác nhận trước khi
chạy `Stop-ScheduledTask`/`Unregister-ScheduledTask`; không đụng task khác.

## 4. Sao lưu, chép ổ D và thử phục hồi (cần xác nhận trước lần ghi D đầu tiên)

```powershell
powershell -NoProfile -File tools/home-copy-backup.ps1 -ProjectPath C:\Users\Admin\NihonNihon -Destination D:\NihonNihonBackup
node --env-file-if-exists=.env --env-file-if-exists=.env.local --import tsx tools/home-backup.ts verify D:\NihonNihonBackup\YYYY-MM-DD.json
```

Tập lệnh dùng cùng `saveDailyBackup` như `npm run backup:daily`, rồi chép archive,
so SHA-256 nguồn/đích và trích DB **vào thư mục tạm** để kiểm tra integrity, FK và
bảng chính. Hash mọi thành phần archive cũng được kiểm tra. Không phục hồi vào
DB đang dùng. Bản đích khác hash sẽ báo lỗi, không tự ghi đè; không tự xóa bản cũ
ở D. Giới hạn archive128MiB vẫn áp dụng, bao gồm ghi âm/base64.

Ổ D cùng máy **không chống hỏng/mất máy**. Mỗi tuần chép thêm một bản ra ổ rời
hoặc điện thoại, kiểm hash và bảo vệ quyền truy cập vì archive có ghi âm riêng.
Kiểm tra D còn đủ dung lượng; backup task thất bại phải được xử lý qua History.

## 5. Nghiệm thu thực tế

- Khởi động lại Windows rồi đăng nhập: app tự lên, task có trạng thái/exit đúng.
- Dừng mô phỏng tiến trình app sau khi được duyệt: task tự thử chạy lại.
- Điện thoại qua HTTPS: đăng nhập, ôn một thẻ, ghi âm/nghe lại (chưa xác nhận
  Safari/Android thật bằng kiểm thử desktop).
- Có archive ở D, SHA-256 trùng và lệnh verify trả `integrity: ok`.
- Khôi phục giao diện trên bản DB riêng nếu cần thử đầy đủ; không thử đè production.

Các bước trên chưa được thực thi chỉ bằng việc merge nhánh này. CI/local tests
chỉ chứng minh kiểm tra archive trên fixture, không chứng minh máy đã deploy.
