# Áp dụng quyết định tester và chỉ dịch nghĩa từ ghép

Nhánh này không sửa schema. Đếm nghĩa bằng NFC + lowercase + trim, **giữ dấu**:
`mỗi` và `mọi` là hai nghĩa; dạng NFD/uppercase của cùng từ vẫn tính một lần.
Các dạng tiếng Việt ngắn đã được tester duyệt không còn bị gắn cờ ngôn ngữ.
Tiếng Anh không thuộc tập đó vẫn được gắn cờ; QA glossary giữ nguyên.

`runCorrectionImport` nhận reviewer owner/tester. Nghĩa chưa có được thêm với
expected_translation_id=null và base_content_hash ghim rõ; bản có sẵn phải khớp
translation ID. Cũ được giữ nguyên text dưới needs_review, mới mang source
mt:manual/model=manual và reviewer đúng. Bản tester được bảo vệ qua import sau.

```powershell
node --env-file=.env tools/data/tester-decisions.mjs --config data/private/campaign-config.json --decisions data/private/tester-decisions-20261110.md --directory data/private/tester-RUN
# Chỉ kiểm lại response đã lưu, không gọi API:
node tools/data/tester-decisions.mjs --config data/private/campaign-config.json --decisions data/private/tester-decisions-20261110.md --directory data/private/tester-RUN --offline
```

Chỉ chạy khi worker không hoạt động. Parser chỉ nhận các bảng giá trị đã chỉ định,
ghim hash quyết định trong provenance. Với 輸/尻/捻, phải có reading tương ứng trong
các dòng từ điển Hán Việt trong DB; thiếu thì bỏ qua và báo, không tự thêm âm.
Manual MT profile ghi nhận 5 mục được duyệt để cache/resume không dịch lại chúng.

105 mục được ghim theo selected reading + translation ID + compound/reading hiện
tại. `compound-meaning-1` chỉ gửi từ ghép và gloss cần dịch cho 3.5 Flash Lite;
schema API chỉ có output.text_vi. Các trường Hán Việt được lấy từ snapshot cục
bộ, không do model lựa chọn. Hash của snapshot ghim trong MT config. Kết quả API
và audit thật được giữ private, dùng ledger Pacific/rate/timeout đã duyệt.

Importer giữ text_vi của thẻ Hán Việt đúng như trước. Reviewer tester áp dụng
quyết định giữ âm đó; trường `compound_meaning_provenance` ghi riêng source
mt:google-gemini, model3.5, release, prompt hash/version và request ID của nghĩa
mới. Như vậy provenance của âm được duyệt và nghĩa dịch máy đều còn đối chiếu được.
Các bản đã nhập được bỏ qua khi resume. Một backup trước lô tester được kiểm lại
quick_check và tái sử dụng cho phần nghĩa; không tạo backup cho từng request.

Từ Việt không dấu cần căn cứ từ điển cho từng nghĩa. Parser tách cả số thứ tự và
xuống dòng (`1. Quay, xoay`), không coi số thứ tự là một phần của từ. Trường hợp
này có thể xác minh lại response HTTP200 thật đã lưu, ghim hash audit và căn cứ,
không phải gọi API giả hay đổi quota. Phần nghĩa tiếng Anh chưa dịch không được
miễn QA vì sửa parser. Không commit quyết định, DB, raw data, key hay kết quả.

Kiểm thử dùng fixture: giữ dấu, tiếng Việt ngắn/English, reviewer tester, insert
nghĩa thiếu + rerun, chống đổi reading, payload/schema chỉ dịch meaning, parsing
gloss đánh số/xuống dòng và kiểm từng nghĩa không dấu có trong từ điển.
