# Giao diện 8-bit × bóng đá cho prototype Nihon Nihon: kế hoạch thực hiện

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đưa prototype `prototype/` sang giao diện 8-bit Nhật chủ đề bóng đá: bảng màu "Sân cỏ Nihon", khung pixel, đội 5 mascot và 4 chuyển cảnh kiểu Nhật. Màu, sprite và chuyển cảnh nằm trong file riêng để sau này mang sang Next.js.

**Architecture:** Giữ nguyên prototype HTML/CSS/JS thuần, router theo hash, dữ liệu mẫu (cách C trong spec). Thêm ba module độc lập, không phụ thuộc DOM của app:
- `tokens.css`: màu, font, khung.
- `sprites.js`: dữ liệu pixel và hàm vẽ SVG.
- `transitions.js`: 4 hiệu ứng và bộ chạy có khoá chống bấm chồng.

`app.js` chỉ gọi các module này. Phần logic thuần (sprite, chọn hiệu ứng, thứ tự chạy, độ tương phản) được kiểm bằng `node --test`. Phần hình ảnh được kiểm bằng lint/inspect của design-taste-frontend và một bước đo trong trình duyệt.

**Tech Stack:**
- HTML, CSS, JavaScript thuần (không bundler).
- Web Animations API.
- `node --test` (Node 24, đã có).
- Google Fonts: VT323, Be Vietnam Pro, Shippori Mincho, DotGothic16.
- Công cụ `design-taste-frontend` (`lint.mjs`, `inspect.mjs`).

**Spec:** `docs/superpowers/specs/2026-11-01-giao-dien-8bit-bong-da-design.md`

## Global Constraints

- Chữ trên nền ≥ 4,5:1; vạch giao diện và thanh tiến độ ≥ 3:1.
- VT323 chỉ cho tiêu đề, con số, nút. Be Vietnam Pro cho chữ Việt, Shippori Mincho cho mọi chữ Nhật. DotGothic16 chỉ cho tên mascot bằng kana. Chữ học (kanji, kana, nghĩa) không bao giờ dùng font pixel.
- Bảng màu, giá trị chính xác:

  | Vai trò | Màu |
  |---|---|
  | Nền | `#F4F5F2` |
  | Giấy | `#FFFFFF` |
  | Chữ | `#24332D` |
  | Nút, tiến độ, Ôn tập | Forest `#2F684E` |
  | Sân cỏ | Grass `#477D59`, sọc `#4F8862` |
  | Sọc, giao hữu | Soft `#78A878` |
  | Khu phụ | Mint `#E5EDE3`, Sky `#D8E5EA` |
  | Kanji, Shadowing | xanh sân khách `#2F5D86`, nền nhạt `#DCE6F0` |
  | Hôm nay, XP | cam quả hồng `#E8956A` |
  | Chuỗi trận, thẻ vàng, số tỉ số | Gold `#D6B45C`, nền nhạt `#F3E7C2` |
  | Lỗi | Terracotta `#A64B38` |
  | Má mascot | `#F4ABA3` |

- Gold và Soft không bao giờ dùng làm chữ. Terracotta chỉ là một vạch bên trái cộng chữ đậm, không tô mảng lớn.
- Đúng/sai luôn kèm ký hiệu ✓ / ✗, không chỉ dựa vào màu.
- Ô "Hôm nay" luôn có viền mực và chữ "HÔM NAY".
- Ngôn ngữ chia 3 lớp:
  - **Động lực:** bóng đá đầy đủ (trang chủ, lịch, tỉ số, chuỗi trận, XP).
  - **Hành động lặp lại:** nút chấm thẻ giữ nguyên **Quên · Khó · Được · Dễ**; chỉ "Dễ" mới hiện "VÀO LƯỚI! +5 XP" khoảng 900ms.
  - **Nội dung học:** lời thường hoàn toàn.
- Khung 8-bit: viền pixel 3px màu mực vẽ bằng `box-shadow` bốn phía, góc vuông; nút có "bóng" 4px mực bên dưới, khi bấm lún 3px với `steps(2)`.
- Mascot:
  - Sprite 16×16, mỗi màn hình tối đa một con, không bao giờ che nội dung học.
  - Phân vai: Bóng ở Trang chủ, Mèo đen–trắng ở Ôn tập, Shiba ở Shadowing, Cánh cụt ở Kanji, Hải cẩu ở JLPT.
- Chuyển cảnh:
  - Chỉ dùng khi đổi khu hoặc ở khoảnh khắc đặc biệt; không bao giờ giữa hai thẻ ôn.
  - Mỗi hiệu ứng ≤ 1.150 ms đo thực tế.
  - Giảm chuyển động (`prefers-reduced-motion: reduce`): chỉ mờ chuyển, tổng ≤ 200 ms.
  - Sau khi chuyển, con trỏ bàn phím vào tiêu đề của màn hình mới.
  - Lớp hiệu ứng có `aria-hidden="true"`, `pointer-events: none`, và bị xoá sạch sau khi chạy.
- Gán hiệu ứng:

  | Khoảnh khắc | Hiệu ứng |
  |---|---|
  | `area` (đổi khu) | `shoji` |
  | `lesson` | `noren` |
  | `day-done`, `level-up` | `sakura` |
  | `mock-result` | `sensu` |

- Không dùng logo, áo đấu hay biểu tượng của đội tuyển hoặc giải đấu thật.
- Commit message: tiếng Việt hoặc tiếng Anh ngắn, không ghi số lượng; mỗi task commit một lần ở cuối.

## Review Focus

