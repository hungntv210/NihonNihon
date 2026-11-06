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

## Một call chứa dịch và Hán Việt; import nhiều model

Config `mixed_tasks:true` cho phép một request chứa translate và han_viet bằng
schema anyOf; request_id bị ràng vào đúng nhánh schema. Mỗi output vẫn kiểm tra
đúng validator của task gốc, candidate membership và căn cứ. Dùng chế độ này cho
pilot khó cần đúng một call, không ghép field tùy tiện vào cùng một bản dịch.

Manifest import có thể có `mt_profiles: [<config MT đã pin>, ...]` ngoài `mt`.
Mỗi mt-results artifact phải ghi `mt_config_sha256: SHA256(stable(config))` trỏ
đúng một profile cùng source_id. Không ghép model bằng tên file hoặc đổi model của
release cũ. Importer tạo một source_releases cho từng cấu hình, lưu tất cả output
hợp lệ thành selected/candidate với release tương ứng, kể cả các bản thay thế từ
model khác; rerun không tạo bản sao. Khi đã có selected hiện hành thì giữ nguyên
và nhập bản khác dưới dạng candidate, không tự coi model mới là người duyệt.

Mỗi dòng vi_translations nối source_releases.release_id; model thực nằm trong
source_releases.manifest_json.model. Model/prompt/config của từng dòng được giữ
riêng dù source_id đều là mt:google-gemini. Report/queue và raw mt-results giữ local.

## Prompt v2 và gộp câu NFC

`gemini-vi-hv-2` thêm thuật ngữ bắt buộc 学生=sinh viên, 生徒=học sinh, 風邪=cảm,
và giữ mức lịch sự/kính ngữ/khiêm nhường. Prompt hash và version được pin trong
release mới, không ghi nhãn v2 lên output v1.

Config MT v2 có sentence_key=ja-nfc-v1: request dịch câu công khai chỉ phụ thuộc
text Nhật NFC + model/prompt release; không phụ thuộc item ID, English gloss hay
Tatoeba ID. Giữ nguyên sentence IDs và quan hệ item_sentences. Một output được
fan-out vào mọi sentence item cùng text, source_record_key/request_id giống nhau.
Không gộp NFKC, không xoá dấu câu hay viết lại câu. Clip/subtitle cá nhân không
được canonical hoá chung với nguồn công khai và vẫn bị chặn trước API.

Các English gloss khác nhau của cùng sentence ID được giữ trong field_sources
example_variants; câu Nhật khác nhau cho cùng ID vẫn bị từ chối. Prompt v1 giữ
cách tính request_id cũ để đọc được cache/lịch sử. Prompt mới khai báo rõ
supersedes_prompt_versions, cho phép chuyển selected cũ sang needs_review và chọn
output mới, không sửa text cũ. Các profile cùng route ưu tiên prompt chưa bị thay thế.

Thống kê nguồn local: data/reports/openjlpt-sentence-dedupe.json. Số dòng ví dụ và
số câu NFC duy nhất là hai đại lượng khác nhau; không dùng số hàng vi_translations
để suy ra số request phải gọi. Chạy dài dừng/checkpoint khi hết quota, không tự chờ
qua ngày hoặc chuyển toàn bộ nghĩa/ngữ pháp sang Lite nếu chỉ được phép chạy Flash.

## Thuật ngữ và sắc thái: prompt v3

Lượt v2 đã phát hiện lỗi “cảm cúm” và làm phẳng 伺います. Không coi việc chỉ chứa
substring “cảm” là đạt. `gemini-vi-hv-3` cấm dùng cúm/cảm cúm cho 風邪 và yêu cầu
biểu đạt khiêm nhường tường minh cho 伺います/伺いました. Validator kiểm tra thuật ngữ
và các mẫu khiêm nhường cụ thể trước khi lưu; đây là kiểm tra hữu hạn, không thay
đánh giá đầy đủ sắc thái. Output v2 vẫn giữ riêng để truy vết, không đổi nhãn thành v3.
V3 khai báo supersedes v1/v2; dữ liệu thử không đạt không được nhập thành selected.

## Cổng 50 request và mẫu duyệt

`runGemini` hỗ trợ maxCalls (CLI --max-calls) là trần **lần gọi API**, tính cả retry;
không nhầm với số item hoặc số batch thành công. onAttempt nhận response/call status
để audit trước normalization; không log raw response/khoá ra console. pause_after_response_ms
cho phép nghỉ ít nhất 5 giây sau mỗi response thành công. max_compounds_sent giới hạn
ngữ cảnh Hán Việt thực gửi và pin giới hạn trong release; vẫn kiểm tra căn cứ theo
phần input đã gửi, không gửi raw bank.

Hai model chạy song song dùng state_path riêng, được seed từ ledger cũ trước khi
chạy; không reset quota hoặc chạy cùng model với ledger khác nhau. Counter tính cả
lần thử HTTP lỗi bảo thủ, không khẳng định Google có tính lỗi đó vào RPD. Learning
3.6 đặt daily_budget=17, RPD server=20; câu dùng Lite và không gọi 3.8.

translation-gate.mjs kiểm tra JSON/array/schema, thiếu/thừa/trùng request_id, text_vi
rỗng, text_vi bằng nguyên câu gốc, kana/kanji còn sót, NFC và tỷ lệ độ dài ký tự
Unicode ngoài [0.5, 8]. Độ dài/kana là cờ cần xem lại, không kết luận dịch sai tự động.
Báo cáo phân biệt lỗi HTTP trên số call, lỗi JSON/schema trên response 2xx, lỗi dòng
trên tổng item được yêu cầu của response 2xx (bao gồm retry), và số câu đã lưu duy nhất.
Không có output thì INCOMPLETE, không được PASS chỉ vì các bộ đếm bằng 0.

review-sample.mjs lấy mẫu ngẫu nhiên 30 câu duy nhất: 8 N5, 8 N4, 7 N3, 7 N2;
lưu ID của mẫu để đối chiếu, không chọn lại theo bản dịch trông đẹp. Câu dùng chung
nhiều cấp được gán cấp đầu tiên trong thứ tự N5→N2, giữ toàn bộ owner/English variant
trong provenance. Mẫu gửi duyệt có Nhật, Anh, Việt, model, request_id và cờ QA, kèm
ít nhất 10 giải thích ngữ pháp dài đã có bản dịch.
