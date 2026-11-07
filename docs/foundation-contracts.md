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
  nội dung no-store/noindex. Chỉ cache bản trang riêng tư khi chủ tài khoản bật tải ngoại tuyến; bản trang trong Cache Storage được mã hóa AES-GCM và mở khóa bằng mật khẩu cục bộ.

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

## Phần foundation tiếp theo

- Settings JSON nằm cạnh DB G1 (NIHON_SETTINGS_PATH), roadmap ở data/private/today-roadmap.json (NIHON_ROADMAP_PATH). Cài đặt giờ học, ngày bắt đầu/thi, múi giờ, ít nhất hai ngày shadowing, theme, furigana và giọng đọc dùng chung. Hạn mức thẻ mới và retention hiện chỉ đọc: SRS hiện dùng 90%, chưa áp dụng hạn mức.
- /vocab/lesson được proxy khóa nếu tuần trước chưa có hai ngày shadowing thường và tuần này chưa có buổi bù hợp lệ. Tuần đầu tiên không khóa. Duyệt nội dung và ôn SRS luôn mở. Thuật toán dùng cùng mốc tuần thứ Hai và múi giờ với today-roadmap.
- PWA đăng ký /sw.js từ khung đăng nhập. Chủ tài khoản nhập lại mật khẩu để bật tải; sau đó cần mở từng URL muốn lưu khi có mạng. HTML navigation được mã hóa AES-GCM; khóa PBKDF2 không ghi xuống đĩa. Khi worker khởi động lại và mất mạng, màn hình mở khóa cục bộ xuất hiện trước nội dung. Script, CSS, font được cache công khai vì không chứa dữ liệu người học. Không cache phản hồi API/RSC riêng tư.
- SRS đã có bộ nhớ phục hồi phiên plaintext trong localStorage từ nhánh SRS trước đó; phần PWA này không thay đổi tuyến SRS. Chỉ dùng thiết bị riêng. Đăng xuất/xóa trang tải xóa bản cache và snapshot phiên, nhưng giữ hàng lượt chấm chưa đồng bộ để tránh mất lượt ôn. Không coi đây là mã hóa toàn bộ bộ nhớ trình duyệt.
- Sao lưu gồm SQLite snapshot, recordings, settings và roadmap trong một archive JSON với SHA-256 từng file, giới hạn 128 MiB. Hằng ngày khi server đang chạy, và npm run backup:daily cho scheduler của máy chủ (chạy từ thư mục dự án; đọc .env rồi .env.local, biến môi trường của process được ưu tiên). Chỉ DB demo hoặc NIHON_DB_ROLE=snapshot rõ ràng được dùng; không cấu hình DB G0 live. Đường dẫn riêng tư phải ở dưới thư mục DB G1.
- Khôi phục kiểm tra archive/path/hash, schema trùng DB hiện hành, SQLite integrity/FK và JSON cài đặt/roadmap trước khi thay đổi. Tạo bản sao an toàn; maintenance gate chặn request ghi mới. Database giữ nguyên file và được thay dữ liệu trong BEGIN IMMEDIATE, defer_foreign_keys + FK check, nên writer SQLite đang/chờ chạy được tuần tự hóa. File recordings/settings/roadmap được stage và đổi tên với rollback; lỗi SQL/file giữ dữ liệu hiện tại. Khôi phục là thay thế trạng thái ở thời điểm bản sao, nên cần tạm ngừng học trước khi xác nhận.
- Chưa xác nhận cài đặt trên Android/iOS thật hoặc triển khai Tailscale/VPS. Browser production tests kiểm tra mở SRS hoàn toàn ngoại tuyến sau restart service worker, nhập sai/đúng mật khẩu, chấm và đồng bộ lại.
