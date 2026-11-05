# Chính sách âm Hán Việt — HV-1.1

Revision **HV-1.1**, ngày 05/11/2026. Thay thế quy tắc cần người duyệt của HV-1.0. Hợp đồng dùng chung cho `g0/data-spec`, `g0/data-import` và màn
Kanji của `g1/kanji`. Đây là yêu cầu triển khai, chưa phải kết quả batch đã đo.

## 1. Gộp biến thể trước khi đếm nhiều âm

Giữ nguyên dữ liệu nguồn riêng tư để truy vết. Với trường âm Hán Việt của kanji:
NFC → lowercase → tách whitespace Unicode → bỏ rỗng/trùng → áp bảng alias **theo
toàn bộ âm tiết** → loại trùng lần nữa. Không áp thay thế chuỗi con hoặc áp vào
nghĩa, tên riêng, text Nhật, ID và cách đọc On/Kun.

Seed bảng alias phiên bản `hv-alias-1`, theo quy ước chính tả của dự án:

| Biến thể | Âm hiển thị chuẩn |
| --- | --- |
| nhựt | nhật |
| nhơn | nhân |
| sanh | sinh |
| tí | tý |

Không bỏ dấu hoặc suy quy tắc âm vị tổng quát từ bốn cặp này. Mở rộng bảng cần
entry có căn cứ, version mới và kiểm tra xung đột/vòng lặp. Ví dụ input chứa cả
`nhựt` và `nhật` chỉ còn một nhóm âm `nhật`; đây không còn là trường hợp đa âm thật.

Mỗi nhóm candidate lưu canonical_reading, raw_readings, danh sách source_record_keys,
source/release và normalization_events (`from`, `to`, alias rule/version) trong
context_json. Nhóm trùng sau gộp không tạo nhiều candidate giống nhau; source_record_key
của nhóm có thể là `<codepoint>|<canonical_reading>` trong từng source release,
context giữ các bank/row gốc. Không xoá thông tin âm gốc khi gộp.

## 2. Chuỗi chọn âm chính theo thứ tự ưu tiên

Chạy tuần tự trên tập candidate canonical của **cùng chữ**, dừng ngay khi một bước
chọn được đúng một âm. Mỗi bước đã thử ghi trong selection_trace (kết quả, lý do
chọn/bỏ qua, source/release). Không có bước nào được tạo âm ngoài tập candidate.

| Bước | selection_method | Quy tắc |
| --- | --- | --- |
| 1 | single_after_normalization | Còn đúng một âm sau NFC/gộp alias → chọn ngay; không phụ thuộc CVDICT, Unihan hay AI |
| 2 | cvdict_compound | Đếm các từ ghép tiếng Nhật khác nhau có bằng chứng CVDICT xác định âm của chữ. Chọn nếu chỉ một âm có bằng chứng; nếu nhiều âm có bằng chứng, chọn âm duy nhất có số từ ghép cao nhất và số đó >=2. Đồng hạng hoặc chưa đủ điều kiện → bước 3 |
| 3 | unihan_match | Khi tải và pin được Unihan.kVietnamese, chuẩn hoá bằng cùng bảng alias rồi lấy giao với candidates. Giao có đúng một âm → chọn; thiếu nguồn/không khớp/nhiều âm → bước 4. Không chọn âm đầu theo thứ tự Unihan khi chưa kiểm tra ý nghĩa thứ tự trên dữ liệu thật |
| 4 | ai_fallback | AI chọn một candidate_id trong danh sách đóng, kèm căn cứ từ ghép tiếng Nhật và nghĩa theo ngữ cảnh. Qua kiểm tra cấu trúc/membership/căn cứ → selected, không cần người duyệt; hiển thị nhãn “tự chọn” |

