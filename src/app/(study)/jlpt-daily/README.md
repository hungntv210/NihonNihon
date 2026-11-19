# JLPT mỗi tối — generator v2

`/jlpt-daily` chỉ đọc kho đã duyệt, không gọi AI khi mở trang. Mục tiêu 10
câu/ngày; thiếu thì hiện số thật và thông báo, không lặp hay tạo câu để lấp chỗ.
Giữ kiểm session/Origin/thứ tự/gửi lặp, không lộ key trước khi trả lời.

## Sinh từ nguồn, kiểm độc lập

`generate-v2.ts` thay luồng AI viết câu trong `generate-week.ts` và
`draft-roadmap.ts`. File cũ giữ để đọc/checkpoint/test tương thích; không dùng
để sinh thêm đề. V2 không gọi model với phase generate.

| Dạng | Nguồn và nhiễu |
|---|---|
| reading | Reading từ đã học; trường âm, âm ngắt, dakuten/handakuten, On khác, reading từ đã học chung kanji |
| spelling | Kana nguồn; đồng âm, chữ gần hình hoặc thay đúng một kanji đã học |
| grammar | Khoét nguyên mẫu trong câu nguồn; nhiễu cùng nhóm trong confusion-groups.ts, chỉ mẫu đã học |
| order ★ | Bốn cụm liên tiếp quanh mẫu; giữ ngữ cảnh, ghép lại đúng nguyên câu |
| context | Câu nguồn của từ đã học; nhiễu từ đã học cùng từ loại |

Tuần dùng các dạng có dữ liệu, tối thiểu reading + spelling + grammar + order,
không còn yêu cầu đủ tám dạng. Synonym/usage/paragraph chưa đủ bằng chứng nên bỏ.
Ngày đủ phải có 10 câu, ≥3 dạng và từ/ngữ pháp. Ngày thiếu lưu partial; không bịa
cho đủ 70 và không xuất bản tuần thiếu.

Nhiễu reading/spelling dùng luật nguồn v2 thay hai kiểm tra hàng xóm từ điển
cũ. Các cổng khác vẫn dùng chung: bốn lựa chọn khác nhau, một key, không Latin/
ghi chú trong lựa chọn, đánh dấu từ đích, không kanji chưa học, không từ tự chế,
đúng từ loại, không lộ key trong stem, lời giải khớp, order dùng đủ mọi mảnh.
Gate kanji giữ hợp ký tự trong title/reading của catalog đã cấp. Từ điển ngữ
cảnh chỉ N5, không cấp phép từ đích ngoài roadmap. Theo quyết định chủ dự án
và tester ngày 19/11/2026, grammar/order chống lặp 30 ngày theo stem/câu nền
chuẩn hóa NFKC, kể cả đổi vị trí khoét/★ hoặc đổi mẫu đích trong cùng câu.
Cùng mẫu được hỏi lại bằng câu khác. reading/spelling/context vẫn chống lặp
theo từ đích. Kiểm cả lịch sử kho duyệt chưa xếp lịch, các câu đã nhận trong
cùng tuần và batch đang chọn; không nới cổng chất lượng hay cơ cấu ngày/tuần.

Lời giải cố định từ reading/nghĩa Việt selected kèm nguồn/model (hoặc nghĩa Anh
OpenJLPT). Dòng nghĩa selected có Báo sai chưa xử lý trong Frozen hoặc DB app
bị loại trước verifier; đối chiếu đúng dòng theo mục/hash/nguồn/release/nội dung,
không dùng nghĩa đó trong câu hỏi hay giải thích. Thống kê ghi
TRANSLATION_REPORTED_OPEN theo số ứng viên/ngày bị chặn (không phải số report).
Nhãn ngữ pháp chỉ lấy từ ví dụ gắn trực tiếp với mẫu nguồn; ví dụ mượn từ mục
khác chỉ hiện đáp án, câu hoàn chỉnh và thứ tự, không suy nghĩa qua chuỗi con.
Câu ví dụ cần nguồn/release/hash, ghép lại nguyên
văn; chỉ đổi kanji chưa học sang kana khi có reading nguồn, không đoán cách đọc.

