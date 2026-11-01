# Thiết kế giao diện Nihon Nihon: 8-bit Nhật × bóng đá

Ngày: 01/11/2026 · Trạng thái: đã duyệt (01/11/2026) · Áp dụng cho: prototype trong `prototype/`, và sau đó là bản web thật

## 1. Ý đồ

Nihon Nihon là web học tiếng Nhật cho người Việt. Đặc tả chức năng và lộ trình N5 → N2 đã có sẵn trên Claude chat. Bản prototype đầu tiên (`prototype/`) dùng phong cách tối giản, sạch nhưng "nghiêm". Bản thiết kế này đổi sang một bản sắc riêng:

- **Đồ hoạ 8-bit kiểu Nhật** cho toàn bộ khung giao diện, cảm giác như game Famicom thời xưa.
- **Chủ đề bóng đá** làm bộ khung động lực: lộ trình là một mùa giải, kỳ thi JLPT là trận chung kết, mỗi ngày học là một trận.
- **Màu tối thiểu, đủ để học lâu**, nhưng vui hơn bản cũ, kèm một đội mascot nhí nhảnh.
- **Chuyển cảnh mang chất Nhật** giữa các khu vực.

Lý do chọn bóng đá: luật học trong lộ trình (2 buổi shadowing bắt buộc mỗi tuần, thiếu buổi thì khoá bài mới, ôn tập không bao giờ khoá) vốn đã giống luật thi đấu. Ẩn dụ bóng đá biến những luật đó thành thứ dễ nhớ (thẻ vàng, treo giò), thay vì chỉ là lớp trang trí.

## 2. Mục tiêu, không làm, và điều cấm

**Mục tiêu**
- Người học nhận ra ngay mình đang ở khu nào (màu áo và mascot riêng của từng khu).
- Trang chủ tạo động lực mỗi ngày: tỉ số thi thử, đội hình hôm nay, lịch trận shadowing.
- Phần học (chữ Nhật, nghĩa, ví dụ) đọc rõ như bản cũ, không bị ẩn dụ hay hiệu ứng che lấp.

**Không làm trong đợt này**
- Mascot cho ba khu chưa có màn hình: Từ vựng, Đọc, Giao tiếp.
- Bản tối (dark mode) đầy đủ.
- Âm thanh 8-bit.

**Điều cấm (dù có làm đúng kỹ thuật thì vẫn là thất bại)**
- Ẩn dụ bóng đá chen vào nội dung học hoặc vào nút chấm thẻ SRS.
- Chuyển cảnh làm chậm việc học: không được dùng giữa hai thẻ ôn, và không được dài quá khoảng 1 giây.
- Chữ học (kanji, kana, nghĩa tiếng Việt) dùng font pixel.
- Màu là cách duy nhất để phân biệt đúng/sai.
- Dùng logo, áo đấu hay biểu tượng của đội tuyển hoặc giải đấu thật.

## 3. Ràng buộc

- **Font:** VT323 (font pixel có đủ dấu tiếng Việt) chỉ dùng cho tiêu đề, con số và nút. Be Vietnam Pro dùng cho chữ Việt, Shippori Mincho cho mọi chữ Nhật.
  - DotGothic16 chỉ dùng cho vài chữ kana trang trí (ví dụ tên mascot), không dùng cho nội dung học.
  - Đã kiểm: Instrument Sans, Press Start 2P, Silkscreen và DotGothic16 không có bộ chữ tiếng Việt có dấu.
- **Độ tương phản:** chữ trên nền ≥ 4,5:1; vạch giao diện và thanh tiến độ ≥ 3:1.
- **Giảm chuyển động:** người bật `prefers-reduced-motion` chỉ thấy mờ chuyển 0,15 giây, không có hiệu ứng.
- **Điện thoại là ưu tiên:** ôn tập chủ yếu diễn ra trên điện thoại (theo đặc tả), thanh điều hướng dưới có 5 nút.

## 4. Các cách làm (đã chọn: C)

