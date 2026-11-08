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

20–60 mục/call, nhóm riêng dịch và HV để dùng schema chính xác; nhóm cuối có thể
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
- batch_size: 20–60; min_interval_ms: khoảng nghỉ tối thiểu ngoài kiểm tra RPM.

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

## Chiến dịch được duyệt: prompt v4 và lịch Pacific

`gemini-vi-hv-4` thêm 以下 = trở xuống, 以上 = trở lên (bao gồm mốc),
未満 = dưới (không gồm mốc). Validator áp dụng cho ngưỡng số và mục từ độc lập;
không ép nghĩa số vào 以上です/〜以上は. V4 khai báo thay thế v1–v3. Cache đã
đạt giữ release cũ; chỉ gửi lại câu không đạt thuật ngữ mới, không đổi nhãn cache.

Adapter tính ngày quota bằng `America/Los_Angeles`, ghi cả ngày quota và thời điểm
reset UTC/Việt Nam trong ledger. Midnight Pacific là 15h Việt Nam vào mùa đông,
14h khi Pacific áp dụng DST; kiểm thử bao phủ cả hai. Mọi lần thử, kể cả HTTP lỗi,
đều được tính bảo thủ vào budget. Không xoá ledger khi khởi động lại.

Sau khi chủ dự án cho phép chạy toàn bộ, dùng worker:

```sh
node --env-file=.env tools/data/translation-campaign.mjs --config data/private/campaign-v4-config.json
```

Config riêng tư khai báo `directory`, `sentence_base`, `learning_base`,
`sentence_cache` (câu đã duyệt), `learning_cache` (requests/results đã duyệt),
`sentence_order`, `sentence_provenance`, `learning_not_before` (UTC), và bốn
profile đầy đủ: `sentence_primary`, `sentence_backup`, `learning`, `probe`.
Mỗi profile có ledger `state_path` riêng theo model. Không đổi profile sau khi
đã chuẩn bị manifest; tạo thư mục chiến dịch mới nếu đổi model/prompt/config.

Lịch đã duyệt ngày 06/11/2026:

- Mỗi lô 30 câu: thử 3.5 Flash Lite một lần, chưa đạt thì sang 3.1 Flash Lite,
  tối đa ba lần; nghỉ ít nhất 5 giây, tôn trọng cả RPM/TPM/RPD đã cấu hình.
- 3.6 Flash chờ `learning_not_before`, 60 mục/call, trần 17 lần gọi/ngày Pacific
  gồm retry; trộn tối đa 20 yêu cầu Hán Việt với nghĩa/ngữ pháp trong mỗi lô.
- Sau mốc chờ, thử 3.8 Flash đúng một call; ghi `probe.started` trước API để restart
  không thử lại. Probe có budget riêng bằng 1; không dùng 3.8 chạy phần còn lại.

Khác CLI adapter chạy một lượt, worker được duyệt tự chờ reset rồi tiếp tục từ
checkpoint. Lỗi nội dung hết retry được hoãn riêng tới ngày sau, các lô khác
tiếp tục. Nếu cả hai model câu lỗi dịch vụ, hoặc 3.6 hết quota/lỗi dịch vụ,
luồng tương ứng chờ reset. `status.json` ghi tiến độ và trạng thái chờ, `audit.json`
ghi số call, HTTP status, loại lỗi validation và request IDs. Response bị từ chối
được giữ riêng trong thư mục private để chẩn đoán, không nhập vào database.

Cổng câu kiểm tra output trước khi lưu; không nhận dòng còn chữ Nhật, sao chép
câu gốc hoặc lệch độ dài. Báo cáo giữ lỗi của các lần thử riêng với QA kết quả
đã lưu. NFC được chuẩn hoá trước khi ghi. Learning luôn kiểm tra schema, đủ ID,
thuật ngữ và membership/căn cứ Hán Việt; câu Nhật được trích trong giải thích
ngữ pháp/Hán Việt không bị coi là lỗi còn sót chữ Nhật.

