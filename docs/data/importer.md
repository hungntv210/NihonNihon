# Chạy importer và xem batch

Nhánh `g0/data-import` đã merge `g0/data-spec`: SQL Draft 0.2 và HV-1.1.
Code này nhập dữ liệu, tạo báo cáo/queue AI và có màn xem SQLite cục bộ. **Chưa
nghiệm thu batch, chưa Frozen**. Không có dịch vụ AI hoặc dữ liệu riêng tư được gọi/tải
ngầm; chưa có số liệu Hán Việt thật khi chưa cung cấp các nguồn bổ trợ.

## 1. Cài và chạy

Yêu cầu Node **24** (đã kiểm tra 24.10.0), npm. SQLite dùng `node:sqlite`; Node 24
có thể in ExperimentalWarning. Ba thư viện đọc nguồn: Ajv, csv-parse, fast-xml-parser;
phiên bản/integrity được pin bằng package-lock. Windows nếu npm.ps1 bị policy chặn
thì dùng `npm.cmd` tương ứng, không đổi execution policy.

```sh
npm ci
npm test
```

Chuẩn bị checkout OpenJLPT riêng dưới `data/raw/` (bị Git ignore), kiểm tra commit
với `docs/data/source-audit.json`. Có thể dùng snapshot mới nhưng phải pin các hash
thực tế và không trộn JMdict khác snapshot một cách ngầm định.

```sh
node tools/data/prepare.mjs --openjlpt data/raw/OpenJLPT --out data/private/batch-manifest.json --batch
node tools/data/import.mjs --manifest data/private/batch-manifest.json --db data/batch.sqlite --report data/reports/batch.json --requests data/requests/batch.json
node tools/data/preview.mjs --db data/batch.sqlite --port 8766
```

Mở URL được in `http://127.0.0.1:8766`. Server chỉ bind loopback, không phải app có
đăng nhập hay bản hosting. File cá nhân chỉ phục vụ nếu truyền thêm `--media-root`
đúng thư mục media riêng, và asset phải được đăng ký trong database.

`prepare --batch` chọn **100 từ (80 N5+20 N2), 50 kanji, 20 grammar**, không random.
Từ được seed theo các trường hợp kana/katakana/する/đa cách đọc/nhiều dạng/thiếu ví dụ;
kanji có 大/行/長/働 và các chữ để thử alias; grammar có mẫu ngắn và dài. Phần còn
lại điền theo ID/codepoint ổn định. `selection_notes` ghi các điều kiện tìm được hoặc
chưa tìm được. Đây là tập khởi đầu có thể chỉnh, **không thay việc kiểm tra đủ case**
Unihan/variant/nguồn thật của bộ nghiệm thu. Cần thêm ba clip riêng; expected_counts
giữ clips=3 nên chạy OpenJLPT đơn thuần luôn báo chưa đủ.

Bỏ `--batch` sẽ chuẩn bị toàn bộ các cấp được chọn (`--levels N5,N4,N3,N2` mặc định).
Không ghi đè manifest đã có. `prepare` chưa tự tải raw bên ngoài checkout.

## 2. Manifest và nguồn bổ trợ

Manifest version 1 có `sources[]`, optional `cohort`, `expected_counts`, `mt`.
Mỗi source có source_id/name/url/license/version/attribution/usage_scope và files[];
usage_scope chỉ nhận redistributable/private_only, không nhận unverified.
Mỗi file có path, format, sha256 lowercase 64 ký tự, optional level/encoding/compression/
url/retrieved_at/header/variant. Path tương đối tính từ manifest, không theo cwd.
Nếu path chưa có và có HTTPS URL thì tải, kiểm tra hash **trước** khi cache file.
File đã có mà hash sai sẽ dừng, không tự ghi đè. URL không nhận username/password.

Ví dụ một file mô tả (thay đường dẫn và hash bằng giá trị thật):

```json
{
  "path": "../raw/kanji_bank_1.json",
  "format": "kanjidictvn",
  "sha256": "<SHA-256 của bytes tệp thật>"
}
```

`compression: "gzip"` kiểm tra hash bytes nén rồi giải nén. ZIP cần giải nén riêng
và pin file đầu vào đã giải nén; chưa có downloader/extractor ZIP. Encoding mặc định
UTF-8, KRADFILE có thể đặt `euc-jp`. Mọi text được đưa về NFC; không NFKC chữ Nhật.