| Cách | Làm gì | Được | Mất |
|---|---|---|---|
| **A. Áo mới cho prototype hiện tại** | Giữ `prototype/` (HTML/CSS/JS thuần, dữ liệu mẫu, router theo hash), thay toàn bộ lớp giao diện sang 8-bit bóng đá, thêm mascot và chuyển cảnh | Nhanh, xem được trên trình duyệt ngay; dữ liệu và tương tác cũ giữ nguyên | Vẫn là prototype, sau này phải dựng lại bằng Next.js |
| **B. Dựng thẳng bản web thật** | Next.js + Tailwind theo đặc tả kỹ thuật, làm luôn giao diện mới | Không phải làm hai lần | Chậm hơn nhiều; phải dựng tài khoản, dữ liệu, SRS trước khi thấy giao diện |
| **C. A trước, nhưng tách bộ token** | Như A, nhưng màu, font, sprite mascot và chuyển cảnh nằm trong các file độc lập (`tokens.css`, `sprites.js`, `transitions.js`), dùng lại được khi lên Next.js | Nhanh như A, và phần thiết kế mang sang bản thật được | Thêm chút công tổ chức file |

**Bạn đã chọn C** (01/11/2026). Lý do: đang ở giai đoạn thử cảm giác và chốt bản sắc nên cần thấy nhanh, nhưng màu, mascot và chuyển cảnh là thứ sẽ sống lâu, nên tách thành file riêng ngay từ đầu.

## 5. Những gì đã quyết

### 5.1 Ngôn ngữ chia ba lớp

| Lớp | Tần suất gặp | Ngôn ngữ | Ví dụ |
|---|---|---|---|
| **Động lực** | vài lần mỗi ngày | Bóng đá đầy đủ | Bảng tỉ số thi thử, đội hình hôm nay, nút "RA SÂN", lịch shadowing (thắng / giao hữu / đá bù), thẻ vàng – treo giò, chuỗi trận bất bại, "thay người" cứu chuỗi, XP |
| **Hành động lặp lại** | hàng trăm lần | Lời thường; bóng đá chỉ ở phản hồi | Nút **Quên · Khó · Được · Dễ**; bấm "Dễ" thì hiện "VÀO LƯỚI! +5 XP" khoảng 0,9 giây |
| **Nội dung học** | mọi lúc đọc | Lời thường hoàn toàn | Thẻ kanji, nghĩa, ví dụ, mẹo nhớ, nhận xét phát âm |

**Từ điển ẩn dụ đã dùng:**

| Trong app | Gọi là |
|---|---|
| Lộ trình 87 tuần | mùa giải |
| Kỳ thi JLPT | trận chung kết |
| Điểm thi thử so với điểm đỗ | tỉ số: HƯNG 98 – 95 ĐIỂM ĐỖ |
| Phần điểm thấp nhất | hàng thủ yếu |
| 2 buổi shadowing bắt buộc / tuần | 2 trận bắt buộc |
| Buổi thứ 7 khuyến khích / ngày bù | giao hữu / đá bù |
| Lỡ buổi → khoá bài mới | thẻ vàng → treo giò tuần sau |
| Chuỗi ngày học | chuỗi trận bất bại |
| Lần đóng băng chuỗi | thay người |

### 5.2 Bảng màu "Sân cỏ Nihon"

| Vai trò | Màu | Ghi chú |
|---|---|---|
| Nền trang | `#F4F5F2` | Trung tính, thay cho Cream (Cream đi với đỏ đất là cặp màu "sáo") |
| Giấy (mặt khung) | `#FFFFFF` | |
| Chữ | Dark Ink `#24332D` | Trên nền: 12,1:1 |
| Nút chính, tiến độ, khu Ôn tập | Forest `#2F684E` | Chữ trắng: 6,5:1; trên Mint: 5,5:1 |
| Sân cỏ | Grass `#477D59` + sọc `#4F8862` | Chỉ để trang trí |
| Sọc, viền ô "giao hữu" | Soft `#78A878` | Không dùng làm chữ hay thanh tiến độ |
| Khu phụ | Mint `#E5EDE3`, Sky `#D8E5EA` | Chữ đen: 11,1:1 và 10,3:1 |
| Khu Kanji và Shadowing | Xanh sân khách `#2F5D86`, nền nhạt `#DCE6F0` | Chữ trắng: 6,9:1 |
| "Hôm nay" và XP | Cam quả hồng `#E8956A` | Chữ đen: 5,6:1. Ô "Hôm nay" luôn có viền mực và chữ "HÔM NAY", vì cam đứng gần vàng |
| Chuỗi trận, thẻ vàng, số trên bảng tỉ số | Trophy Gold `#D6B45C`, nền nhạt `#F3E7C2` | Chữ đen: 6,7:1. Không bao giờ dùng làm chữ |
| Lỗi, cảnh báo | Terracotta `#A64B38` | Chữ trắng: 5,7:1. Dùng hiếm: một vạch bên trái và chữ đậm, không tô mảng lớn |

