# Báo cáo Hán Việt của batch — HV-1.1

Trạng thái **NOT_RUN**, mọi giá trị bên dưới chưa đo. Không dùng mẫu làm bằng chứng PASS.
Quy tắc: [HV-1.1](han-viet-policy.md). Không yêu cầu người duyệt lựa chọn AI.

## Manifest

- Batch/run ID, thời gian, manifest cohort/checksum/phạm vi:
- Releases/checksums của nguồn readings, CVDICT, Unihan (hoặc lý do không sẵn):
- Alias version, selection rule version, cấu hình CVDICT evidence/tie:
- MT provider, model/prompt/config release; input/candidate-set hashes, retry/cache config:
- Kết quả kiểm tra thứ tự Unihan (nếu đã khảo sát; chưa khảo sát ghi rõ):
- Nơi giữ bằng chứng riêng tư, không secrets hoặc URL có token:

## Số đo thực tế

| Chỉ số | Giá trị |
| --- | --- |
| kanji_total (>0, kể cả chữ lỗi/thiếu âm) | Chưa đo |
| multi_before_alias / multi_after_alias | Chưa đo |
| variants_collapsed_kanji | Chưa đo |
| primary_selected / primary_coverage (%) | Chưa đo |
| single_after_normalization | Chưa đo |
| cvdict_compound | Chưa đo |
| unihan_match | Chưa đo |
| ai_fallback | Chưa đo |
| Tổng bốn selection_method | Chưa đo |
| CVDICT: only_one_supported / unique_max_ge_2 | Chưa đo |
| Unihan: not_attempted / not_available / missing / no_match / ambiguous / unique_match | Chưa đo |
| unresolved / missing_readings / multiple_selected | Chưa đo |
| missing_selection_method / outside_candidate_set / invalid_evidence | Chưa đo |
| AI: invalid output / retry / cache hit | Chưa đo |

PASS: primary_selected == kanji_total >0 (100%, không làm tròn); tổng bốn method
== primary_selected; mọi bộ đếm lỗi nghiệm thu bằng 0, đặc biệt outside_candidate_set=0.
AI qua kiểm tra tự động được tính hợp lệ, không cần người duyệt. Unihan không sẵn
không phải lỗi nếu chọn thành công bằng bước khác. CVDICT “~187 chữ” là ước lượng
đầu vào, không ép số liệu thực tế khớp. multi_after_alias <= multi_before_alias.

## Bằng chứng và kiểm tra

- Candidate canonical và trace chọn âm theo thứ tự ưu tiên; không âm nào nằm ngoài tập:
- CVDICT: từ ghép khác nhau, reading/nghĩa, entry IDs, bằng chứng âm, counts/tie:
- Unihan: snapshot, raw/normalized values, giao candidates, kết quả/lỗi tải:
- AI: candidate_id/output, căn cứ từ ghép Nhật/nghĩa, phân biệt căn cứ model-generated
  và nguồn input; MT release, hash, kiểm tra membership/cấu trúc/tham chiếu, retry/cache:
- Alias/NFC, đa âm 大/行/長, thiếu/bất đồng, không suy từ thứ tự Unihan:
- Không stale; chạy lại không mất selected/provenance/SRS:
- UI: âm chính đậm/âm phụ nhỏ, nhãn “tự chọn”, Báo sai đúng translation_id:
- Kết quả cuối: Chưa đánh giá; nếu FAIL nêu lỗi và xử lý, không giảm cohort.