- **Bấm điều hướng liên tiếp hoặc bấm khi đang chuyển cảnh:** lần bấm sau bị bỏ qua, màn hình cuối cùng khớp với nút cuối cùng được xử lý, không bao giờ kẹt lớp phủ trên màn hình. Kiểm ở Task 3 (`run` khi đang bận) và Task 7 (bước kiểm trong trình duyệt).
- **Hiệu ứng ném lỗi giữa chừng** (trình duyệt cũ không có `Element.animate`): màn hình vẫn đổi, lớp phủ vẫn được xoá. Kiểm ở Task 3.
- **Mở thẳng một đường dẫn sâu** (`index.html#kanji`) hoặc tải lại trang: hiện ngay màn đó, không chạy chuyển cảnh lúc tải lần đầu. Kiểm ở Task 7.
- **Nút Back/Forward của trình duyệt:** vẫn chạy chuyển cảnh `area` và dừng đúng màn hình. Kiểm ở Task 7.
- **Máy bật giảm chuyển động** (như máy của người dùng hiện tại): chỉ mờ chuyển ≤ 200 ms, không bỏ qua việc đổi màn. Kiểm ở Task 3 và Task 7.

---

## File Structure

| File | Trách nhiệm |
|---|---|
| `prototype/tokens.css` (tạo) | Biến màu, font, kích thước khung theo spec; lớp tiện ích `.px`, `.px-2`, `.btn8`, `.bar8` |
| `prototype/sprites.js` (tạo) | `Sprites.PAL`, `Sprites.GRIDS`, `Sprites.rects()`, `Sprites.draw()`; chạy được cả trong trình duyệt và Node |
| `prototype/transitions.js` (tạo) | `Transitions.MOMENTS`, `forMoment()`, `shouldAnimate()`, `EFFECTS` (4 hiệu ứng), `create()` trả về bộ chạy có khoá |
| `prototype/tests/*.test.js` (tạo) | Kiểm thuần bằng `node --test` |
| `prototype/index.html` (sửa) | Thêm font, thêm script, chỗ đặt mascot và lớp `#fx` |
| `prototype/nihon.css` (sửa) | Đổi khung, nút, thanh điều hướng, panel sang 8-bit; ánh xạ biến cũ sang token mới |
| `prototype/data.js` (sửa) | Thêm `xp` |
| `prototype/app.js` (sửa) | Lời bóng đá ở lớp động lực, mascot từng màn, "VÀO LƯỚI!", nối router với `Transitions` |
| `.gitignore` (tạo) | Bỏ `.superpowers/`, `.taste-skill/` |

Nguồn dữ liệu pixel đã chốt trong buổi brainstorm (sao chép nguyên văn mảng chuỗi, không vẽ lại):
- **`ball`, `penguin`, `seal`:** mảng `ball`, `penguin`, `seal` trong `.superpowers/brainstorm/1622-1793505363/content/doi-mascot-v4.html`. Lấy bản "mới" (mắt chấm tròn), không lấy các mảng có hậu tố `Old`.
- **`cat`, `shiba`:** mảng `cat`, `shiba` trong `.superpowers/brainstorm/1622-1793505363/content/doi-mascot-v3.html`.
- **`flower`, `bud`, `leaf`, `petal`, `dpetal`, `mon`, `branch`:** trong `demo/chuyen-canh.html`. `branch` dùng ký tự `Q`/`q` cho hoa.
- **Hiệu ứng `shoji`, `sakura`, `noren`, `sensu`:** đối tượng `EFFECTS` và phần CSS "lớp chuyển cảnh" trong `demo/chuyen-canh.html`; đó là bản đã đo thời gian.

---

### Task 0: Khởi tạo kho git

**Files:**
- Create: `.gitignore`

- [ ] **Step 1:** Chạy `git init` ở `D:/Claude/projects/NihonNihon`.
- [ ] **Step 2:** Tạo `.gitignore` gồm đúng hai dòng: `.superpowers/` và `.taste-skill/`.
- [ ] **Step 3:** Kiểm tra. Run: `git status --short`. Expected: liệt kê `prototype/`, `docs/`, `demo/`, `.gitignore`, `.claude/`; không có `.superpowers/`.
- [ ] **Step 4:** Commit trạng thái gốc.

```bash
git add .gitignore prototype docs demo .claude
git commit -m "chore: lưu prototype và spec trước khi đổi giao diện 8-bit"
```

---

### Task 1: Token màu, font, khung (`tokens.css`)

**Files:**
- Create: `prototype/tokens.css`
- Test: `prototype/tests/contrast.test.js`

**Interfaces:**
- Produces, các biến CSS trên `:root`:
  - Màu: `--bg`, `--paper`, `--ink`, `--forest`, `--grass`, `--grass-2`, `--soft`, `--mint`, `--sky`, `--blue`, `--blue-pale`, `--kaki`, `--gold`, `--gold-pale`, `--terra`, `--blush`.
  - Font: `--font-ui`, `--font-px`, `--font-jp`, `--font-kana`.
  - Khung: `--px: 3px`.
  - Thời gian: `--ease-in-out: cubic-bezier(0.76, 0, 0.24, 1)`, `--ease-expo: cubic-bezier(0.16, 1, 0.3, 1)`, `--ease-exit: cubic-bezier(0.55, 0.055, 0.675, 0.19)`.
