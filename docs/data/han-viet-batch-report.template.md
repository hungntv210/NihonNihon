# Báo cáo Hán Việt của batch

Trạng thái: **NOT_RUN — mẫu chưa có số đo**. Không dùng mẫu này làm bằng chứng đã đạt.
Quy tắc: [HV-1](han-viet-policy.md). Điền sau khi chạy batch thật.

## Manifest và phiên bản

- Batch/run ID, thời gian:
- Manifest cohort, checksum, phạm vi (batch thử/full N5–N2):
- Source release/checksum: OpenJLPT, KanjiDictVN, Unihan, nguồn bổ sung:
- Alias rules version/checksum:
- Selection rule version, override version:
- Nguồn frequency/rank, version/checksum, quy tắc xếp thứ tự và tie:
- Nơi giữ bằng chứng chi tiết riêng tư (không ghi secrets/URL có token):

## Số đo bắt buộc

| Chỉ số | Giá trị thực tế |
| --- | --- |
| kanji_total (>0; toàn cohort kể cả dòng lỗi) | Chưa đo |
| multi_before_alias | Chưa đo |
| multi_after_alias | Chưa đo |
| variants_collapsed_kanji | Chưa đo |
| primary_selected (đúng một selected có căn cứ, không stale) | Chưa đo |
| primary_coverage (%) | Chưa đo |
| unresolved | Chưa đo |
| missing_readings | Chưa đo |
| multiple_selected | Chưa đo |
| missing_evidence | Chưa đo |
| unihan_agrees / conflict / missing | Chưa đo |
| reviewed_overrides | Chưa đo |

Điều kiện PASS: `primary_selected == kanji_total > 0` (100%, không làm tròn), bốn
bộ đếm lỗi bằng 0, `multi_after_alias <= multi_before_alias`, đủ căn cứ theo HV-1.

## Đối chiếu và kiểm tra

- Các cặp alias: input có một hoặc cả hai dạng; NFC/tổ hợp; không bỏ dấu đại trà:
- Đa âm thật 大/行/長: candidate canonical, âm chính, từ ghép/reading/rank, nguồn
  phân giải âm Hán Việt, đối chiếu Unihan và lý do lựa chọn (giữ chi tiết riêng tư):
- Unihan thiếu/bất đồng, rank đồng hạng/thiếu, trường hợp rà soát và nguồn độc lập:
- Selected thuộc tập canonical, context đủ provenance, hash hiện hành, không stale:
- Chạy lại: diff selected/provenance, SRS trước/sau:
- UI: âm chính đậm, âm khác nhỏ bên cạnh; không giấu âm khác, có nguồn/lý do:
- Kết quả cuối: Chưa đánh giá. Khi FAIL ghi ID/lý do và hành động xử lý; không giảm cohort.