**Quy tắc kèm theo:**
- Đúng/sai luôn kèm ký hiệu ✓ / ✗. Khi mô phỏng mù màu đỏ–xanh, Forest và Terracotta gần như cùng màu.
- Mức màu: **màu áo theo khu vực**. Mỗi khung mang màu khu của nó ở thanh tiêu đề. Khán đài pixel đầy cổ động viên chỉ xuất hiện ở trang chủ.

### 5.3 Khung 8-bit

- Mọi khung có viền pixel 3px màu mực, góc vuông bậc thang (vẽ bằng `box-shadow` bốn phía, không đổ bóng).
- Thanh tiêu đề khung dùng VT323 viết hoa, nền màu khu vực, chữ trắng.
- Nút dùng VT323 với "bóng" 4px màu mực bên dưới; khi bấm, nút lún xuống 3px theo 2 khung hình (`steps(2)`).
- Ô lịch, huy hiệu XP, thanh tiến độ đều có viền 2px màu mực.

### 5.4 Đội mascot (đã chốt)

Sprite 16×16 ô, đầu to, mắt chấm tròn, má hồng `#F4ABA3`; nhún hai khung hình khi đứng yên.

| Mascot | Vai | Khu | Hình |
|---|---|---|---|
| **Bóng** | Đội trưởng | Trang chủ | Quả bóng trắng–đen, miệng cười, má hồng; giữ chuỗi trận bất bại |
| **Mèo đen–trắng** | Huấn luyện viên | Ôn tập | Tai và đỉnh đầu đen, dáng vẫy tay maneki-neko, vòng cổ xanh rừng có còi vàng |
| **Shiba** | Tiền đạo | Shadowing | Lông cam, chấm mày trắng, lè lưỡi, áo xanh sân khách |
| **Cánh cụt** | Trọng tài | Kanji | Thân tròn như quả trứng, mặt trắng, còi vàng, cầm thẻ vàng; thổi còi khi viết sai thứ tự nét |
| **Hải cẩu** | Thủ môn | JLPT | Thân xám nhạt, đội quả bóng trên đầu, vây đeo găng cam |

**Quy tắc xuất hiện:**
- Mỗi màn hình tối đa một mascot.
- Mascot chỉ ló ra ở khoảnh khắc của nó: chào buổi sáng, nhắc nhở, ăn mừng, nhận xét.
- Mascot không bao giờ che nội dung học.

Sprite hiện tại là bản phác vẽ tay bằng mã. Bản dùng thật nên nhờ người vẽ pixel art làm 24×24 hoặc 32×32, kèm khung động (vẫy tay, ăn mừng, buồn).

### 5.5 Chuyển cảnh

Chỉ dùng **khi chuyển giữa các khu vực** (Trang chủ ↔ Ôn tập ↔ Shadowing ↔ Kanji ↔ JLPT). Không dùng trong cùng một khu, không dùng giữa hai thẻ ôn.