- Produces, lớp tiện ích:
  - `.px`: viền pixel 3px mực bốn phía.
  - `.px-2`: viền 2px.
  - `.btn8`: nút VT323 với bóng 4px, nhấn lún 3px `steps(2)`.
  - `.bar8`: thanh tiêu đề khung VT323 viết hoa; nền lấy từ biến `--area`, mặc định `var(--forest)`.
  - Lớp màu khu (đặt `--area`): `.area-review` = forest, `.area-kanji` và `.area-shadow` = blue, `.area-jlpt` = ink, `.area-home` = forest.

- [ ] **Step 1: Viết test hỏng.** `prototype/tests/contrast.test.js` đọc `prototype/tokens.css`, lấy giá trị hex của từng biến, rồi tính tỉ lệ tương phản WCAG:
  - Hàm luminance: `c <= 0.03928 ? c/12.92 : ((c+0.055)/1.055)**2.4`.
  - Hàm ratio: `(Lmax+0.05)/(Lmin+0.05)`.

  ```js
  test('chữ trên nền đạt 4,5:1', () => {
    for (const [fg, bg] of [['--ink','--bg'],['--ink','--paper'],['--ink','--mint'],['--ink','--sky'],['--ink','--kaki'],['--ink','--gold'],['--ink','--gold-pale'],['--ink','--blue-pale']])
      assert.ok(ratio(v(fg), v(bg)) >= 4.5, `${fg} trên ${bg}`);
    for (const bg of ['--forest','--blue','--terra']) assert.ok(ratio('#FFFFFF', v(bg)) >= 4.5, `trắng trên ${bg}`);
  });
  test('thanh tiến độ forest trên mint đạt 3:1', () => assert.ok(ratio(v('--forest'), v('--mint')) >= 3));
  test('giá trị khớp spec', () => {
    assert.equal(v('--ink'), '#24332D'); assert.equal(v('--kaki'), '#E8956A'); assert.equal(v('--blue'), '#2F5D86');
    assert.equal(v('--gold'), '#D6B45C'); assert.equal(v('--terra'), '#A64B38'); assert.equal(v('--bg'), '#F4F5F2');
  });
  ```
- [ ] **Step 2:** Run: `node --test prototype/tests/contrast.test.js`. Expected: FAIL vì không tìm thấy file `tokens.css`.
- [ ] **Step 3:** Tạo `prototype/tokens.css` với toàn bộ giá trị ở Global Constraints, các biến font, `--px` và easing. Viết các lớp `.px` / `.px-2` / `.btn8` / `.bar8` / `.area-*` theo Interfaces.
  - `.px` = `box-shadow: 0 calc(-1*var(--px)) var(--ink), 0 var(--px) var(--ink), calc(-1*var(--px)) 0 var(--ink), var(--px) 0 var(--ink)`.
  - `.btn8` có `transition: transform 120ms steps(2), box-shadow 120ms steps(2)`, kèm khối `@media (prefers-reduced-motion: reduce)` tắt transition.
- [ ] **Step 4:** Run: `node --test prototype/tests/contrast.test.js`. Expected: PASS cả 3 test.
- [ ] **Step 5: Commit.**

```bash
git add prototype/tokens.css prototype/tests/contrast.test.js
git commit -m "feat: thêm token màu, font và khung pixel 8-bit"
```

---

### Task 2: Dữ liệu và hàm vẽ sprite (`sprites.js`)

**Files:**
- Create: `prototype/sprites.js`
- Test: `prototype/tests/sprites.test.js`

**Interfaces:**
- Produces:
  - `Sprites.PAL: Record<string,string>`, gồm đúng các khoá: `K #24332D, W #FFFFFF, O #E8956A, P #F4ABA3, p #FBDDD8, R #C8564B, Y #D6B45C, F #2F684E, G #C3CDD1, B #2F5D86, N #5A3E2B, n #7A5638, L #78A878, l #477D59, V #F7F6F1, Q #D9708A, q #FFFFFF`.
  - `Sprites.GRIDS: Record<string,string[]>`, gồm `ball, cat, shiba, penguin, seal, flower, bud, leaf, petal, dpetal, mon, branch`. Mảng sao chép từ các nguồn ở mục File Structure.
  - `Sprites.MASCOT: Record<string,string>` = `{ 'trang-chu':'ball', 'on-tap':'cat', shadowing:'shiba', kanji:'penguin', jlpt:'seal' }`.
  - `Sprites.rects(name: string): { w:number, h:number, rects: Array<{x:number,y:number,fill:string}> }`: `w` là độ dài hàng dài nhất (hàng ngắn coi như được đệm `.`), ký tự không có trong `PAL` bị bỏ qua. Ném `Error('Unknown sprite: ' + name)` nếu không có tên đó.
  - `Sprites.draw(svg: SVGElement, name: string, scale = 0): void`: đặt `viewBox="0 0 w h"`, `shape-rendering="crispEdges"`, `aria-hidden="true"`, nội dung là các `<rect>`; nếu `scale > 0` thì đặt thêm `width = w*scale`, `height = h*scale`.
  - Xuất module: `(function (root) { ... root.Sprites = api; if (typeof module === 'object' && module.exports) module.exports = api; })(globalThis);`