| format | Input hỗ trợ |
| --- | --- |
| openjlpt-vocab / openjlpt-kanji / openjlpt-grammar | JSON array theo 3 schema upstream được pin, source_id=openjlpt, optional level phải khớp |
| kanjidictvn | JSON bank tuple 6 phần tử; source_id=kanjidictvn, private_only; âm ở [1] |
| javi-csv | CSV 2 cột từ/nghĩa, quote và multiline; header=true chỉ khi tệp thật có header |
| cvdict | CVDICT.u8 dạng traditional simplified [pinyin] /glosses/; source_id=cvdict |
| unihan | Unihan_Readings.txt đã giải nén, chỉ dùng kVietnamese, không suy thứ tự phổ biến |
| jmdict | XML gốc có ent_seq/k_ele/r_ele/sense; giữ hạn chế reading/writing/sense |
| jmdict-furigana | JSON array text/reading/furigana, phải tái dựng đúng text |
| kradfile | Text character : components, encoding cấu hình tường minh |
| kanjivg | SVG hoặc XML tập hợp, path có ID mã chữ-số nét; optional variant; không lưu/chạy SVG script |
| tatoeba-details | TSV id, lang, text, author…; license được khai báo cho snapshot nguồn; thiếu tác giả không chọn bản dịch |
| tatoeba-links | TSV id↔id; chỉ bản Việt liên kết trực tiếp, không qua cầu nối tiếng Anh |
| mt-results | JSON array các output theo request_id, source_id=mt:provider thực tế |
| user-clips | JSON array clip/phụ đề riêng, source_id=user-media, private_only |

Importer tính ambiguity **trước** khi lọc cohort, nên cung cấp toàn bộ các file cấp
cần kiểm tra rồi dùng cohort để chọn batch. CSV chỉ mặt chữ không được selected cho
headword nhiều reading. Từ chỉ kana có thể tra other_forms hoặc dạng JMdict phù hợp
reading và sense nghĩa Anh; không suy tích Descartes tất cả writing×reading. CVDICT
chỉ tính căn cứ khi từng âm của từ ghép đối chiếu được với candidate của từng chữ;
không đổi pinyin thành Hán Việt và không chọn nghĩa Trung làm nghĩa Nhật.

`cohort.vocab_ids`, `kanji_characters`, `grammar_ids`, optional `clip_ids` phải là
các ID/chữ thật có trong input. Thiếu ID hoặc duplicate cohort làm import dừng.
Thông tin compound phục vụ HV có thể lấy từ toàn bộ vocab input, kể cả ngoài cohort.

## 3. Queue AI, kết quả và cache

Adapter AI hiện là **file exchange**, chưa có HTTP provider adapter. Importer không
gọi AI có phí. Lần đầu tạo requests.json riêng tư, gồm request_id, task (`translate`
hoặc `han_viet`), input, mt_release_id, reason. Chưa có câu trả lời thì giữ thiếu dữ
liệu, không bịa kết quả. Bạn dùng nhà cung cấp đã chọn để tạo output rồi chạy lại.

Thêm source thực tế `mt:<provider>` cùng file `mt-results` (ban đầu có thể là `[]`),
và cấu hình `mt` trên manifest:

```json
{
  "source_id": "mt:your-provider",
  "model": "<model revision>",
  "prompt_version": "translate-and-hv-1",
  "prompt_sha256": "<hash prompt template thật>",
  "max_attempts": 2,
  "config": { "temperature": 0 }
}
```

Pin provider/model/prompt/config **trước khi xuất queue để gọi AI**; đổi config làm
đổi request IDs. Không commit keys, output/cache dịch, bank Hán Việt hoặc media.
Không tự gửi raw bank/video cho provider; payload queue chỉ gồm ngữ cảnh cần xử lý.

Mỗi phần tử của file kết quả:

```json
{ "request_id": "<ID từ queue>", "output": { "text_vi": "Bản dịch tiếng Việt" } }
```

Với task han_viet, output thay bằng:

```json
{
  "candidate_id": "<một ID trong input.candidates>",
  "compound": { "word": "<từ ghép Nhật>", "reading": "<cách đọc Nhật>" },
  "meaning": "<nghĩa làm căn cứ>",
  "reason": "<lý do chọn âm>",
  "evidence_origin": "model-generated",
  "references": []
}
```

Nếu evidence_origin=input, compound phải có trong input; references chỉ được trỏ
source/release đã cung cấp. Model-generated phải ghi đúng nhãn đó. Output ngoài
candidates, căn cứ thiếu hoặc tham chiếu bịa bị loại. Có thể cung cấp nhiều kết quả
cùng request_id theo thứ tự retry; chỉ xét max_attempts (1–5), không thử vô hạn.
Các output translate được NFC trước khi ghi. Sau khi sửa file MT, cập nhật sha256
của file trong manifest; không thay config khi chỉ thêm kết quả cho queue hiện tại.

Cache lưu trên vi_translations/context_json, request ID bao gồm input/base hash,
MT release, candidate set và rule; chạy lại tái sử dụng output đã kiểm tra. AI chọn
âm chính có hàng selected riêng nguồn MT; candidates từ điển vẫn giữ. Màn xem batch
hiện “tự chọn” và Báo sai đúng translation_id. Nghĩa Nhật của kanji dịch từ Anh
OpenJLPT; không lấy nghĩa Hán Nôm. Từ đọc Kun không được ghép Hán Việt máy móc.

