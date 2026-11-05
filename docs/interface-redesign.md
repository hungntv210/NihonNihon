# Nihon Nihon — giao diện học tập

Thiết kế lại 5 màn hình hiện có: Trang chủ, Ôn tập, Shadowing, Kanji và JLPT.

- Nền giấy ấm, xanh lá trầm, chữ Be Vietnam Pro và Shippori Mincho cho nội dung Nhật.
- Sidebar có tiến độ lộ trình; thanh điều hướng dưới trên điện thoại có vùng an toàn.
- Trang chủ có minh họa SVG, tổng quan tiến độ và kế hoạch học.
- Thẻ ôn tập tập trung vào nội dung; phản hồi chấm thẻ không che thẻ tiếp theo.
- Điều hướng tức thì; hỗ trợ focus bàn phím, liên kết bỏ qua điều hướng và giảm chuyển động.
- Khung shadowing tách thông tin câu khỏi thời gian; từ Kanji có bố cục riêng cho điện thoại.

Giữ HTML/CSS/JavaScript thuần và dữ liệu mẫu sẵn có, không thêm thư viện.
Các tính năng chưa triển khai của prototype (âm thanh, ghi âm thật, đề thi mới,
chuyển sang chữ Kanji khác, lưu tiến độ Ôn tập/Kanji) vẫn cần triển khai chức năng riêng.

## Các mục học dùng thử

Đã thêm `lessons.js` với nội dung mẫu tự soạn và các màn hình:

- Từ vựng: 8 từ, tìm theo chữ Hán/kana/nghĩa tiếng Việt không dấu, lọc cấp độ,
  lưu/bỏ lưu, mở ví dụ và bài luyện 3 từ công sở.
- Ngữ pháp: 3 bài N4/N3/N2, cấu trúc, ví dụ và bài tập được chấm kèm giải thích.
- Đọc: 2 đoạn văn, bật/tắt furigana, bản dịch và câu hỏi đọc hiểu.
- Giao tiếp: 2 tình huống, mỗi tình huống 3 lượt đáp có phản hồi và luyện lại.

Từ đã lưu và các bài hoàn thành của những mục mới được lưu bằng localStorage
trên trình duyệt hiện tại. Không đồng bộ tài khoản và không thay đổi hàng thẻ
FSRS mẫu trong mục Ôn tập. Đạt đúng toàn bộ câu hỏi mới đánh dấu hoàn thành;
có thể sửa đáp án và kiểm tra lại. Hội thoại là kịch bản chọn đáp án, chưa có AI
hoặc nhận diện giọng nói.

Điện thoại mở các mục mới qua “Thêm” ở thanh điều hướng dưới. Các liên kết
Từ vựng/Ngữ pháp trong kế hoạch hôm nay cũng mở đúng màn hình tương ứng.

## Xem và kiểm tra

Chạy máy chủ tĩnh với thư mục gốc `prototype/`, rồi mở `index.html` qua HTTP.
Kiểm thử: `node --test prototype/tests/*.test.js`.

Đã quan sát 5 màn hình ở 1440px và 390px; kiểm tra mở đáp án, chấm thẻ,
nút chuyển nét, điều hướng và liên kết bỏ qua điều hướng. Không có tràn ngang
ở các màn hình đã đo. Chưa kiểm tra trên thiết bị điện thoại thật.