- [ ] **Step 1: Viết test hỏng.** `prototype/tests/sprites.test.js`:

  ```js
  const Sprites = require('../sprites.js');
  test('năm mascot đều 16 cột, đúng số hàng', () => {
    for (const n of ['ball','cat','shiba','penguin']) { const r = Sprites.rects(n); assert.equal(r.w, 16); assert.equal(r.h, 16); }
    const s = Sprites.rects('seal'); assert.equal(s.w, 16); assert.equal(s.h, 18);
  });
  test('mỗi màn có đúng một mascot', () => assert.deepEqual(Object.keys(Sprites.MASCOT).sort(), ['jlpt','kanji','on-tap','shadowing','trang-chu']));
  test('hàng ngắn được đệm, branch rộng bằng hàng dài nhất', () => assert.equal(Sprites.rects('branch').w, Math.max(...Sprites.GRIDS.branch.map((r) => r.length))));
  test('chỉ vẽ ký tự có màu, đúng màu', () => {
    const r = Sprites.rects('dpetal'); assert.equal(r.rects.length, 12); assert.ok(r.rects.every((x) => x.fill === Sprites.PAL[Sprites.GRIDS.dpetal[x.y][x.x]]));
  });
  test('mèo đen trắng không có màu cam', () => assert.ok(!Sprites.rects('cat').rects.some((x) => x.fill === '#E8956A')));
  test('tên lạ ném lỗi', () => assert.throws(() => Sprites.rects('capybara'), /Unknown sprite: capybara/));
  ```
- [ ] **Step 2:** Run: `node --test prototype/tests/sprites.test.js`. Expected: FAIL vì không tìm thấy module `../sprites.js`.
- [ ] **Step 3:** Tạo `prototype/sprites.js` theo Interfaces. `draw()` chỉ dùng `rects()` rồi ghép chuỗi `<rect x y width="1" height="1" fill>`.
- [ ] **Step 4:** Run: `node --test prototype/tests/sprites.test.js`. Expected: PASS cả 6 test.
- [ ] **Step 5: Commit.**

```bash
git add prototype/sprites.js prototype/tests/sprites.test.js
git commit -m "feat: thêm sprite 8-bit cho đội mascot và chuyển cảnh"
```

---

### Task 3: Bộ chuyển cảnh (`transitions.js`)

**Files:**
- Create: `prototype/transitions.js`
- Test: `prototype/tests/transitions.test.js`

**Interfaces:**
- Consumes: `Sprites.draw(svg, name, scale)` từ Task 2 (dùng cho quả bóng ở khe cửa shoji, hoa, lá, cành, gia huy).
- Produces:
  - `Transitions.MOMENTS = { area:'shoji', lesson:'noren', 'day-done':'sakura', 'level-up':'sakura', 'mock-result':'sensu' }`
  - `Transitions.forMoment(moment: string): string`: tên lạ hoặc `undefined` trả về `'shoji'`.
  - `Transitions.shouldAnimate({ reducedMotion }: { reducedMotion: boolean }): boolean`, bằng `!reducedMotion`.
  - `Transitions.EFFECTS: Record<'shoji'|'sakura'|'noren'|'sensu', { build(fx: HTMLElement, size: {w:number,h:number}): void, cover(fx, opts): Promise<void>, reveal(fx, opts): Promise<void> }>`, với `opts = { easing(name: '--ease-in-out'|'--ease-expo'|'--ease-exit'|'--ease-out'): string }`.
  - `Transitions.create({ layer, content, reducedMotion, stepped }): { run(name: string, swap: () => void): Promise<{ mode: 'full'|'reduced'|'skipped'|'error', ms: number }>, get busy(): boolean }`. Trong đó:
    - `layer`: phần tử `#fx`.
    - `content`: phần tử chứa màn hình, dùng để mờ chuyển.
    - `reducedMotion: () => boolean`.
    - `stepped: () => boolean`: khi `true`, `opts.easing()` trả về `'steps(6, jump-end)'`; khi `false`, trả về giá trị biến CSS tương ứng.
  - Xuất module như Task 2 (`root.Transitions`, `module.exports`).

**Hành vi của `run`:**
- Đang bận → trả ngay `{ mode:'skipped' }`, không gọi `swap`.
- Giảm chuyển động → `content.animate` opacity 1→0 trong 75ms, gọi `swap`, rồi 0→1 trong 75ms; trả `mode:'reduced'`.
- Bình thường, theo thứ tự: `build` → `cover` → `swap` → chờ 40ms → `reveal`; trả `mode:'full'`.
- Nếu `build`, `cover` hoặc `reveal` ném lỗi: vẫn đảm bảo `swap` được gọi đúng một lần, rồi trả `mode:'error'`.
- Mọi nhánh, trong `finally`: `layer.innerHTML = ''` và hết bận.
- `ms` đo bằng `performance.now()`.