| Hiệu ứng | Diễn biến | Thời gian đo được |
|---|---|---|
| **Cửa shoji** (mặc định, đã chốt) | Hai cánh cửa giấy có khung gỗ trượt vào giữa (360ms, in-out), quả bóng mascot hiện ở khe cửa (140ms), hai cánh trượt ra (440ms, expo-out) | khoảng 995 ms |
| **Hoa anh đào** | Một cành anh đào pixel (thân nâu, hoa trắng–hồng đậm, lá xanh) vươn vào từ góc trên trái. 16 cánh hoa bay chéo qua màn hình. Các ô nở theo đường chéo, trộn hoa, nụ, lá, cánh rời và ô trống, đến khi phủ kín. Khi mở, cành rút lui và các ô rơi rụng, xoay, mờ dần như hoa tàn | khoảng 1.125 ms |
| **Rèm noren** | Thanh treo gỗ có hai đầu chặn rơi xuống. Bốn tấm rèm có nẹp trên với quai, chữ dọc 日本語 và 道場, gia huy mặt trời (vòng trắng, lõi cam) xẻ đôi ở khe giữa, viền gấu có sọc cam, buông xuống rồi đung đưa nhẹ cùng chiều như có gió. Khi mở, rèm bị rẽ ra hai bên như có người bước qua, rồi vén lên | khoảng 1.070 ms |
| **Quạt giấy sensu** | 11 nan quạt xen kẽ giấy washi và cam quả hồng, có hoa anh đào pixel, xoè từ trục đinh tán vàng ở đáy màn hình, rồi gập sang phải | khoảng 1.030 ms |

- **Nhịp:** mặc định "giật khung kiểu 8-bit" (`steps(6)`), có thể tắt để chạy mượt.
- **Giảm chuyển động:** chỉ mờ chuyển, tổng khoảng 160 ms. Demo có ô "xem đầy đủ" (tích sẵn) để xem trên máy đang tắt hiệu ứng; app thật không có ô này.
- **Bàn phím:** sau khi chuyển, con trỏ bàn phím nhảy vào tiêu đề của màn hình mới.
- **Kỹ thuật:** chỉ dùng `transform`, `opacity` và `clip-path` tĩnh (Web Animations API). Lớp hiệu ứng có `aria-hidden` và `pointer-events: none`, và bị xoá khỏi trang sau khi chạy xong.
- **Ngẫu nhiên có hạt giống cố định:** vị trí hoa và cánh bay giống nhau mỗi lần, để tránh lặp thành cặp và để dễ kiểm thử.

**Đề xuất gán hiệu ứng (của mình, chờ bạn xác nhận):**
- **Cửa shoji:** chuyển giữa các khu, mặc định (đã chốt).
- **Rèm noren:** bước vào một bài học mới, ví dụ bắt đầu học kanji mới hay ngữ pháp mới. Noren là rèm treo ở cửa lớp hay võ đường, nên khớp với ý "bước vào lớp".
- **Hoa anh đào:** hoàn thành hết việc trong ngày, hoặc qua cấp.
- **Quạt sensu:** mở kết quả thi thử, như màn công bố.

Demo: `demo/chuyen-canh.html`.

## 6. Ngoại lệ có chủ đích với bộ quy tắc design-taste-frontend

| Cảnh báo của công cụ | Lý do giữ |
|---|---|
| `shadow` | `box-shadow` dùng để vẽ viền pixel và "bóng" nút 8-bit, không phải đổ bóng mềm |
| `mono` | VT323 là font pixel chủ đạo của phong cách 8-bit, không phải monospace của code; chỉ dùng cho tiêu đề, số, nút |
| `scale-zero` | Hoa anh đào cố ý nở từ 0; đây là lớp phủ, không phải một thành phần giao diện xuất hiện |
| Chữ dọc trên rèm noren | Dùng Shippori Mincho đậm cho chữ Hán trang trí, không phải nội dung học |
| Chuyển cảnh trên màn hình app | Quy tắc app là "chuyển động chỉ để phản hồi". Người dùng yêu cầu rõ chuyển cảnh, nên mình giới hạn chúng ở chuyển khu, khoảng 1 giây, có nhánh giảm chuyển động |

## 7. Phần để người dựng tự quyết

