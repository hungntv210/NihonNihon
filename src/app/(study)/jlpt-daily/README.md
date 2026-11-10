# JLPT mỗi tối — G1

`/jlpt-daily` cung cấp 10 câu/ngày theo cấp hiện tại của lộ trình 87 tuần.
`/jlpt` (liên kết từ Hôm nay) chuyển hướng đến đây. Ngày shadowing hiện lời nhắc
ưu tiên shadowing; bài luyện bổ sung vẫn mở. Trang không gọi AI, kể cả khi chưa
có ngân hàng câu. Cấp và ngày được tính phía máy chủ từ cài đặt/lộ trình hiện có.

## Chuẩn bị theo tuần

Mỗi lần sinh **đủ 7 ngày × 10 câu**, chỉ dùng các mục OpenJLPT đúng cấp đã có
lượt ôn thật trong `srs_reviews`. Lưu thẻ chưa ôn không được tính là đã học.
Chạy offline trước tuần mới, sau khi cập nhật snapshot/app DB; không chạy từ HTTP.
Chưa đăng ký Task Scheduler; khi triển khai có thể gọi lệnh này mỗi tuần một lần.

```powershell
# Dùng app demo.sqlite hoặc NIHON_DB_ROLE=snapshot; tuyệt đối không trỏ DB G0 đang chạy.
# config.json thuộc data/private/, không chứa khóa. Chọn model/hạn mức đã được chủ dự án duyệt.
node --env-file=.env --import tsx 'src/app/(study)/jlpt-daily/generate-week.ts' --week 2026-11-16 --config data/private/jlpt-config.json
```