- [ ] **Step 1: Viết test hỏng.** `prototype/tests/transitions.test.js` dùng đồ giả:
  - `layer = { innerHTML: 'x', getBoundingClientRect: () => ({ width: 390, height: 720 }) }`
  - `content = { animate: () => ({ finished: Promise.resolve() }) }`
  - Thay `Transitions.EFFECTS.fake = { build, cover, reveal }` có ghi lại thứ tự gọi.

  ```js
  test('gán hiệu ứng theo khoảnh khắc', () => {
    assert.equal(T.forMoment('area'), 'shoji'); assert.equal(T.forMoment('lesson'), 'noren');
    assert.equal(T.forMoment('day-done'), 'sakura'); assert.equal(T.forMoment('level-up'), 'sakura');
    assert.equal(T.forMoment('mock-result'), 'sensu'); assert.equal(T.forMoment('khac'), 'shoji'); assert.equal(T.forMoment(), 'shoji');
  });
  test('đủ bốn hiệu ứng', () => assert.deepEqual(['noren','sakura','sensu','shoji'].every((k) => typeof T.EFFECTS[k].cover === 'function'), true));
  test('thứ tự build → cover → swap → reveal, lớp phủ được xoá', async () => {
    const r = await runner.run('fake', () => log.push('swap'));
    assert.deepEqual(log, ['build','cover','swap','reveal']); assert.equal(r.mode, 'full'); assert.equal(layer.innerHTML, '');
  });
  test('đang chạy thì lần bấm sau bị bỏ qua', async () => {
    const a = runner.run('slow', swapA); const b = await runner.run('fake', swapB);
    assert.equal(b.mode, 'skipped'); assert.equal(swapB.calls, 0); await a; assert.equal(runner.busy, false);
  });
  test('hiệu ứng ném lỗi vẫn đổi màn và xoá lớp phủ', async () => {
    const r = await runner.run('boom', swap); assert.equal(r.mode, 'error'); assert.equal(swap.calls, 1); assert.equal(layer.innerHTML, '');
  });
  test('giảm chuyển động chỉ mờ chuyển', async () => {
    const r = await reducedRunner.run('shoji', swap); assert.equal(r.mode, 'reduced'); assert.equal(swap.calls, 1); assert.equal(content.animateCalls, 2);
  });
  ```

  Hai hiệu ứng giả cho test: `slow` có `cover` chờ 30ms; `boom` có `cover` ném `new Error('boom')`.
- [ ] **Step 2:** Run: `node --test prototype/tests/transitions.test.js`. Expected: FAIL vì không tìm thấy module `../transitions.js`.
- [ ] **Step 3:** Tạo `prototype/transitions.js`:
  - `MOMENTS`, `forMoment`, `shouldAnimate`, `create` theo Interfaces và mục "Hành vi của `run`".
  - Chuyển 4 hiệu ứng từ `demo/chuyen-canh.html` sang dạng `build(fx, size)` / `cover(fx, opts)` / `reveal(fx, opts)`:
    - thay `device.clientWidth` / `device.clientHeight` bằng `size.w` / `size.h`;
    - thay `ease()` bằng `opts.easing()`;
    - thay `sprite()` bằng `Sprites.draw()`;
    - giữ nguyên mọi `duration`, `delay` và hệ số trễ đã đo trong demo.
  - Trong trình duyệt, đọc `Sprites` từ `globalThis`; trong Node, các test chỉ dùng hiệu ứng giả nên không cần `Sprites`.
- [ ] **Step 4:** Run: `node --test prototype/tests/`. Expected: PASS toàn bộ test của Task 1, 2 và 3.
- [ ] **Step 5: Commit.**

```bash
git add prototype/transitions.js prototype/tests/transitions.test.js
git commit -m "feat: thêm bộ chuyển cảnh shoji, sakura, noren, sensu"
```

---

### Task 4: Khung 8-bit cho toàn app (font, panel, nút, điều hướng)

**Files:**
- Modify: `prototype/index.html`
  - Trong `<head>`: đổi link Google Fonts thành `family=Be+Vietnam+Pro:wght@400;500;600;700&family=Shippori+Mincho:wght@500;700&family=VT323&family=DotGothic16&display=swap`; thêm `<link rel="stylesheet" href="tokens.css">` ngay trước `app.css`.
  - Trước `charts.js`: thêm `<script src="sprites.js"></script><script src="transitions.js"></script>`.
  - Thêm `<div id="fx" aria-hidden="true"></div>` ngay trước `</body>`.
  - Gắn lớp khu cho từng `<section data-view>`: `trang-chu` → `area-home`, `on-tap` → `area-review`, `shadowing` → `area-shadow`, `kanji` → `area-kanji`, `jlpt` → `area-jlpt`.
- Modify: `prototype/nihon.css` (khối `:root` ở đầu file, `.panel`, `.btn`, `.nav-item`, `.title-row h1`, `.tabbar`, `.rowcard`).

**Interfaces:**
- Consumes: biến và lớp của Task 1.
- Produces: `#fx { position: fixed; inset: 0; z-index: 50; pointer-events: none; }` (Task 7 dùng). Mọi `.panel` mang khung `.px`; mọi `.panel > header h2` hiển thị như `.bar8` với màu `--area` của khu.

- [ ] **Step 1:** Trong `nihon.css`, thay các giá trị màu cứng ở khối `:root` bằng ánh xạ sang token:
  - Khung và bề mặt: `--ground: var(--bg)`, `--surface: var(--paper)`.
  - Chữ và màu chính: `--text: var(--ink)`, `--accent: var(--forest)`, `--primary: var(--ink)`.
  - Biểu đồ: `--chart-1: var(--forest)`, `--negative: var(--terra)`.
  - Font: `--font: var(--font-ui)`, `--jp: var(--font-jp)`.
  - Bo góc: `--radius-card: 0`, `--radius-control: 0`.

  Bỏ các màu cũ không còn trong spec: `#1b6e66`, `#f6f6f4`.
- [ ] **Step 2:** Đổi các thành phần sang 8-bit:
  - **Panel:** nền `var(--paper)`, khung `.px`, không bo góc. Tiêu đề `h2` trong header thành dải `.bar8` (VT323 20px, viết hoa) chạy hết bề ngang panel, nền `var(--area)`, chữ trắng.
  - **Nút:** `.btn` và `.btn.primary` theo `.btn8`.
  - **Tiêu đề màn hình:** `h1` dùng VT323 32px trên desktop, 26px trên điện thoại.
  - **Điều hướng:** mục đang chọn của `.nav-item` có nền `var(--mint)` và vạch trái 4px `var(--ink)`.
  - **Thanh dưới trên điện thoại:** `.tabbar` có viền trên 3px mực.
  - Chữ học giữ nguyên Shippori Mincho hoặc Be Vietnam Pro.
