# Import dữ liệu và batch thử

- **Nhánh:** `g0/data-import`
- **Giai đoạn:** Giai đoạn 0 – Nền dữ liệu (làm ngay)
- **Phụ thuộc:** `g0/data-spec`
- **Tài liệu gốc:** Kế hoạch phát triển mục 4.2–4.4, Đặc tả v2 mục 14 (trên Claude: [Đặc tả chức năng v2](https://claude.ai/artifact/4ApVpJNZA9s3311eurPcCX), [Kế hoạch phát triển](https://claude.ai/artifact/HarDe5qR2isfbLRypcAboS), [Lộ trình N5 → N2](https://claude.ai/artifact/5eT7QNEDrNDnXousnhTbHb); chỉ mở được bằng tài khoản Claude của chủ dự án)

Tài liệu này đọc riêng được: mọi quyết định cần cho nhánh đều nằm ở đây.

## Mốc code 0.1 — chờ chạy 11 bước nghiệm thu

Đã merge `g0/data-spec` (Draft 0.2 + HV-1.2) và có importer Node 24/SQLite trong
`tools/data/`. [Hướng dẫn chạy, manifest và adapter](../data/importer.md).
Đã có 34 kiểm thử tự động bằng fixture tự tạo: schema, adapter, HV-1.2, AI result/cache,
transaction, bảo toàn SRS/bản dịch và màn xem batch loopback. Smoke test OpenJLPT thật
không có các nguồn bổ trợ vẫn được ghi INCOMPLETE, không thay báo cáo nghiệm thu.

AI hiện nhận file kết quả theo request_id, chưa tự gọi API provider. Lookup preview
chỉ tra nội dung đã nhập, chưa có tokenizer/full dictionary. Clip riêng và dữ liệu
bổ trợ cần được cung cấp qua manifest. Các tiêu chí dưới đây giữ chưa đánh dấu đến
khi bạn chạy đủ 11 bước và điền số liệu thực tế, không tự chuyển schema sang Frozen.

## Mục tiêu

Viết script nhập dữ liệu từ các nguồn vào SQLite, chạy thử trên một batch nhỏ có chủ đích, đo chất lượng rồi mới nhập toàn bộ N5–N1.

## Chức năng

- [ ] Script tải và ghi checksum từng nguồn, ghi vào `data_sources`
- [ ] Nhập OpenJLPT (từ, kanji, ngữ pháp, câu ví dụ) giữ nguyên ID
- [ ] Khớp nghĩa tu-dien-nhat-viet: tra theo mặt chữ → cách đọc → **mọi cách viết của JMdict** (363 từ kana-only N5–N2 chỉ có dưới dạng kanji trong từ điển)
- [ ] Xử lý **22 từ cùng chữ khác cách đọc** (方 かた/ほう, 一日, 今日…): không dùng nghĩa từ điển, đánh dấu cần dịch máy theo cách đọc
- [ ] Âm Hán Việt kanji từ KanjiDictVN; **nghĩa kanji dịch từ nghĩa tiếng Anh của OpenJLPT** (KanjiDictVN sai nghĩa với kanji Nhật tự tạo, ví dụ 働)
- [ ] Ghép âm Hán Việt cho từ đọc âm On (勉強 → MIỄN CƯỜNG); từ đọc Kun để trống
- [ ] Dịch máy phần còn thiếu một lần, lưu lại, kèm cách đọc + Hán Việt + câu ví dụ làm ngữ cảnh
- [ ] Chuẩn hoá NFC mọi chữ Việt; còn bản ghi không phải NFC thì dừng và báo lỗi
- [ ] Chạy lại import (giả lập cập nhật tháng sau) không mất bản dịch, tiến độ SRS

## Dữ liệu

**Bổ sung bắt buộc — âm Hán Việt (HV-1.2):**

- [ ] Gộp alias có version (nhựt→nhật, nhơn→nhân, sanh→sinh, tí→tý), giữ dạng gốc.
- [ ] Chọn âm tuần tự theo [HV-1.2](../data/han-viet-policy.md): một âm sau gộp →
  CVDICT có căn cứ từ ghép → Unihan khi tải được → AI có căn cứ, không cần người duyệt.
- [ ] Ghi selection_method: single_after_normalization, cvdict_compound,
  unihan_match, ai_fallback; mỗi chữ chỉ ghi một method đã chọn, giữ trace bước đã thử.
- [ ] Bước CVDICT chỉ chọn âm dẫn đầu duy nhất có >=2
  từ ghép khác nhau. Đồng hạng/chưa đủ điều kiện đi tiếp. “Khoảng 187 chữ” là ước
  lượng do chủ dự án cung cấp, phải đo lại, không phải số liệu đã xác nhận.
- [ ] Không suy độ thông dụng từ thứ tự âm Unihan khi chưa đo. Unihan không tải
  được/thiếu/không phân giải được thì đi tiếp AI, không buộc người duyệt.
- [ ] AI chọn trong danh sách đóng, kèm căn cứ từ ghép Nhật/nghĩa; nguồn mt:<provider>,
  release model/prompt/config, nhãn “tự chọn”, giữ âm phụ và nút Báo sai.
- [ ] UI batch: âm chính đậm, âm phụ nhỏ bên cạnh; không giấu thông tin đa âm.

### Báo cáo Hán Việt bắt buộc

Theo [HV-1.2](../data/han-viet-policy.md), dùng
[mẫu báo cáo](../data/han-viet-batch-report.template.md); cohort cố định từ manifest.
Ghi số đa âm trước/sau alias, coverage và **số lượng theo từng selection_method**.
Tổng bốn method phải bằng số chữ có selected; mỗi chữ chỉ tính ở bước chọn thành công.

Chỉ PASS khi **100% kanji có đúng một âm chính**, method hợp lệ, đủ provenance/căn
cứ theo method, không stale, **không chữ nào chọn ngoài danh sách âm canonical của
chính chữ đó**. Không làm tròn/loại chữ lỗi khỏi mẫu số. Không cần người duyệt AI;
output sai schema/membership/căn cứ phải retry hữu hạn, hết retry batch chưa đạt.
Unihan không sẵn không chặn nghiệm thu nếu bước khác chọn được hợp lệ.

Test: alias/NFC; CVDICT một âm có căn cứ/unique max >=2/đồng hạng/trùng từ;
Unihan một/nhiều/không giao, lỗi tải, thứ tự; AI trong/ngoài danh sách, căn cứ, cache,
retry; method totals/100%; UI “tự chọn” và Báo sai; 大/行/長; idempotence giữ SRS.

**Batch thử (chọn có chủ đích, không ngẫu nhiên):**

| Loại | Số lượng | Trường hợp phải có |
| --- | --- | --- |
| Từ | 100 (80 N5 + 20 N2) | Nhiều cách đọc, chỉ kana, katakana, động từ する, cùng chữ khác nghĩa, không có câu ví dụ, nhiều cách viết |
| Kanji | 50 | Nhiều âm On/Kun, kanji Nhật tự tạo (働), thiếu `kVietnamese`, có biến thể KanjiVG |
| Ngữ pháp | 20 | Mẫu ngắn và dài, cặp dễ nhầm, nhiều công thức nối |
| Clip shadowing | 3 | 1 Erin, 1 file phim cá nhân, 1 YouTube |

## Quy tắc và ràng buộc

- Script chạy lại được nhiều lần (idempotent).
- Dữ liệu nguồn và database tải về **không commit vào repo** (thêm vào `.gitignore`).

## Không làm trong nhánh này

- Giao diện hoàn chỉnh; chỉ cần giao diện thô để xem batch thử.

## Tiêu chí hoàn thành

- [ ] 100% từ có cách đọc, nghĩa, cấp JLPT
- [ ] Mọi kanji có animation nét
- [ ] Popup tra từ ra kết quả cho mọi từ trong câu ví dụ
- [ ] Chạy lại import không làm mất bản dịch và tiến độ SRS
- [ ] 3 clip shadowing chạy được với phụ đề chia câu
- [ ] 100% kanji có âm Hán Việt; mọi từ và mẫu ngữ pháp có nghĩa tiếng Việt
- [ ] 100% chữ tiếng Việt ở dạng NFC và hiển thị đúng dấu trên Chrome Android, Safari iOS

Điều kiện nghiệm thu Hán Việt bổ sung:

- [ ] 100% kanji trong cohort có đúng một âm chính, selection_method hợp lệ,
  tổng số lượng theo bốn method khớp; số chọn ngoài candidate của chữ bằng 0.
- [ ] Giữ các âm khác; báo cáo đa âm trước/sau alias và provenance/căn cứ của lựa chọn.
- [ ] UI xem batch: âm chính đậm, âm phụ nhỏ, AI có nhãn “tự chọn” và Báo sai trỏ
  đúng translation_id; không cần người duyệt trước khi hiển thị.

## Câu hỏi còn mở

- Chọn mô hình AI và ngân sách cho dịch máy.
- Đo tỉ lệ câu ví dụ có sẵn bản tiếng Việt trên Tatoeba.
- Độ phủ giải thích ngữ pháp IRODORI tiếng Việt (chờ file).

## Bối cảnh chung (tóm tắt)

- Web học tiếng Nhật **cho riêng một người dùng**, miễn phí, không kinh doanh, **không công khai** (bắt buộc đăng nhập mọi trang).
- Chạy trên VPS nhỏ hoặc máy nhà + Tailscale; dùng chủ yếu trên điện thoại dưới dạng PWA.
- Lộ trình N5 → N2: 87 tuần, bắt đầu 02/11/2026; thi N4 04/07/2027 (tuỳ chọn), N3 05/12/2027, N2 02/07/2028.
- Nhịp ngày đi làm: **ban ngày 5–10 phút Ôn nhanh** (chỉ thẻ từ vựng + kanji, không âm thanh); **buổi tối 45–60 phút** cho bài mới, ngữ pháp, dạng đề JLPT, shadowing.
- Bắt buộc **2 buổi shadowing/tuần** (Thứ Ba, Thứ Năm; Thứ Bảy khuyến khích). Thiếu buổi → khoá bài mới tuần sau; **ôn tập SRS không bao giờ bị khoá**.
- Người dùng là người học, **không biên tập nội dung**: tiếng Việt lấy từ nguồn có sẵn, phần thiếu dùng dịch máy (luôn kèm bản tiếng Anh và nút Báo sai).