- Bố cục chi tiết từng màn hình trong khung 8-bit. Giữ cấu trúc và dữ liệu của prototype hiện tại, áp mục 5.
- Kích thước VT323 ở từng cấp tiêu đề. Gợi ý: 26–32px cho tiêu đề màn hình, 18–20px cho thanh khung, không dưới 16px.
- Mascot nào nói câu gì ở từng trạng thái. Theo giọng đã có: ngắn, thân mật, có "nha", "nè".
- Màn hình điện thoại: thanh điều hướng dưới 5 nút dùng icon mascot thu nhỏ hoặc chữ Hán như prototype; cả hai đều được, miễn đọc được ở 64px.

## 8. Tham chiếu

- Mockup và demo trong buổi brainstorm: `.superpowers/brainstorm/1622-1793505363/content/` (bảng màu chốt, chia lớp, đội mascot, chuyển cảnh).
- Prototype hiện tại: `prototype/`.
- Đặc tả chức năng và lộ trình: các artifact "Đặc tả chức năng – Web học tiếng Nhật" và "Lộ trình học tiếng Nhật N5 → N2" trên claude.ai.

## 9. Đã dựng

Nhánh `feat/8bit-bong-da`. Prototype giữ nguyên cấu trúc và dữ liệu, chỉ đổi giao diện sang 8-bit bóng đá, thêm mascot và chuyển cảnh.

**File đã tạo** (trong `prototype/`):
- `tokens.css`: bảng màu và biến dùng chung.
- `sprites.js`: 5 mascot 16×16 (Bóng, Mèo đen–trắng, Shiba, Cánh cụt, Hải cẩu).
- `transitions.js`: bốn hiệu ứng chuyển cảnh `shoji`, `noren`, `sensu`, `sakura` và nhánh giảm chuyển động.
- `tests/contrast.test.js`, `tests/sprites.test.js`, `tests/transitions.test.js`.

**File đã sửa:** `index.html`, `nihon.css`, `app.css`, `app.js`, `data.js`, `.gitignore`.

**Chạy test** (Node trên Windows không nhận tên thư mục): `node --test prototype/tests/*.test.js`. Kết quả lần cuối: 17 test, 17 đạt.

**Mở prototype:** `python -m http.server 8765 --bind 127.0.0.1 --directory prototype`, rồi vào http://127.0.0.1:8765. Mở `index.html` bằng `file://` thì một số khung xem trước không nạp được script.

**Kiểm tra giao diện:** `inspect.mjs --app` cho 5 màn (trang chủ, ôn tập, shadowing, kanji, JLPT) ở 1440, 768 và 390: 0 FAIL. Còn vài WARN về bố cục (`panel-void`, `ragged-row`) ở 1440, đến từ cấu trúc thẻ có sẵn của prototype, chưa xử lý.

**Số đo chuyển cảnh** (Chrome headless, ép chạy đủ chuyển động; máy đo đang bật giảm chuyển động nên phải ép). Mốc cần ≤ 1.150 ms:

| Hiệu ứng | Khoảnh khắc | 1440×900 | 390×720 |
|---|---|---|---|
| `shoji` | đổi khu | 1.011–1.067 ms | |
| `noren` | `lesson` | 1.107 ms | |
| `sensu` | `mock-result` | 1.048 ms | |
| `sakura` | `day-done` | 1.082–1.112 ms | 1.058–1.070 ms |
| nhánh giảm chuyển động | | 167 ms (mốc ≤ 200 ms) | |

Ghi chú: để `sakura` vào mốc, độ trễ mục tiêu được hạ xuống 480 ms. Ô hoa cũng lớn dần theo viewport: `cell = max(48, ceil(sqrt(w*h/135)))`, nên số ô không phình ra ở màn lớn. Chi tiết đo nằm trong báo cáo Task 7 của buổi dựng.

**Chưa làm:**
- Sprite 24×24 do người vẽ pixel art; hiện dùng sprite 16×16 viết bằng mã.
- Dark mode.
- Mascot dự bị.
- WARN bố cục `panel-void` / `ragged-row` của công cụ kiểm tra.
- Màn hình điện thoại: chữ "lặp 3 lần" trong khung video shadowing đè lên mã thời gian; cột nghĩa của "Từ có chữ" ở Kanji bị hẹp khi có nút "Thêm vào ôn".