**Bằng chứng CVDICT:** đối chiếu từ ghép tiếng Nhật thật, reading và nghĩa tương
ứng với entry CVDICT; chỉ đếm khi giải quyết được âm của chính chữ đó. Pinyin
không phải Hán Việt; match mặt chữ hoặc nghĩa tiếng Trung đơn thuần chưa đủ để
suy ra âm. Mỗi từ ghép được đếm một lần, alias/hai cách viết cùng từ không được
thổi phồng số lượng. Lưu compound ID, word/reading, nghĩa, entry key, cách phân
giải âm và source release. Đây là heuristic chọn âm cho UI, không phải khẳng định
tần suất corpus. Không còn yêu cầu tải nguồn frequency/rank để chọn được âm.

Con số **khoảng 187 chữ** do chủ dự án cung cấp là ước lượng đầu vào cho bước 2,
chưa được coi là số đo batch hoặc chỉ tiêu phải khớp; báo cáo phải ghi số thực tế.

**Unihan:** lưu raw/normalized values và trạng thái not_attempted/not_available/
missing/no_match/ambiguous/unique_match. Không tải được thì ghi lỗi và đi tiếp AI,
không chặn batch chỉ vì Unihan không sẵn. Câu hỏi thứ tự âm có phản ánh độ thông
dụng vẫn mở: cần pin snapshot, mẫu kiểm tra, căn cứ độc lập và kết quả đo trước khi
đổi rule version để dùng thứ tự; không mặc định như vậy ở HV-1.1. Bước trước đã
chọn được âm thì không bắt buộc đợi đối chiếu Unihan.

**AI:** chỉ gửi dữ liệu cần thiết và được phép dùng; không gửi raw bank riêng tư
hoặc media chỉ để chọn âm. Prompt gồm chữ, candidate_id/âm canonical, nghĩa Nhật/Anh,
các từ ghép tiếng Nhật/reading có sẵn và bằng chứng bước trước. Output bắt buộc
candidate_id, từ ghép/cách đọc dùng làm căn cứ, giải thích theo nghĩa và lý do chọn.
Không tự coi suy luận AI là xác minh từ điển; căn cứ sinh bởi AI phải được ghi rõ
là model-generated. Nếu có dẫn chứng từ input thì lưu tham chiếu chính xác, không
cho phép AI bịa source/release ID. Không cần người duyệt; kiểm tra tự động phải
loại output sai schema, âm ngoài danh sách, căn cứ rỗng hoặc tham chiếu input giả.
Output lỗi có thể retry hữu hạn theo cấu hình đã ghi; hết retry thì unresolved,
batch chưa đạt 100%, không lấy âm đầu/ngẫu nhiên để lấp chỗ trống.

## 3. Lưu lựa chọn, nguồn AI và giao diện

Selected lưu vi_translations.field='han_viet', status='selected', text_vi là **một
âm canonical** trong danh sách chữ đó. Giữ mọi âm khác dưới dạng candidate; dedup
theo canonical khi hiển thị. Chọn âm chính cho kanji không quyết định âm của mọi
từ ghép; phần ghép Hán Việt cho từ vẫn phân giải theo từng từ/reading.

context_json bắt buộc có canonical_reading, candidate_readings, candidate_ids,
raw_readings, alias_rules_version, selection_rule_version='HV-1.1', selection_method,
selection_trace và evidence theo bước đã chọn. Không bắt bước 1 phải có bằng chứng
CVDICT/Unihan; evidence của bước 1 là danh sách còn đúng một âm và provenance nguồn.
Khi chưa thử Unihan ghi not_attempted; không giả là đã đối chiếu.

Với ai_fallback, tạo selected **riêng** có method='machine',
match_method='machine_context', source_id='mt:<provider thực tế>', release model/
prompt/config đã pin theo data-spec. Giữ candidate gốc từ dictionary, không đổi
nhãn nguồn dictionary thành AI và không ghi lý do AI như dữ liệu từ điển đã xác nhận.
context ghi input/base hash, candidate gốc, output có cấu trúc, model/prompt version,
căn cứ và lý do. Cache theo item/field/base_content_hash/MT release/candidate-set hash/
selection rule version; thay candidates hoặc alias phải kiểm tra membership và tính
lại khi cần. Giữ lịch sử quyết định, ID content và SRS khi thay âm chính.

