# Chính sách âm Hán Việt — HV-1

Ngày 05/11/2026. Hợp đồng dùng chung cho `g0/data-spec`, `g0/data-import` và màn
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

## 2. Chọn đúng một âm chính, có căn cứ

- Một nhóm còn lại: chọn âm canonical sau kiểm tra codepoint và nguồn; ghi
  selection_method=`single_after_normalization` cùng phiên bản alias và nguồn đối chiếu.
- Nhiều nhóm thật sự (phải có 大, 行, 長 trong bộ kiểm tra): ưu tiên âm được xác nhận
  trong từ ghép tiếng Nhật phổ biến, đối chiếu `Unihan.kVietnamese` sau cùng quy tắc
  chuẩn hoá. Lưu chính từ ghép, ID từ, cách đọc Nhật, cách phân bổ âm Hán Việt cho
  từng chữ và nguồn chứng minh âm của chữ trong từ đó. Không suy Hán Việt từ pinyin.
- “Phổ biến nhất” phải dựa trên nguồn tần suất/rank được pin version và checksum;
  rank và quy tắc xếp thứ tự phải có trong báo cáo. Không coi thứ tự `kanji.words`,
  thứ tự JSON hay cấp JLPT là tần suất thực tế. Nếu chỉ có mức JLPT thì ghi rõ đó là
  proxy, không tự khẳng định từ phổ biến nhất.
- Với nhiều từ cùng rank hoặc thiếu dữ liệu tần suất/âm trong từ ghép, dùng quyết
  định được rà soát có rule/override version, lý do, nguồn và người rà soát. Nếu
  Unihan thiếu hoặc bất đồng, lưu `missing`/`conflict` cùng căn cứ từ nguồn độc lập;
  không ghi là đã đồng thuận. Chưa có căn cứ đủ dùng thì để unresolved và batch fail.
- Không chọn âm đầu, âm xuất hiện nhiều nhất trong phần nghĩa, thứ tự alphabet,
  hoặc một giá trị dịch máy chưa xác minh để chạy cho đủ 100%.

Trường được chọn trong schema: `vi_translations.field='han_viet'`, `status='selected'`,
`text_vi` là **một âm canonical**. Các âm khác giữ `candidate`, không chuyển thành
`rejected` chỉ vì không phải âm chính. Chọn âm chính là quy ước hiển thị cho kanji;
không khẳng định âm đó đúng cho mọi từ ghép. Khi ghép Hán Việt cho từ, vẫn phân giải
theo từng từ/reading, không ghép máy móc âm chính của mọi chữ.

context_json của selected phải có:

- `canonical_reading`, `raw_readings`, `alias_rules_version`, `selection_rule_version`.
- `selection_method`: `single_after_normalization`, `compound_frequency` hoặc `reviewed_override`.
- `evidence`: các source/release/record key; với compound_frequency có compound ID,
  word/reading, âm đã phân giải, rank, frequency source/release và quy tắc chọn/tie.
- `unihan_check`: release, giá trị gốc, giá trị đã chuẩn hoá và kết quả
  `agrees`/`conflict`/`missing`; trường hợp conflict/missing phải kèm nguồn bổ sung
  và lý do rà soát. Thiếu nguồn pin chưa được coi là missing đã kiểm tra.
- Với reviewed_override có người rà soát, ngày, lý do và override version.

Nguồn vẫn là dictionary/Hán Việt thực tế, không đổi thành nguồn “người dùng” chỉ vì
có quyết định chọn âm. Bằng chứng chứa dữ liệu restricted ở báo cáo riêng tư; Git
chỉ nhận policy, quy tắc được phép chia sẻ và thống kê tổng hợp.

## 3. Hợp đồng giao diện

Mỗi kanji hiển thị âm chính **in đậm**, các âm canonical còn lại cỡ nhỏ hơn bên cạnh,
cùng một hàng nếu đủ chỗ, tự xuống dòng trên điện thoại. Không ẩn âm khác sau nút
“xem thêm”; vẫn đọc được và đủ tương phản. Label cho công nghệ hỗ trợ phân biệt
“Âm chính” và “Âm khác”, không dùng riêng cỡ chữ/màu làm thông tin.

Các alias chính tả đã gộp không hiển thị như những âm khác nhau. Chi tiết Nguồn có
thể mở các dạng gốc, nguồn và lý do chọn. UI dùng cùng một snapshot selection của
importer, không tự chọn lại âm. Ví dụ 大/行/長 chỉ được điền âm thật sau khi có căn cứ;
policy không bịa đáp án mẫu thay cho dữ liệu.

## 4. Báo cáo batch bắt buộc và điều kiện 100%

Cohort là **toàn bộ danh sách kanji phải nhập trong manifest**, không chỉ các dòng
đã nhập thành công. Batch thử dự kiến 50 chữ; full N5–N2 dùng số thực tế của manifest
(snapshot hiện khảo sát có 1.038). Không giảm mẫu số bằng cách loại chữ khó/thiếu âm.

| Chỉ số | Định nghĩa |
| --- | --- |
| `kanji_total` | Số codepoint duy nhất trong cohort, phải > 0 |
| `multi_before_alias` | Số chữ có >1 âm sau NFC/tách/dedup, **trước** bảng alias |
| `multi_after_alias` | Số chữ còn >1 nhóm canonical **sau** alias/dedup, cùng cohort |
| `variants_collapsed_kanji` | Số chữ có số nhóm âm giảm nhờ alias |
| `primary_selected` | Số chữ có đúng một selected hợp lệ, không rỗng, không stale |
| `primary_coverage` | `primary_selected / kanji_total * 100` |
| `unresolved`, `missing_readings`, `multiple_selected`, `missing_evidence` | Số chữ của từng lỗi; liệt kê ID/lý do trong báo cáo riêng |
| `unihan_agrees/conflict/missing`, `reviewed_overrides` | Thống kê đối chiếu và số quyết định cần rà soát |

Selected chỉ hợp lệ nếu âm nằm trong nhóm candidate đã chuẩn hoá, context đủ căn
cứ theo mục 2, `needs_refresh=0`, `base_content_hash` khớp nội dung nền hiện hành và
version policy/alias/rank source đã ghi. `multi_after_alias <= multi_before_alias`;
giữ số liệu trước/sau ngay cả khi hai số bằng nhau, không dự đoán số giảm trước khi đo.

**PASS bắt buộc:** `primary_selected == kanji_total > 0` (**100% chính xác**, không làm
tròn 99,x% thành 100%), mọi bộ đếm lỗi ở trên bằng 0, và kiểm tra trước/sau alias
nhất quán. Có thể có Unihan conflict/missing nếu từng trường hợp đã được rà soát với
căn cứ độc lập; không được biến chúng thành đồng thuận giả. Báo cáo thiếu các số đo
hoặc chỉ ghi “đã đủ âm” là chưa đạt. Không dùng âm placeholder, chuỗi ghép nhiều âm
hoặc chọn ngẫu nhiên để đạt tỉ lệ.

Test importer phải có các cặp alias ở trên (kể cả input có cả hai dạng), Unicode
tổ hợp, đa âm thật 大/行/長, thiếu/bất đồng Unihan, đồng hạng tần suất, thiếu căn cứ,
và chạy lại không đổi selected nếu nguồn/quy tắc không đổi. Đổi alias/policy/nguồn
thì báo diff selection và giữ lịch sử/provenance, không ảnh hưởng ID hay tiến độ SRS.

Ngưỡng này áp dụng cho **kanji**, không buộc từ đọc Kun phải có Hán Việt ghép.
