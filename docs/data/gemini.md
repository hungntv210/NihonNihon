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
được phép cho công việc này trong 24 giờ, không lớn hơn requests_per_day. Có TPM
thì thêm tokens_per_minute; adapter tính biên byte bảo thủ và giãn mỗi request ít
nhất 60 giây. max_output_tokens là ngân sách sinh, cần phù hợp model đã chọn.
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
Quota ngày dừng và chặn thêm 24 giờ bảo thủ; hết budget cục bộ cũng dừng. Lỗi khác
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

Chưa có kiểm thử API thật hoặc đánh giá chất lượng dịch khi thiếu model/hạn mức.
Kiểm thử mock không tính là đã hoàn thành lượt thử 20 mục thật.
