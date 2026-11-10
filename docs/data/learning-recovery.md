# Recovery learning sau khi worker hết hàng chờ

Không dừng worker giữa chừng. Chỉ chạy khi PID trong lock không còn sống, hàng
thường đã hết và chỉ còn deferred. Không xóa lock cũ của campaign, không reset
ledger, không chờ ngày quota mới, không gọi 3.6/3.8. Dùng config/model/hạn mức
đã duyệt, giữ ledger Pacific đang dùng.

```powershell
node --env-file=.env tools/data/recover-learning.mjs --config data/private/campaign-config.json --directory data/private/recovery-RUN
node tools/data/finalize-learning-recovery.mjs --config data/private/campaign-config.json --directory data/private/recovery-review-RUN
```

- Mỗi request tối đa10 mục, hai lượt recovery; kết quả đạt được giữ nguyên.
  Lỗi HTTP/quota dừng với checkpoint, không đổi ngân sách. Các JSON/schema lỗi
  không làm mất kết quả của lô đã đạt.
- Sau hai lượt, chỉ cho ngoại lệ `too_few_meanings` khi danh sách nghĩa Anh
  chuẩn hóa có tối đa2 giá trị khác nhau, có ít nhất1 nghĩa Việt và không vướng
  QA khác. Ghi flag để duyệt. Không tự suy đoán3 gloss đồng nghĩa có phải1–2
  nghĩa; trường hợp chưa đủ căn cứ đưa vào manual-review. Không nới glossary,
  kiểm tra âm Hán Việt/meaning hay QA câu.
- Mục chưa đạt trở thành hàng duyệt tay có lý do và output cuối. Không báo
  `learning.complete=true` khi còn bản dịch thiếu. Worker có mã mới sẽ dừng rõ
  khi chỉ còn hàng duyệt tay; không quay vòng vô hạn. Không khởi động lại
  worker cũ trước khi PR này được duyệt/merge.
- `lite-meaning-2` giữ yêu cầu dịch đủ meanings và bổ sung tiếng Việt cho meaning
  từ ghép cùng thuật ngữ “thể từ điển”. Đây là variant có hash riêng; prompt v7
  cũ và kết quả đã chấp nhận không bị viết lại.
- Hán Việt: loại nghĩa từ ghép không có dấu Việt hoặc chép gloss Anh. Từ Việt
  không dấu như **vai** được nhận chỉ khi từ điển ghim checksum đối chiếu đúng
  nghĩa đó; không dùng quy tắc “bỏ qua chữ không dấu”. CVDICT có `肩 /vai/`.
  Revalidation có thể dùng response HTTP200 thật đã lưu, validate lại schema,
  candidate/evidence/terminology/QA; ghi hash audit và căn cứ từ điển, không gọi
  API giả hoặc sửa ledger.
- Với nhiều candidate, so sánh âm theo vị trí chữ trong từ ghép có dữ liệu
  từ điển. Mismatch là flag. Đối chiếu DB gồm thẻ Hán Việt của từ và gloss từ
  điển; không lấy bản dịch máy làm căn cứ từ điển. Chuẩn hóa có dấu uỷ→ủy,
  không gộp mất dấu (đọc vẫn khác độc).

## Audit và sửa đã được chủ dự án chỉ định

`audit-review.json/.md` quét toàn bộ Hán Việt và nghĩa kanji selected; lưu kanji,
trường, giá trị hiện tại, đề xuất và lý do. Nghĩa không dấu được đưa vào danh
sách xem lại, không tự động xóa. `retranslate-han-viet.json` là hàng dịch lại
**chờ duyệt trước sửa hàng loạt**. `manual-review.json/.md` chỉ gồm mục chưa
được nhập, có tiếng Anh và output cuối cho tester.

Các sửa 委→ủy, 抱→bão, 吸 bút→mút và thay “thể nguyên mẫu” trong các trường ngữ
pháp selected dùng `runCorrectionImport` export từ `import.mjs`. Plan nhỏ chỉ
chứa những field đã chỉ định, kiểm translation ID/hash/candidate, tạo release
`mt:manual`, model=manual, reviewer=owner; cũ chuyển needs_review và giữ nguyên
text. Vì enum schema hiện tại, method vẫn là machine nhưng model/reviewer lưu
rõ trong release/context. Mọi import sau giữ bản owner thay vì chọn lại AI.
Không sửa schema hay UPDATE bản dịch trực tiếp trong script vận hành.

Recovery giữ accepted_profiles cho lần resume, ghi monitor-actions.jsonl.
Snapshot campaign vẫn tối đa một lần/ngày quota theo cơ chế đang có; importer
owner giữ một backup trước giao dịch sửa. Không xóa bản dịch hay backup. Chỉ
dọn lock tạm của chính recovery và fixture test.

## Kiểm thử

`npm test` gồm batch10 qua adapter; giữ dòng đạt/hai lượt rồi terminal; ngoại
lệ số nghĩa; kiểm tiếng Việt có từ điển; mismatch candidate có dấu; audit DB;
provenance owner, rerun/idempotency, giữ bản cũ và chống ghi đè bởi import sau.
Test dùng fixture, không gọi API thật.
