# Gemini: dịch batch công khai

Adapter `tools/data/mt-gemini.mjs` dùng SDK `@google/genai`, `new GoogleGenAI({})`
và biến GEMINI_API_KEY do Node nạp bằng `--env-file`. Không đọc/in khoá trong code.

## Cấu hình trước khi gửi

Tạo `data/private/gemini-config.json` từ hạn mức thực tế AI Studio (không dùng
các số bên dưới làm hạn mức mặc định):

```json
{
  "model": "<model ID thật trong AI Studio>",
  "requests_per_minute": 0,
  "requests_per_day": 0,
  "daily_budget": 0,
  "max_output_tokens": 8192
}
```

Các số 0 là placeholder, adapter từ chối chạy. daily_budget là số request còn
được phép cho công việc này trong ngày quota Pacific, không lớn hơn requests_per_day. Có TPM
thì thêm tokens_per_minute; adapter tính biên byte bảo thủ theo cửa sổ 60 giây. max_output_tokens là ngân sách sinh, cần phù hợp model đã chọn.
Hạn mức thuộc cả project; ledger cục bộ không thấy request từ ứng dụng khác.

## Chuẩn bị manifest và queue mới (không gọi API)

```sh
node tools/data/mt-gemini.mjs --prepare --config data/private/gemini-config.json --manifest data/private/batch-kanjivg-manifest.json --output-manifest data/private/gemini-manifest.json --requests data/requests/gemini-batch.json --results data/mt-results/batch.json
```

Chọn manifest batch bổ trợ thật thay cho ví dụ trên khi có. Không ghi đè bản gốc.
Provider/model/prompt/config làm thay request IDs; **không** gán kết quả cho queue
cũ. Lệnh chuẩn bị tạo queue mới với mt:google-gemini, prompt version/hash và model
đã khai báo. Nếu muốn dùng `data/requests/batch.json`, giữ bản cũ riêng trước rồi
truyền đúng đường dẫn đó; mặc định của chế độ chạy vẫn là batch.json.

Chỉ tái dựng queue từ OpenJLPT, Tatoeba và dữ liệu đối chiếu/ứng viên Hán Việt.
Raw bank Hán Việt không được gửi; chỉ candidate ID/âm và ngữ cảnh công khai trong
request. Nguồn user-media bị loại **trước khi mở artifact**. Mục queue không khớp
input/ID/release tái dựng từ các nguồn được pin sẽ bị bỏ qua và đếm trong
blocked_private_or_unverified. Không gọi API để dịch clip/phụ đề/ghi âm cá nhân.

## Chạy thử 20 mục rồi dừng

```sh
node --env-file=.env tools/data/mt-gemini.mjs --config data/private/gemini-config.json --manifest data/private/gemini-manifest.json --requests data/requests/gemini-batch.json --results data/mt-results/batch.json --limit 20 --batch-size 20
```

Khoá hiện ở checkout `C:/Users/Admin/NihonNihon/.env`, còn code trong worktree
`g0-data-import`; có thể thay `--env-file=.env` bằng đường dẫn tuyệt đối tới tệp
đó. Không cần sao chép khoá. Không chạy khi chưa biết model/hạn mức.

20–40 mục/call, nhóm riêng dịch và HV để dùng schema chính xác; nhóm cuối có thể
ít hơn 20. Từng call tuần tự, nghỉ theo RPM; SDK retry tự động bị tắt để mỗi lần
thử đều được đếm. 429 nghỉ tăng dần tối đa 5 lần thử, có RetryInfo thì tôn trọng.
Quota ngày dừng đến ngày Pacific kế tiếp; hết budget cục bộ cũng dừng. Lỗi khác
hoặc output không hợp lệ dừng, không ghi response thô ra console. Output kiểm tra
Ajv, tập ID phải đúng cả batch, HV đúng candidate/căn cứ, NFC trước khi ghi.

Kết quả ghi checkpoint sau mỗi call, bỏ qua ID đã có; manifest được cập nhật hash
artifact. File quota/lock cũng nằm trong `data/mt-results/` gitignored. Nếu process
bị kill, kiểm tra không còn process chạy trước khi tự xoá quota.json.lock; giữ ledger.
Không chạy đồng thời hai process dùng ledger khác nhau cho cùng quota.

Sau lượt thử, báo số thành công/lỗi, xem nghĩa Việt và căn cứ Hán Việt trước khi
cho phép chạy phần còn lại. Adapter không tự mở lượt full. Chỉ sau khi duyệt lượt
thử mới tăng --limit theo số mục còn lại. Import kết quả bằng manifest Gemini:

```sh
node tools/data/import.mjs --manifest data/private/gemini-manifest.json --db data/batch.sqlite --report data/reports/gemini-batch.json --requests data/requests/gemini-remaining.json
```

Không dùng kiểm thử schema tự động để thay cho đánh giá chất lượng dịch.
Kiểm thử mock không tính là đã hoàn thành lượt thử 20 mục thật.

## Hai luồng và Interactions (06/11/2026)