Cấu hình bắt buộc: `model`, `verifierModel` (ID Gemini thực tế, không có tiền tố
`models/`), `requestsPerMinute`, `dailyBudget`, `timeoutMs`, `maxOutputTokens`.
Không có model/hạn mức mặc định. Khóa chỉ đọc từ `GEMINI_API_KEY`; không ghi vào
bank/log. REST dùng [structured JSON output](https://ai.google.dev/gemini-api/docs/structured-output).
Hai request tuần: một tạo 70 câu, một kiểm định ngữ nghĩa độc lập. Mỗi request
được tính trước vào sổ hạn mức theo ngày Pacific (kể cả khi lỗi), không retry tự
động. Sổ này **chỉ ghi lượt JLPT**, phải trừ ngân sách G0/ứng dụng khác khi cấu hình.
Trong PR chỉ dùng provider fixture, không tiêu hạn mức hay gọi API thật.

Ngân hàng chưa đạt QA không được xuất bản. Không ghi đè tuần đã có; chạy lại tuần
đã tồn tại dừng rõ ràng. Người vận hành xem lỗi trước khi thử lại, không tự bỏ gate.
Một lần chọn tối đa 240 mục đã học để giới hạn input. Chưa đủ từ/ngữ pháp đã học
thì dừng, giao diện hiển thị trạng thái trống thay vì tạo nội dung ngoài cấp.

## QA và nguồn

- Đủ 70 vị trí duy nhất, 10/ngày; có cả từ/ngữ pháp mỗi ngày và đủ 8 dạng trong tuần.
- Bốn lựa chọn khác nhau, một key; đọc có bằng chứng từ reading, chọn chữ/từ/mẫu
  có bằng chứng từ source. Sắp xếp có hoán vị và vị trí ★ hợp lệ.
- Không dùng kanji ngoài tập đã học. Không trùng stem chuẩn hóa NFKC trong 30 ngày,
  kiểm lại dưới khóa lúc xuất bản để tránh hai lượt sinh đồng thời lọt trùng.
- Request kiểm định riêng phải xác nhận đúng một đáp án có nghĩa, 3 nhiễu cùng loại,
  hợp lý, đúng cấp/nội dung đã học và lời giải đúng. Không chắc thì loại cả tuần.
  shortcut: kiểm định ngữ nghĩa bằng AI có thể bỏ sót lỗi; khi có dữ liệu dùng thật,
  cần chủ dự án duyệt mẫu để đánh giá chất lượng, không coi boolean AI là chứng minh.
- Bank ghi model tạo/kiểm định thực tế, hash prompt, hash nguồn và kết quả QA.
  Nguồn thay đổi hoặc không còn là nội dung đã học thì bank không được dùng nữa.

Không đọc hay đóng gói dữ liệu đề thi OpenJLPT/đề thi có bản quyền. Chỉ dùng nội
dung học trong DB/fixture OpenJLPT đã có attribution của foundation; câu mới phải
được AI tự tạo theo prompt, không sao chép đề. Không thể suy ra giấy phép đề thi
từ giấy phép từ vựng. Bank sinh thật nằm riêng tư, không commit. `fixture.ts` là
dữ liệu tổng hợp kiểm tra luồng, không phải ngân hàng câu đạt chất lượng sư phạm.

## Chấm và lưu

Máy chủ giữ key/lời giải đến khi trả lời, kiểm session/origin và thứ tự câu.
Câu trả lời đầu tiên được lưu; gửi lặp không đổi điểm hoặc thêm thẻ trùng.
Sau mỗi câu (cả câu 10) có giải thích, cuối buổi thống kê điểm yếu theo dạng.
Câu sai dùng `enqueueCard` hiện có: reading / recall / cloze, thẻ mới hẹn sau 24h;
thẻ đã có giữ lịch FSRS và lịch sử hiện tại. Không thêm bảng hay sửa schema.

Bank và lượt trả lời: `NIHON_JLPT_PATH` hoặc thư mục `private/jlpt-daily/` cạnh DB.
Ghi JSON nguyên tử với khóa, không có endpoint upload. Nếu máy tắt giữa lúc ghi,
chỉ gỡ `write.lock` sau khi xác nhận không còn app/generator ghi vào thư mục.
Sao lưu foundation hiện chưa gói thư mục route này: chép thêm thư mục JLPT cùng
bản backup DB khi app/generator đã dừng; cần foundation mở rộng backup trước deploy.

## Kiểm thử không gọi API

```powershell
node --import tsx --test 'src/app/(study)/jlpt-daily/jlpt.test.ts'
npm run check
node tools/check-route-scope.mjs origin/master g1/jlpt-daily
node --import tsx 'src/app/(study)/jlpt-daily/browser-check.ts'
```

Browser-check dùng DB demo/khóa ngẫu nhiên/thư mục tạm riêng, tạo bank bằng provider
giả, kiểm desktop 1440 và mobile 390, CSRF/auth, lưu/chấm 10 câu, reload, SRS và
không có request ngoài app. Dọn fixture/server khi xong; ảnh/log ở data/reports/.
Thiết bị điện thoại thật và chất lượng bank AI thật chưa được kiểm trong PR này.

## Nháp tuần đầu từ Frozen (chỉ theo duyệt riêng của chủ dự án)

`draft-roadmap.ts` là công cụ offline riêng, không gọi từ trang học và không dùng
`publishBank`. Nó kiểm SHA-256/receipt/read-only của snapshot Frozen, giới hạn N5
đúng tuần 1–2 từ allocator Today/87-week roadmap, ghi `mode=draft_roadmap` cùng
`learningEvidence=roadmap_only_not_srs`. Không giả lịch sử ôn, không thay cổng đã học
của `generate-week.ts`. Chỉ các trường OpenJLPT công khai được gửi Gemini.

```powershell
node --env-file=.env --import tsx 'src/app/(study)/jlpt-daily/draft-roadmap.ts' --snapshot 'D:/path/frozen.sqlite' --receipt 'D:/path/frozen.sqlite.json' --week 2026-11-16 --config data/private/config.json --output data/private/first-week
```

Dùng model/hạn mức/timeout khai báo trong config như generator hiện có; ledger
Pacific dùng chung `data/private/jlpt-quota.json`. Sinh riêng từng ngày 10 câu;
source/options được gợi ý từ catalog với `answerTitle` dạng Nhật trần; không tự
sửa options/key do AI trả về. Cổng cứng kiểm từng dòng trước request kiểm định
độc lập. Chỉ thay vị trí bị cổng cứng hoặc SEMANTIC_QA_REJECTED loại,
tối đa hai vòng, giữ nguyên câu đạt. Còn lỗi thì lưu ngày bị loại và dừng. Nếu API
lỗi giữa ngày thì không nhận ngày đó; ngày trước đã qua QA được giữ để chạy tiếp.
Metadata/prompt/schema-policy và hash nguồn thay đổi thì từ chối resume khác ngữ cảnh.

Đầu ra nằm trong data/private: metadata, draft-day-N, status, mẫu 10 câu ngày đầu,
bank nháp 70 câu và mẫu 30 câu khi xong. Feedback để trống chờ tester. Receipt,
bank và report không đưa vào Git; không ghi bất kỳ câu nào vào DB/bank của app.
HTTP lỗi giữ status/message đã che API key để phân biệt 400/429/503. Nội dung thật
vẫn cần tester duyệt; QA bằng model không bảo đảm mọi câu có chất lượng sư phạm.

Cổng cứng (`hard-qa.ts`) yêu cầu reading có 【kanji】 và không lộ đáp án kana;
spelling có 【kana】, stem không có kanji, nhiễu cùng cấp có bằng chứng gần âm
(edit distance) hoặc gần hình (kanji chỉ khác một chữ/nhóm hình gần đã khai báo).
Không chứng minh được thì loại. Các lựa chọn không có Latin/chú giải/〜, đủ bốn
và khác nhau. Order có đúng bốn ô tách bằng khoảng trắng, không lặp từ trong phần
stem cố định (Intl.Segmenter), key và lời giải khớp thứ tự, ★ và câu hoàn chỉnh.
Lời giải order dùng `Thứ tự: 2→1→3→4. ★=1. Câu: ...` để kiểm được bằng máy.
Paragraph có 【ほんぶん】 ít nhất ba câu/40 chữ Nhật rồi 【とい】; các dạng điền
từ/mẫu có chỗ trống. Các cổng cũ về nguồn/cấp/kanji/trùng câu vẫn áp dụng.

`generateDraftDay` nhận seed câu + audit cũ và callback checkpoint: kiểm lại bằng
cổng cứng, giữ nguyên câu đạt, chỉ gửi các vị trí bị loại để sửa tối đa hai vòng.
Câu lỗi cứng không được gửi sang QA Gemini; API503 được trả ra một lần để caller
lưu checkpoint và dừng, không tự lặp request. Mẫu có câu pending/rejected không
được coi là bank đạt QA hoặc được xuất bản vào app.
