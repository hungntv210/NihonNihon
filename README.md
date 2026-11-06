# Nihon Nihon — G1 foundation

Khung ứng dụng riêng tư theo [giao diện hiện hành](docs/interface-redesign.md).
PR này dùng database mẫu OpenJLPT riêng, không sửa schema hay dùng dữ liệu riêng tư G0.

## Chạy thử

Cần **Node 24 trở lên** và npm.

```sh
npm ci
npm run data:demo
```

Sao chép `.env.example` thành `.env.local`. Chạy `npm run auth:password`, nhập
mật khẩu mới hai lần rồi dán dòng hash được tạo vào `.env.local`. Tạo secret bằng:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Dán kết quả vào SESSION_SECRET trong `.env.local`. Không commit/chia sẻ tệp đó.
Giữ `NIHON_DB_PATH=./data/demo.sqlite`; không dùng DB hoặc `.env` của worker dịch.
APP_ORIGIN phải đúng địa chỉ truy cập (mặc định `http://localhost:3000`).

```sh
npm run dev
```

Mở [localhost:3000](http://localhost:3000), đăng nhập bằng mật khẩu vừa đặt.
Có thể xem Hôm nay, Từ vựng, Kanji, Ngữ pháp, Nguồn dữ liệu và thêm thẻ vào hàng ôn.
Dữ liệu mẫu chưa có bản Việt nên hiện bản Anh có nhãn; không lấy nội dung tự soạn
hoặc dữ liệu dịch từ máy đang chạy worker để làm mẫu.

## Kiểm thử

```sh
npm run check
```

Lệnh này kiểm tra TypeScript, unit test, build production và kiểm tra HTTP/trình duyệt.
Không dùng mật khẩu thật, không gọi Gemini và không ghi vào database chính.
Trên máy chưa có Chrome hoặc Chromium của Playwright, chạy trước:

```sh
npx playwright install chromium
```

`CHROME_PATH` có thể chỉ tới Chrome cục bộ. Ảnh desktop/mobile và report kiểm tra nằm
trong `data/reports/` (gitignored). Schema được test so với blob G0 nguyên bản.

Trong lúc GitHub Actions bị khóa billing, phải chạy đầy đủ `npm run check` trước
**mỗi lần push** và chỉ push khi cả bốn cổng đạt. Ghi commit thực sự được kiểm tra,
ngày giờ có múi giờ và số kiểm thử đạt/tổng vào
[foundation-verification.md](docs/foundation-verification.md), rồi commit nhật ký.
Sau lượt check chỉ được thêm bản ghi này; nếu đổi code/config phải chạy lại toàn bộ.
Không thêm dịch vụ CI hoặc runner tự dựng.

## Sau khi khung được merge

Hợp đồng API, kiểu thẻ mới, font và quyền sở hữu thư mục nằm ở
[foundation-contracts.md](docs/foundation-contracts.md) và [AGENTS.md](AGENTS.md).
Chỉ sau khi PR này được merge mới phát triển đồng thời bốn nhánh:

| Nhánh | Thư mục duy nhất được sửa |
| --- | --- |
| g1/srs | `src/app/(study)/srs/` |
| g1/vocab | `src/app/(study)/vocab/` |
| g1/kanji | `src/app/(study)/kanji/` |
| g1/grammar | `src/app/(study)/grammar/` |

Ngoại lệ duy nhất ngoài thư mục tuyến là thêm nhật ký kiểm tra vào
`docs/foundation-verification.md`; bộ kiểm tra phạm vi chặn sửa/xoá nội dung cũ.

PWA/offline, sao lưu, FSRS và chức năng học chi tiết chưa nằm trong PR khung này.