- [ ] **Step 3: Kiểm.** Chạy server `python -m http.server 8765 --bind 127.0.0.1 --directory prototype` (chạy nền). Rồi chạy lần lượt `node "C:/Users/Viet Hung/.claude/skills/design-taste-frontend/scripts/inspect.mjs" --app "http://127.0.0.1:8765/#<view>" --out ".taste-skill/inspect-<view>"`, với `<view>` là `trang-chu`, `on-tap`, `shadowing`, `kanji`, `jlpt`.
  - Expected: 0 FAIL ở cả 5 màn.
  - Các WARN `shadow` và `mono` được chấp nhận theo spec mục 6, mọi WARN khác phải sửa.
  - Mở ảnh `desktop-page-01.jpg` và `mobile-page-01.jpg` của từng màn để xác nhận khung pixel hiển thị và chữ Nhật vẫn là font Mincho.
- [ ] **Step 4:** Run: `node --test prototype/tests/`. Expected: PASS.
- [ ] **Step 5: Commit.**

```bash
git add prototype/index.html prototype/nihon.css
git commit -m "feat: khung pixel 8-bit cho panel, nút và điều hướng"
```

---

### Task 5: Trang chủ: lớp động lực bóng đá

**Files:**
- Modify: `prototype/data.js`: thêm `const xp = 1240;` và xuất trong object trả về (`return { ..., xp }`).
- Modify: `prototype/index.html`: trong `<section data-view="trang-chu">`, chèn khối sân cỏ và bảng tỉ số ngay sau `.title-row` (trước `#tiles`): `<div class="pitch px" id="pitch"><div class="crowd" id="crowd" aria-hidden="true"></div><div class="board" id="board"></div></div>`. Thêm `<p class="mascot-say" id="home-mascot"></p>` vào cuối panel "Shadowing tuần này".
- Modify: `prototype/app.js`: hàm `home()` (dòng 18–61).
- Modify: `prototype/nihon.css`: thêm `.pitch`, `.crowd`, `.board`, `.mascot-say`, `.badge-xp`, `.day.today`.

**Interfaces:**
- Consumes: `D.mocks`, `D.exam`, `D.week`, `D.streak`, `D.today`, `D.xp`; `Sprites.draw` (Task 2); `.px`, `.btn8` (Task 1).
- Produces: hàm `mascotLine(svgHost: HTMLElement, viewId: string, text: string): void` trong `app.js`. Hàm vẽ `Sprites.MASCOT[viewId]` ở scale 4, đặt cạnh câu nói. Task 6 dùng lại hàm này.

**Nội dung chữ, nguyên văn (lớp động lực):**

| Vị trí | Chữ |
|---|---|
| Tiêu đề panel việc hôm nay | `Đội hình hôm nay`, chip `${left} chưa ra sân` |
| Nút của việc chưa xong | `Ra sân`; việc shadowing bắt buộc: `Ra sân ngay` |
| Bảng tỉ số, dòng trên | `THI THỬ ${last.label}` · `CHUNG KẾT ${dd/mm của D.learner.examDate}` |
| Bảng tỉ số, số lớn | `${last.total}–${D.exam.pass}` |
| Bảng tỉ số, hai bên số | `HƯNG` và `ĐIỂM ĐỖ` |
| Bảng tỉ số, dòng dưới | `Đang dẫn ${last.total - D.exam.pass} điểm · ${tên phần thấp nhất} là hàng thủ yếu nhất` |
| Lịch tuần | ngày đã làm `✓ THẮNG`; hôm nay `HÔM NAY` (nền `--kaki`, viền mực); `bonus` `GIAO HỮU`; `makeup` `ĐÁ BÙ`; ngày khác `–` |
| Ghi chú luật | `Thẻ vàng: lỡ trận hôm nay mà không đá bù Chủ nhật ${sunday.date}/10 thì treo giò bài mới tuần sau. Ôn tập không bao giờ bị cấm.` Có tấm thẻ vàng 9×13px nền `--gold`, vạch trái 4px `--terra` |
| Ô chuỗi | giá trị `${D.streak.days}`, chú thích `trận bất bại · còn ${D.streak.freezes} lần thay người`, nền `--gold-pale` |
| Huy hiệu XP | `${n0(D.xp)} XP`, nền `--kaki`, viền mực 2px |
| Mascot Bóng | `"${D.streak.days} trận bất bại! Tối nay ra sân nốt nha!"` |

- **Khán đài:** 72 ô `<i>`. Màu chọn xoay vòng theo bộ sinh số mulberry32 với hạt giống `20261101`, từ danh sách `['#FFFFFF','#D6B45C','#DCE6F0','#FFFFFF','#78A878','#D6B45C','#F2DDD6']`. Nền khán đài `--blue`, lưới 24 cột.

- [ ] **Step 1:** Thêm `xp` vào `data.js`, thêm markup vào `index.html`, viết `mascotLine` và sửa `home()` theo bảng chữ ở trên.
- [ ] **Step 2:** Thêm CSS cho `.pitch`:
  - sọc cỏ là ảnh nền SVG data-URI 44×10 với ô `#4F8862` trên nền `--grass` (không dùng gradient);
  - vạch vôi là một lớp `inset: 5px` với `box-shadow: inset 0 0 0 2px #fff`;
  - `.board` nền `--ink`, số dùng VT323 46px màu `--gold`.