Model và hạn mức đọc từ config; không có tên model mặc định trong adapter.
Config nhận thêm:

- api: interactions hoặc generateContent (mặc định cũ là generateContent).
- thinking_level: minimal / low / medium / high, pin trong MT release.
- route: learning (nghĩa, ngữ pháp, Hán Việt) hoặc sentences (field=text).
- batch_size: 20–40; min_interval_ms: khoảng nghỉ tối thiểu ngoài kiểm tra RPM.

Interactions dùng response_format `{type:"text", mime_type:"application/json",
schema:...}`, generation_config.thinking_level và output_text; store=false,
maxRetries=0. GenerateContent vẫn hỗ trợ responseJsonSchema/thinkingConfig.
Cả hai đường kiểm tra Ajv/membership/NFC trước khi ghi; JSON hỏng retry tối đa
hai lần sau lần đầu, mỗi lần đều tính quota. 5xx tạm thời retry hữu hạn; lỗi khác
trả api_error và mã HTTP, không in raw error hoặc request/headers chứa khoá.

Mỗi model dùng manifest/queue/results riêng để giữ đúng release và request_id.
Model dự phòng cũng cần chuẩn bị manifest riêng; không trộn output model dự phòng
vào release của model chính. Không tự gọi dự phòng khi model chính còn hoạt động.
Sau khi duyệt pilot, có thể dùng config dự phòng để tiếp tục phần chưa có kết quả;
phải tái dựng IDs theo release mới và lọc nội dung đã hoàn thành theo item/field.

TPM dùng biên byte input + schema + tối đa token output và ledger cửa sổ 60 giây,
không bắt buộc nghỉ 60 giây giữa mọi request. RPD reset theo ngày
America/Los_Angeles (midnight Pacific), tương ứng khoảng 14–15h Việt Nam tuỳ DST.
Không tự chạy qua ngày: khi hết quota dừng/checkpoint, lần chạy sau tự nhận ngày mới.
Ledger cục bộ vẫn không biết các ứng dụng khác dùng chung project.

Tài liệu API chính thức:
[Interactions](https://ai.google.dev/api/interactions-api),
[rate limits](https://ai.google.dev/gemini-api/docs/rate-limits).

## Backoff và chuyển model

503/5xx nghỉ 30–60 giây (có jitter, không vượt 60 giây), tối đa
3 lần gọi mỗi nhóm gồm lần đầu, rồi trả api_error để chuyển model. Trần 3 áp dụng
kể cả cấu hình cũ lớn hơn. max_api_attempts=1 cho pilot/probe để không retry. 429 vẫn có backoff riêng, quota ngày dừng ngay.
Không khẳng định Google trừ RPD cho lần 503: ledger local đếm mọi lần thử bảo thủ.

`tools/data/mt-gemini-chain.mjs` đọc danh sách profile từ JSON theo đúng thứ tự.
Mỗi profile có configPath, manifestPath, requestsPath, resultsPath, optional enabled.
Chuẩn bị manifest/results riêng bằng --prepare cho mỗi model trước; config route
phải cùng learning cho chuỗi nghĩa/ngữ pháp/HV. `enabled:false` bỏ qua model đang
không khả dụng mà không gọi thêm. Chuỗi hiện tại trong config local: 3.8 Flash →
3.6 Flash → 3.5 Flash Lite; câu ví dụ dùng profile sentences riêng, không đi chuỗi này.

```sh
node --env-file=.env tools/data/mt-gemini-chain.mjs --profiles data/private/gemini-learning-chain.json --limit 20 --report data/reports/gemini-learning-chain.json
```

Lệnh trên chỉ chạy sau khi duyệt pilot. `--limit` là số context **chưa hoàn thành**
tối đa cho lượt chạy mới, không phải giới hạn tổng số kết quả tích luỹ.
Model sau chỉ nhận context chưa có output hợp lệ ở model trước. Không gửi lại
các mục đã hoàn thành chỉ để đổi model. Khi chuyển model, tạo request_id đúng release
của model mới; không đổi nhãn kết quả model cũ. Report index ghi từng request_id,
model thực sự được gọi, context_key và đường dẫn output; schema mt-results giữ nguyên
và manifest của từng artifact pin model/prompt/API/thinking. Xem report này khi so
chất lượng, không suy model từ tên file batch chung. Sau số lần retry hữu hạn thì
chuyển profile tiếp theo, không chờ đến ngày sau. Schema/căn cứ sai hết retry thì
dừng để kiểm tra thay vì âm thầm hạ chuẩn kiểm định.

Cấu hình `enabled:false` còn chặn cả lệnh gọi trực tiếp tới model, không chỉ profile
trong chuỗi. 3.8 hiện bị tắt trong config local; chỉ bật lại sau khi chủ dự án xác
nhận trạng thái ổn. Không tự dùng hết budget còn lại để thử model. Pilot một call
mỗi model cần một nhóm task đồng nhất (không trộn translate và han_viet vì hai
schema khác nhau), `max_api_attempts:1`, và số mục không vượt batch_size.