## 4. Clip riêng và nét chữ

Clip cần id ổn định, title, duration_ms, origin và segments. Ví dụ cấu trúc (ID video
và text chỉ minh hoạ, phải dùng nội dung riêng có quyền dùng):

```json
{
  "id": "my-clip-uuid",
  "title": "Tên clip",
  "duration_ms": 3000,
  "origin": { "kind": "youtube", "video_id": "<11 ký tự>", "attribution": "Tác giả/nguồn", "license": "Private use" },
  "segments": [ { "id": "sentence-uuid", "ja": "Câu Nhật thật", "start_ms": 0, "end_ms": 3000 } ]
}
```

File cá nhân dùng origin.kind=file, path tính từ file clips JSON, sha256 của video.
Mỗi revision có release manifest riêng; clip UUID/sentence UUID giữ nguyên khi sửa
mốc, không dùng vị trí/timestamp làm ID. Các câu không đè nhau, end<=duration, end>start.
YouTube chỉ embed khi người dùng bấm; không tải file hay giả định đọc được audio/pitch.
Màn xem batch phát file riêng và chọn câu theo mốc; không thay công cụ cắt clip/ghi âm
của g1/shadowing. Ba clip của bộ nghiệm thu vẫn cần người dùng chuẩn bị.

KanjiVG lưu path theo số nét liên tục, biến thể riêng. Preview chỉ vẽ d paths, nút
Nét tiếp để kiểm tra thứ tự; chưa thay animation/tập viết của g1. XML không đọc
external entities, SVG không được phục vụ nguyên dạng có script.

## 5. Transaction, báo cáo và giới hạn nghiệm thu

Schema/encoding/hash/IDs được kiểm tra trước khi áp dụng. Nếu database chưa có thì
tạo Draft 0.2; database version không phù hợp bị từ chối, **không tự migrate DB cũ**.
Trước cập nhật database có content, dùng SQLite backup API (không copy mù file WAL).
UPSERT trong BEGIN IMMEDIATE; lỗi rollback cả content/link/dịch của lượt áp dụng.
Không ghi vào srs_cards hoặc srs_reviews. Nguồn đổi làm bản dịch cũ needs_refresh,
không sửa text_vi; giữ lịch sử, chỉ đổi selected khi có bản thay thế phù hợp.

Chạy mặc định có thể ghi database batch **INCOMPLETE** để xem lỗi/queue. Muốn chặn
ghi content nếu đầu vào chưa đủ, dùng:

```sh
node tools/data/import.mjs --manifest data/private/batch-manifest.json --db data/batch.sqlite --report data/reports/batch.json --require-complete
```

Khi chưa đủ: exit 1, viết report/queue, db_committed=false; database mới có thể đã
khởi tạo schema rỗng. Lỗi checksum/schema xảy ra sớm có thể chưa sinh report.
Không được diễn giải “process exit 0” của chế độ xem batch thành nghiệm thu đạt.

Không tự retire record ở batch con. Tuỳ chọn manifest retire_complete_kinds chỉ cho
vocab/kanji/grammar khi không có cohort, đủ cả N1–N5 và complete_counts khớp. Chỉ
is_active=0, không xoá content/dịch/thẻ. Kiểm tra diff/backup trước khi dùng full import.

Report ghi counts/expected_counts, missing IDs, selection_method_counts, coverage HV,
Unihan status, pending MT và checksum manifest; không làm tròn coverage. Thiếu một
âm chính không bị loại khỏi mẫu số. `acceptance_status` **luôn NOT_RUN** trong report
của importer: data_complete và HV PASS chỉ là kiểm tra máy, không thay 11 bước nghiệm
thu, kiểm tra chất lượng ghép nghĩa, tra đủ mọi từ trong ví dụ, media, font trên điện
thoại và điền báo cáo Hán Việt thật của bạn. Lookup preview hiện tra phần từ đã nhập
trong batch và forms; **chưa có tokenizer/tra từ ngoài batch**. Chưa có adapter gọi
AI trực tiếp, dịch vụ audio/TTS hoặc nguồn IRODORI. Các phần đó không được đánh dấu đạt.

Kiểm thử tự động dùng fixture tự tạo, không dùng dữ liệu restricted. Smoke test local
đã nhập OpenJLPT N5 và cohort 100/50/20 chỉ với nguồn OpenJLPT, đúng trạng thái thiếu
nguồn bổ trợ; đây **không phải** báo cáo batch nghiệm thu và không được điền số HV từ đó.
`.gitignore` loại raw/database/backups/reports/requests/media riêng, không chỉ code.