- [ ] **Step 3: Kiểm.** Chạy `inspect.mjs --app "http://127.0.0.1:8765/#trang-chu"`. Expected: 0 FAIL. Mở `desktop-fold.jpg` và xác nhận lần lượt:
  - bảng tỉ số `98–95`;
  - đội hình có nút `Ra sân`;
  - lịch có `✓ THẮNG` / `HÔM NAY` / `GIAO HỮU` / `ĐÁ BÙ`;
  - huy hiệu `1.240 XP` màu cam;
  - ô chuỗi `46` nền vàng nhạt;
  - mascot Bóng.
- [ ] **Step 4: Kiểm điện thoại.** Mở `mobile-page-01.jpg`: bảng tỉ số không tràn ngang, 7 ô lịch vừa một hàng.
- [ ] **Step 5: Commit.**

```bash
git add prototype/data.js prototype/index.html prototype/app.js prototype/nihon.css
git commit -m "feat: trang chủ theo ngôn ngữ mùa giải bóng đá"
```

---

### Task 6: Mascot ở các màn còn lại và hiệu ứng "VÀO LƯỚI!"

**Files:**
- Modify: `prototype/app.js`: các hàm `review()`, `grade()`, `shadowing()`, `kanji()`, `jlpt()`.
- Modify: `prototype/index.html`: thêm `<p class="mascot-say" id="<view>-mascot"></p>` với `<view>` là `review`, `shadow`, `kanji`, `jlpt`:
  - `review-mascot` đặt dưới `.flash`;
  - `shadow-mascot` cuối panel "Buổi này đã hợp lệ chưa";
  - `kanji-mascot` cuối panel "Thứ tự nét";
  - `jlpt-mascot` cuối panel đề gần nhất.
- Modify: `prototype/nihon.css`: thêm `.goal`.

**Interfaces:**
- Consumes: `mascotLine` (Task 5), `Sprites` (Task 2).
- Produces: `showGoal(): void` trong `app.js`. Hàm hiện lớp `.goal` phủ lên `.flash` với chữ `VÀO LƯỚI!` (VT323 50px `--gold`) và dòng `+5 XP · ${c.next[3]} nữa gặp lại`, giữ 900ms rồi ẩn. Lớp có `role="status"`.

**Câu mascot, nguyên văn:**

| Màn | Mascot | Câu |
|---|---|---|
| Ôn tập | `cat` | `"${D.dueTotal} thẻ đang chờ khởi động đó!"` |
| Shadowing | `shiba` | `"Gâu! Câu 3 lên giọng sớm, chạy lại nhé!"` |
| Kanji | `penguin` | `"Tuýt! Nhớ thứ tự nét nhé."` |
| JLPT | `seal` | `"Đang dẫn ${last.total}–${D.exam.pass}. Giữ chắc khung thành!"` |

- **Nút chấm thẻ:** giữ nguyên `Quên`, `Khó`, `Được`, `Dễ` cùng phím 1–4. Trong `grade()`, nếu nút được chọn là chỉ số 3 (Dễ) thì gọi `showGoal()` trước khi chuyển thẻ. Phím `4` cũng phải đi qua cùng đường này: sửa nhánh phím tắt để truyền chỉ số vào `grade(j)`.
- **Giảm chuyển động:** dưới `prefers-reduced-motion: reduce`, `.goal` hiện và ẩn không có chuyển tiếp, nhưng vẫn giữ 900ms.

- [ ] **Step 1:** Sửa `grade()` thành `grade(j: number)`, nhận chỉ số nút. Cập nhật cả listener click (`data-grade`) và phím tắt `1`–`4` cho đúng chỉ số.
- [ ] **Step 2:** Viết `showGoal()` và CSS `.goal`; gọi `mascotLine` trong 4 hàm dựng màn với câu ở bảng trên.
- [ ] **Step 3: Kiểm.** Chạy `inspect.mjs --app` cho `on-tap`, `shadowing`, `kanji`, `jlpt`. Expected: 0 FAIL. Mở ảnh để xác nhận mỗi màn có đúng một mascot và mascot không đè lên chữ học.
- [ ] **Step 4: Kiểm trong trình duyệt.** Ở `#on-tap`, bấm phím cách rồi phím `4`: `document.querySelector('.goal')` hiển thị (computed `opacity` = `1`) trong khoảng 0–900ms, rồi ẩn. Bộ đếm tăng 1. Bấm phím `3` thì không hiện `.goal`.
- [ ] **Step 5: Commit.**

```bash
git add prototype/app.js prototype/index.html prototype/nihon.css
git commit -m "feat: mascot từng màn và hiệu ứng vào lưới khi chấm Dễ"
```

---

### Task 7: Nối chuyển cảnh vào router

**Files:**
- Modify: `prototype/app.js`: khối router (dòng 220–236).
- Modify: `prototype/index.html`: thêm `data-moment="mock-result"` vào link `Phân tích` trong panel thi thử ở trang chủ (`<a class="card-link" href="#jlpt">`), và `tabindex="-1"` cho 5 `h1`.
- Modify: `prototype/app.js`, hàm `home()`: link `Ra sân` của việc có `id === 'kanji'` được dựng kèm `data-moment="lesson"`.
- Modify: `prototype/nihon.css`: CSS lớp chuyển cảnh (chép từ `demo/chuyen-canh.html`, các khối `.door`, `.seal`, `.petals`, `.drift`, `.branch`, `.noren2`, `.sensu`). Đổi `position: absolute` của lớp gốc thành `fixed` cho `#fx`.