Khi cả hai luồng đủ 100%, worker kiểm tra lại mọi câu đã lưu và xuất
`review-30-sentences.json`, `review-10-han-viet.json`, `review.md` trong directory.
30 câu mới chia N5/N4/N3/N2 = 8/8/7/7, có Nhật/Anh/Việt/model/cờ QA; mười mục
Hán Việt giữ candidate, từ ghép, nghĩa và căn cứ. Nếu config có `import` với
`baseManifest` và `dbPath`, worker gộp các profile đã pin, nhập SQLite có backup
và ghi `import-report.json`; không gán model dự phòng cho release model chính.

Giữ máy và worker chạy để tự tiếp tục qua reset. Nếu bị ngắt, xác minh PID trong
`campaign.lock` đã kết thúc rồi mới xoá đúng lock cũ, chạy lại cùng config.
Không chạy song song worker thứ hai; raw/cache/kết quả/ledger vẫn gitignored.

## Prompt v5: chỉ dịch phần chưa có

Prompt `gemini-vi-hv-5` giữ glossary v4, thêm yêu cầu không tự thêm chủ ngữ,
đại từ hay thông tin không có trong câu Nhật; `恐縮` giữ nghĩa xin lỗi vì làm phiền.
`prompt_version` có thể pin v4 để kiểm tra/reproduce release cũ. V5 không khai báo
supersede bất kỳ prompt cũ nào; kết quả đã nhận giữ model/prompt/release thực tế.

Dừng worker ở checkpoint chờ ngày, xác minh PID đã kết thúc rồi mới xoá đúng
`campaign.lock`. Chạy offline rotation bằng export `rotateCampaign({configPath,
outputConfig,directory})` trong `tools/data/translation-campaign.mjs`, dùng đường
dẫn mới cho output config/directory. Hàm không gọi AI; nó giữ manifest/results
cũ, tái dùng nguyên đường dẫn quota, copy hold/probe và chuẩn bị queue chỉ gồm
câu/context chưa có. `accepted_profiles` giữ các manifest nguồn cũ để cache và
lần import cuối vẫn nhận đúng release. `rotation-report.json` ghi số đã có/còn
lại và hold; kiểm tra report trước khi chạy worker với config mới. Không xoá
`hold_day`, `finished_day` hay `probe.started` để thử model đang trả 503 lại.

Giới hạn learning vẫn là 17 call/ngày Pacific trong trần 20 RPD, bao gồm retry;
503 tối đa ba lần với backoff 30–60 giây. Source plan chỉ nhận allowlist public;
clips, subtitles và recordings không được gửi đến AI.

## Prompt v6 và lượt kiểm tra lại 30 câu

`gemini-vi-hv-6` giữ nguyên v4/v5 và thêm ví dụ chống tự thêm nước, chủ ngữ,
quan hệ, danh xưng thủ đô; giữ lời mời/câu trần thuật và tên riêng.
Glossary khớp cụm dài trước: `留学生` → du học sinh, `小学生/中学生/高校生`
→ học sinh, `大学生` → sinh viên, `大学院生` → học viên cao học. `学生` đứng
riêng vẫn bắt buộc sinh viên. Không bỏ gate cũ để nhận lô từng bị loại.

QA `proper_name` kiểm tra mất/đổi tên trong bảng đối chiếu tên công khai ở
`mt-gemini.mjs` (ví dụ キートン → Keeton, không phải Keaton). Đây là bảng hữu
hạn, không phải bộ nhận diện mọi tên riêng; tên ngoài bảng và thông tin tự thêm
vẫn cần người duyệt. Không cho phép giữ chữ Nhật trong bản Việt để né QA.
Gate này áp dụng đầu ra v6 mới, không áp ngược rồi dịch lại cache đã chấp nhận.

`rotateCampaign` mặc định dùng prompt hiện tại; truyền `promptVersion` nếu cần
tái hiện bản cũ. Luôn tạo thư mục/config mới, giữ nguyên quota, probe, hold và
accepted profiles. Với lượt duyệt, chỉ gửi lại 30 câu chưa được chấp nhận của
lô bị loại, dùng một request, rồi xuất Nhật/Anh/Việt/model/cờ QA để duyệt;
không nhập DB hoặc tự mở toàn hàng đợi trước lượt duyệt này.