Verifier chỉ nhận stem/lựa chọn, không thấy key/lời giải/bằng chứng nhiễu.
Hai lượt: giải/chấm tất cả lựa chọn, rồi chấm mỗi lựa chọn riêng. Mơ hồ, khác
key, sai ngữ pháp/thể/kiến thức/tự nhiên đều loại, lưu audit, không sửa câu.
Code sinh xác định nên verifier không phải model tác giả. Verifier vẫn có thể
sai: tất cả là nháp chờ tester, không tự import.

## Vận hành riêng tư

```powershell
node --env-file=.env --import tsx 'src/app/(study)/jlpt-daily/generate-v2.ts' `
  --content data/private/frozen.sqlite --receipt data/private/frozen-receipt.json `
  --learning data/demo.sqlite --mode draft_roadmap --week 2026-11-16 --weeks 2 `
  --config data/private/jlpt-config.json --output data/private/jlpt-v2
```

Frozen phải read-only và khớp path/SHA-256 receipt. --survey chỉ đọc, không gọi
API. --mode srs mặc định: lượt ôn thật tới cuối đúng ngày Việt Nam. draft_roadmap
là nháp được chủ dự án duyệt: chia mục mỗi loại trong tuần theo ngày, không lấy
ngày sau; ghi mode trong bank/thống kê/review, không giả lịch sử ôn. Giữ nhánh
SRS thật cho khi có lịch sử.

Config riêng dùng model/hạn mức đã duyệt: model=verifierModel, fallbacks,
requestsPerMinute, dailyBudget, timeoutMs, maxOutputTokens, ledgerFile. Không
hard-code model. Key chỉ từ môi trường. Sổ Pacific hiện có đếm cả lỗi; 503 tối
đa ba lần cách 30/60s rồi dự phòng; 429/hết ngân sách dừng có checkpoint. Không
reset quota, không retry vô hạn.

Cùng input có cùng ứng viên. Checkpoint khóa hash nguồn/ngữ cảnh/lịch sử/prompt;
resume không nhận lại câu đã đạt/loại. bank-<tuần>.json, review-<tuần>.html,
audit từng lựa chọn, survey.md, draft-run-statistics.md chỉ ở data/private/.
--fixture --no-verifier chỉ dùng test, ghi unverified_fixture, không xuất bản.
Unit/browser/CI dùng fixture, không gọi API thật. Không đọc đề thi có bản quyền.

## Câu sai và lưu trữ

Câu sai enqueue reading/recall/cloze cho ngày hôm sau; thẻ có lịch xa hơn được
đưa về ngày hôm sau, giữ lịch sử và thông số FSRS. Phiên đầy đủ nhận cloze;
Ôn nhanh chỉ recognition. Unit/browser cố định đồng hồ server lẫn trình duyệt,
chấm sai rồi thực sự ôn cả reading và grammar ngày sau.

Kho duyệt/kết quả dùng NIHON_JLPT_PATH hoặc private/jlpt-daily cạnh DB và đã
thuộc backup học tập. V2 không ghi DB app/kho duyệt, không đổi schema/cổng đã
học của app hay quy trình tester duyệt/import riêng.

Use --supplement with a separate output directory and the approved store to fill
only grammar/order vacancies on their assigned dates. Each type is capped at
three per ten-question day. For the next regular week, --prior-drafts can add
a previous draft directory to collision history. Reviews remain private.
Both solver and validator use zero-based indexes. The blind order payload lists
all 24 reconstructions grouped by star choice. Polite predicates stay together.
Grammar gaps can use a sourced example linked to an eligible vocabulary item.
The pinned OpenJLPT N5 grammar JSON has pattern, meaning, formation, examples,
tags and notes; it supplies no separate similar-expressions list.