Mỗi kanji hiển thị âm chính **in đậm**, các âm khác nhỏ hơn bên cạnh, tự xuống dòng
trên điện thoại, đủ tương phản, không giấu sau “xem thêm”. Riêng ai_fallback có nhãn
nhỏ **“tự chọn”** sát âm chính, giải thích đó là lựa chọn AI khi mở nguồn/căn cứ.
Có nút **Báo sai**, ghi translation_reports trỏ đúng translation_id selected; không
cần người duyệt trước khi hiển thị và không cho sửa bản ghi nguồn trực tiếp.
Label hỗ trợ đọc màn hình phân biệt âm chính/âm khác/tự chọn; không chỉ dùng màu.

Alias đã gộp không hiển thị như âm khác; phần Nguồn có dạng gốc, nguồn và lý do chọn.
UI dùng quyết định đã lưu, không gọi AI hoặc tự chọn lại khi mở trang.

## 4. Báo cáo batch và điều kiện nghiệm thu

Cohort gồm **toàn bộ manifest kanji phải nhập**, kể cả chữ nhập lỗi/thiếu âm. Batch
thử dự kiến 50 chữ; full N5–N2 theo manifest thực tế (snapshot đã khảo sát: 1.038).
Không giảm mẫu số để nâng coverage; kanji_total phải >0.

| Chỉ số | Định nghĩa |
| --- | --- |
| kanji_total | Số codepoint duy nhất trong cohort |
| multi_before_alias / multi_after_alias | Số chữ có >1 âm trước/sau alias trên cùng cohort, sau NFC/tách/dedup |
| variants_collapsed_kanji | Số chữ giảm số nhóm âm nhờ alias |
| primary_selected / primary_coverage | Số chữ có đúng một selected hợp lệ / kanji_total ×100 |
| selection_method_counts | Số selected theo bốn method, mỗi chữ chỉ tính một lần ở bước đã chọn |
| cvdict_evidence_counts | Số chữ chọn do only_one_supported hoặc unique_max_ge_2; số từ ghép/âm trong báo cáo chi tiết |
| unihan_status_counts | Số chữ theo trạng thái đã thử/bỏ qua/thiếu/không khớp/nhiều/khớp một |
| unresolved / missing_readings / multiple_selected | Số chữ chưa phân giải/không có candidate/nhiều selected |
| missing_selection_method / outside_candidate_set / invalid_evidence | Số chữ thiếu method, chọn ngoài danh sách, thiếu/sai căn cứ bắt buộc theo method |

**PASS:** primary_selected == kanji_total >0 (**100%**, không làm tròn); tổng bốn
selection_method_counts == primary_selected; mọi bộ đếm lỗi bằng 0; đặc biệt
outside_candidate_set ==0. Selected không rỗng, needs_refresh=0, base_content_hash
khớp hiện hành, rule/alias/source release đầy đủ. AI có căn cứ và provenance theo
mục 3 được tính hợp lệ mà không cần người duyệt. Unihan unavailable/missing không
phải lỗi nghiệm thu nếu lựa chọn đã hoàn tất qua bước khác. multi_after_alias phải
<= multi_before_alias; không bịa số giảm hoặc ép bước CVDICT phải bằng 187.

Test importer: alias/NFC; một candidate chọn ngay; CVDICT chỉ một âm có bằng chứng,
unique max >=2, đồng hạng, đếm trùng từ; Unihan giao một/nhiều/không có, lỗi tải và
không suy từ thứ tự; AI đúng/sai candidate, thiếu căn cứ, source ID bịa, retry/cache;
đa âm 大/行/長; method totals và 100%; idempotence giữ SRS. Kiểm tra UI có “tự chọn”,
âm phụ và Báo sai đúng translation_id. Bằng chứng restricted giữ riêng, Git chỉ
nhận quy tắc và thống kê được phép chia sẻ. Chưa chạy batch không đánh dấu PASS.

Ngưỡng này áp dụng cho **kanji**, không buộc từ đọc Kun có âm Hán Việt ghép.