Worker stdout ghi từng `api_attempt` với model, `http_status`, loại lỗi và cờ
validation, cùng `error_status` trong kết quả lô. Khi khởi động, nó cũng ghi lại
mã HTTP đã lưu của learning/probe, không gọi model lại để lấy mã lỗi. HTTP 429,
400, 503 được giữ riêng; lỗi mạng không có HTTP ghi null/unknown, không đoán.
Không ghi nguyên lỗi từ SDK vì có thể chứa thông tin nhạy cảm. Retry 503 vẫn
tối đa ba lần, chờ 30–60 giây; 3.8 lỗi probe không tự trở thành fallback.

## Quy trình được duyệt sau lô v6 ngày 08/11

Quyết định chủ dự án thay thế bước chờ duyệt toàn bộ nêu trên: giữ 26/30 câu;
chỉ dịch lại một lần các dòng #2, #17, #24, #28. Đại từ chủ ngữ được câu Anh
nguồn hỗ trợ là hợp lệ. Câu dịch lại còn lỗi nghĩa nhưng qua gate cấu trúc vẫn
nhập DB, mở `translation_reports` để xem lại và tiếp tục worker; không đổi schema
hay xoá bản dịch đang selected để gắn cờ.

Prompt vẫn là v6, cấu hình `prompt_revision: 2` ghi `config.promptRevision=2`
và hash mới; cấu hình v6 không có revision vẫn giữ hash của lô 30 gốc.
Thêm quy tắc ～ませんか là lời mời lịch sự, ～てきた/～ていく giữ diễn biến,
でしょう dự đoán không thành “nhỉ”, và không suy ra nước từ chiếc cốc đầy.
`reference_en` chỉ được dựng từ các câu trong nguồn công khai đã kiểm checksum,
không lấy từ tệp tuỳ ý hay clip riêng; JA NFC vẫn là khoá dedupe, không đổi ID
của release cũ và không dịch lại context đã chấp nhận.

Worker nhập sau mỗi lô có kết quả đạt QA, tuần tự hoá các lần ghi DB giữa hai
luồng câu/learning. Gate JSON/schema, đủ ID, rỗng, chữ Nhật, sao chép, độ dài,
NFC, glossary và tên riêng vẫn giữ nguyên. Lỗi API hay gate không được gán
thành bản dịch hợp lệ. Checkpoint lưu trước khi tiếp tục gọi API.

Mỗi khoảng 500 câu mới (tối đa lệch một lô 30), xuất ngẫu nhiên 30 câu vào
`review-NNNN.md/.json`, gồm Nhật/Anh/Việt/model. Mẫu cuối được xuất khi hoàn tất
phần câu dù chưa đủ 500. Tài khoản kiểm thử điền các dòng trong
`review-NNNN.feedback.json`: `severity` là null (chưa duyệt), `ok`, `minor`,
hoặc `major`, cùng `note`; giữ nguyên sample_id/request_id. Worker đọc lại phản
hồi trước mỗi lượt gọi, ghi cờ cho minor/major và tự dừng cả hai luồng khi
**major / tổng mẫu > 10%** (4/30 dừng; 3/30 tiếp tục), kể cả phản hồi chưa điền
hết. Phản hồi chưa có không được báo thành đã duyệt hoặc 0% lỗi nghĩa.
Mẫu ngẫu nhiên/QA không tự phát hiện được mọi lỗi nghĩa: ngưỡng này dựa trên
phản hồi kiểm thử, không dùng thêm model AI để giả lập người duyệt.

Mỗi lần nhập vẫn tạo snapshot trước khi ghi. Snapshot mới của campaign đặt riêng
trong `<campaign>/backups/`: sau commit thành công giữ bản đầu và hai bản gần nhất.
Chỉ dọn các tên đã đăng ký trong `campaign-backups.json`; không đụng bản cũ ở
`data/backups/`, bản before-restore, tệp lạ hoặc symlink. Như vậy nhập hàng chục
lô không nhân DB hàng trăm MB thành hàng chục GB backup. Kết quả MT và manifest
đã pin vẫn được giữ để tái dựng mọi lô; lỗi nhập không kích hoạt dọn snapshot.
