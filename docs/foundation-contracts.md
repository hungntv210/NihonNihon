# Hợp đồng dùng chung của G1

PR này là khung có thể chạy và kiểm thử, chưa phải toàn bộ tính năng trong tài
liệu foundation. Sau khi chủ dự án duyệt và PR được merge mới mở công việc song
song cho srs/vocab/kanji/grammar. Mỗi nhánh chỉ sửa thư mục tuyến của mình theo
`AGENTS.md`, gồm cả component, handler và test riêng.
Ngoại lệ duy nhất là thêm nhật ký kiểm tra vào `docs/foundation-verification.md`;
không sửa bản ghi cũ. Mọi lần push trong lúc CI bị khóa billing phải có một lượt
`npm run check` đầy đủ đạt trên commit được ghi rõ trong nhật ký. Chỉ commit
bản ghi báo cáo sau lượt check; thay đổi code/config cần check lại toàn bộ.

## Dữ liệu và xác thực

- Node >=24, Next.js App Router, React, Tailwind; dùng `node:sqlite` giống G0.
  Khi merge G0, gộp package/lockfile theo
  [g0-g1-package-merge.md](g0-g1-package-merge.md); không bỏ bộ test của phía nào.
  Dev/build dùng Webpack được Next.js hỗ trợ; Turbopack trên máy Windows kiểm
  thử lỗi khởi chạy worker PostCSS nên không dùng làm đường chạy mặc định.
  Không thêm ORM hoặc migration. `docs/data/schema.draft.sql` là bản sao không sửa
  của blob G0 `0991ee1553ab652410d9d2aeba04a1d48613690a` trên `g0/data-spec`.
- `NIHON_DB_PATH` mặc định `data/demo.sqlite`. Không trỏ vào DB đang được worker
  dịch dùng. Khi cần dữ liệu G0, tạo snapshot riêng rồi cấu hình đường dẫn đó.
- `src/server/dal.ts` là điểm vào server-only. `getContent`, `getContentSummary`,
  `getContentSources`, `getSelectedTranslation` đều kiểm tra session tại thời
  điểm đọc, ngoài lớp bảo vệ tuyến. `withContentDatabase(callback)` mở kết nối
  **read-only**, cho phép tuyến tự viết truy vấn nội dung có tham số trong thư mục
  của mình rồi tự đóng kết nối sau callback đồng bộ. Không trả kết nối ra ngoài.
- Bản Việt chỉ trả khi `status='selected'`, `needs_refresh=0`, hash nội dung
  khớp và mục vẫn active. Không dùng candidate làm bản hiển thị. DTO trả model
  và prompt thật từ release; không suy đoán theo tên nhà cung cấp. Có English
  fallback rõ ràng khi chưa có bản Việt. `SourceLabel` hiển thị nguồn/model,
  phân biệt dịch máy và Hán Việt `ai_fallback` (“Tự chọn”).
- Session một chủ tài khoản, mật khẩu scrypt, cookie ký HMAC hết hạn sau 12 giờ,
  HttpOnly/SameSite=Strict; Secure khi APP_ORIGIN là HTTPS. Không có mật khẩu hay
  secret mặc định, không thêm bảng tài khoản. Đổi SESSION_SECRET để thu hồi mọi
  session. Login giới hạn 10 lần sai/15 phút trong process; khởi động lại sẽ reset
  giới hạn này. Không dùng tính năng đó làm chống lạm dụng cho dịch vụ công khai.
- Chỉ `/login`, `/api/session`, `/robots.txt` và tài nguyên tĩnh được mở công khai.
  Mọi trang nội dung/tuyến chưa biết đều chặn khi chưa đăng nhập; API yêu cầu
  session. POST phải có Origin trùng APP_ORIGIN; body giới hạn 4 KiB. Tất cả trang
  nội dung no-store/noindex. Không cache nội dung riêng tư bằng service worker.

## Thêm vào hàng ôn

`addToReview(itemId, cardType='recognition')` trong DAL kiểm tra session rồi gọi
writer có tham số. Chỉ ghi vào `srs_cards` có sẵn; không sửa nội dung hay schema.
POST `/api/review/cards` dùng hàm này. Kết quả `{cardId,dueAt,created}`; 201 khi
tạo, 200 nếu đã có. Trùng `(item_id,card_type)` giữ nguyên thẻ, lịch, state và
lịch sử. Mục thiếu/inactive hoặc `shadow` trên mục không phải clip bị từ chối.

Thẻ mới có `state_json={"status":"new"}`, `scheduler_version='pending:g1/srs'`,
`due_at=now`. Đây là hợp đồng bàn giao: tuyến SRS phải khởi tạo trạng thái scheduler
đã chọn trước lần chấm đầu tiên. Foundation không giả là đã triển khai FSRS.

Foundation cung cấp dependency dùng chung `ts-fsrs@6.0.0` và `wanakana@5.3.1`
cho tuyến SRS. SRS dùng model FSRS-6, retention 0.9, không fuzz; state vẫn nằm
trong JSON của bảng hiện hành. Chuyển romaji dùng wanakana, không gọi API ngoài.

## Giao diện và kiểm thử

- Token mới ở `src/styles/tokens.css`, theo `docs/interface-redesign.md`.
- `<ViText>`/`<JaText>` ở `src/components/text.tsx`: `lang` riêng, font riêng,
  string NFC; không dùng HTML thô. Be Vietnam Pro/Shippori Mincho được self-host
  kèm giấy phép OFL, không phụ thuộc Google Fonts khi chạy.
- Khung/sidebar/navigation dùng chung; mỗi tuyến có thể tạo component trong
  thư mục của mình. Dùng `ContentCard`, `AddToReview`, `SourceLabel` nếu phù hợp.
- `npm test` chạy kiểm thử prototype và foundation + test trong các thư mục tuyến.
  `npm run test:app` dùng build production thật, DB/credential tạm, kiểm tra HTTP
  và trình duyệt ở 1440/390 px, không gọi Gemini. Report/ảnh nằm trong
  `data/reports/` gitignored. CI dùng Chromium; Windows tự dùng Chrome đã cài hoặc
  `CHROME_PATH`, nếu không có thì dùng Chromium của Playwright.

Chưa thuộc PR khung: thuật toán FSRS/phiên ôn, tra cứu chi tiết/tìm kiếm FTS5,
ghi âm, PWA/offline, sao lưu tự động, cài đặt và triển khai VPS/Tailscale.