**Interfaces:**
- Consumes: `Transitions.create`, `Transitions.forMoment`, `Transitions.shouldAnimate` (Task 3); `#fx` (Task 4).
- Produces:
  - `window.NihonDebug = { go(viewId: string, moment: string, opts?: { force?: boolean }): Promise<{mode, ms}> }`, chỉ để kiểm thử và demo khoảnh khắc `day-done` / `level-up`. `force: true` bỏ qua giảm chuyển động cho đúng lần chạy đó: biến module `forceFull` được bật trước khi chạy và tắt trong `finally`.

**Hành vi:**
- **Tải trang lần đầu** (kể cả mở thẳng `#kanji`): gọi `route()` không có chuyển cảnh.
- **`hashchange`:** dùng `moment` đã ghi lại từ lần bấm gần nhất trên một phần tử `[data-moment]`, nếu không có thì `'area'`. Gọi `runner.run(Transitions.forMoment(moment), () => route())`. Sau đó xoá `moment` đã ghi.
- **`route()`:** giữ nguyên nội dung hiện có, cộng thêm `focus({ preventScroll: true })` vào `h1` của màn mới. Mỗi `h1` có `tabindex="-1"`.
- **Khởi tạo runner:** `runner = Transitions.create({ layer: $('#fx'), content: MAIN, reducedMotion: () => !forceFull && matchMedia('(prefers-reduced-motion: reduce)').matches, stepped: () => true })`.
- **Hoàn thành phiên ôn:** khi `rv.done === D.dueTotal` sau một lần chấm, đặt `moment = 'day-done'` rồi `location.hash = '#trang-chu'`.
- **Bấm khi đang chuyển cảnh:** `run` trả `skipped`, nhưng `hashchange` đã đổi URL. Sau khi runner hết bận, nếu `location.hash` khác màn đang hiện thì gọi lại `route()` không hiệu ứng, để màn hình luôn khớp URL.

- [ ] **Step 1:** Viết lại khối router theo mục Hành vi. Sửa `index.html` và `home()` như nêu ở phần Files.
- [ ] **Step 2:** Chép CSS lớp chuyển cảnh vào `nihon.css`.
- [ ] **Step 3: Đo trong trình duyệt** (server ở cổng 8765, mở `http://127.0.0.1:8765/`; máy đang bật giảm chuyển động nên đo nhánh đầy đủ bằng cách tạm cho `reducedMotion: () => false` qua `NihonDebug`). Chạy trong console:

  ```js
  for (const [v, m] of [['on-tap','area'],['kanji','lesson'],['trang-chu','day-done'],['jlpt','mock-result']]) console.log(m, await NihonDebug.go(v, m, { force: true }));
  ```

  (Gọi với `{ force: true }`: `NihonDebug.go(v, m, { force: true })`.)

  Expected: bốn dòng `mode: 'full'` với `ms` lần lượt ≤ 1150. Sau mỗi lần, `document.getElementById('fx').innerHTML === ''` và `document.activeElement` là `h1` của màn mới.
- [ ] **Step 4: Kiểm Review Focus trong trình duyệt:**
  - (a) Bấm Ôn tập rồi Kanji liên tiếp trong 200ms: cuối cùng màn hình khớp `location.hash` và `#fx` rỗng.
  - (b) Mở `http://127.0.0.1:8765/#kanji` trong tab mới: màn Kanji hiện ngay, `#fx` rỗng, không có hiệu ứng nào chạy (`document.getAnimations().length === 0` sau 50ms).
  - (c) Bấm Back của trình duyệt sau khi chuyển: chuyển cảnh `shoji` chạy và dừng ở màn trước.
  - (d) Với giảm chuyển động bật (mặc định trên máy này), chuyển khu trả `mode: 'reduced'` với `ms` ≤ 200.
- [ ] **Step 5:** Run: `node --test prototype/tests/` (PASS). Rồi chạy `node "C:/Users/Viet Hung/.claude/skills/design-taste-frontend/scripts/lint.mjs" --app prototype` (0 FAIL; WARN chỉ thuộc nhóm `shadow`, `mono`, `scale-zero` đã ghi ở spec mục 6).
- [ ] **Step 6: Commit.**

```bash
git add prototype/app.js prototype/index.html prototype/nihon.css
git commit -m "feat: chuyển cảnh shoji giữa các khu và các khoảnh khắc đặc biệt"
```

---

### Task 8: Kiểm tra cuối và cập nhật tài liệu

**Files:**
- Modify: `docs/superpowers/specs/2026-11-01-giao-dien-8bit-bong-da-design.md`: thêm mục 9 "Đã dựng". Mục này liệt kê file đã tạo, lệnh chạy test, lệnh mở prototype, các số đo ở Task 7 Step 3, và những gì còn chưa làm (sprite 24×24 do người vẽ pixel art, dark mode, mascot dự bị).

- [ ] **Step 1:** Chạy `inspect.mjs --app` cho cả 5 màn (như Task 4 Step 3). Expected: 0 FAIL ở 1440, 768 và 390. Mở toàn bộ ảnh `desktop-page-01.jpg` và `mobile-page-01.jpg` sau lần chạy cuối.
- [ ] **Step 2:** Run: `node --test prototype/tests/`. Expected: PASS.
- [ ] **Step 3:** Viết mục 9 vào spec, dùng số đo thực tế của Task 7 (không chép số ước lượng từ kế hoạch này).
- [ ] **Step 4: Commit.**

```bash
git add docs/superpowers/specs/2026-11-01-giao-dien-8bit-bong-da-design.md
git commit -m "docs: ghi lại kết quả dựng giao diện 8-bit"
```
