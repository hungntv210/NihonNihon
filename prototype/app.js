// Nihon Nihon prototype: dựng các màn hình từ D (data.js), router theo hash, tương tác cơ bản.
(() => {
  const $ = (s) => document.querySelector(s);
  const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const nf = (d = 0) => new Intl.NumberFormat('vi-VN', { minimumFractionDigits: d, maximumFractionDigits: d });
  const n0 = (v) => nf(0).format(v);
  const day = (iso) => new Date(iso + 'T00:00:00');
  const ddmm = (iso) => day(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const daysLeft = Math.round((day(D.learner.examDate) - day(D.learner.today)) / 864e5);
  // tokens [[chữ, furigana?, nhấn?]] → ruby
  const ruby = (toks) => toks.map(([t, r, hl]) => { const x = r ? `<ruby>${esc(t)}<rt>${esc(r)}</rt></ruby>` : esc(t); return hl ? `<b class="hl">${x}</b>` : x; }).join('');
  const verdict = (m) => {
    const ok = m.total >= D.exam.pass && m.parts.every((p) => p >= D.exam.sectionMin);
    return !ok ? ['Chưa đỗ', 'neg'] : m.total < D.exam.pass + 10 ? ['Sát nút', 'warn'] : ['Đỗ', 'pos'];
  };

  // Mascot cạnh một câu nói: vẽ Sprites.MASCOT[viewId] ở scale 4 (Task 6 dùng lại)
  function mascotLine(host, viewId, text) {
    host.innerHTML = '<svg class="mascot-sprite"></svg><span class="say"></span>';
    Sprites.draw(host.querySelector('svg'), Sprites.MASCOT[viewId], 4);
    host.querySelector('.say').textContent = text;
  }
  // mulberry32: khán đài luôn cùng một bộ màu
  function mulberry32(a) {
    return () => {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------------- Trang chủ ---------------- */
  function home() {
    const left = D.today.filter((t) => !t.done);
    $('#h-home').textContent = `Chào buổi tối, ${D.learner.name}. Hôm nay còn buổi shadowing bắt buộc.`;
    $('#home-sub').textContent = `Thứ Năm, ${ddmm(D.learner.today)} · tuần ${D.learner.weekOfPlan}/${D.learner.planWeeks} của lộ trình · còn ${daysLeft} ngày đến kỳ thi ${D.learner.target}`;
    $('#home-cta').textContent = `Ôn ${D.dueTotal} thẻ`;
    $('#nav-due').textContent = D.dueTotal;

    const tiles = [
      ['Thẻ đến hạn', D.dueTotal, 'thẻ', 'Khoảng 25 phút, luôn làm trước'],
      ['Chuỗi ngày học', D.streak.days, '', `trận bất bại · còn ${D.streak.freezes} lần thay người`, 'streak'],
      [`Đến kỳ thi ${D.learner.target}`, daysLeft, 'ngày', `Chủ nhật ${ddmm(D.learner.examDate)}`],
      ['Tỉ lệ nhớ 30 ngày', nf(1).format(D.retention * 100), '%', 'Cần từ 85% để qua cấp'],
    ];
    $('#tiles').innerHTML = tiles.map(([l, v, u, c, k]) => `<div class="panel tile span-3${k ? ' ' + k : ''}"><span class="label">${esc(l)}</span><span class="value">${esc(typeof v === 'number' ? n0(v) : v)}<small>${esc(u)}</small></span><span class="cap">${esc(c)}</span></div>`).join('');

    $('#today-count').textContent = `${left.length} chưa ra sân`;
    $('#xp-badge').textContent = `${n0(D.xp)} XP`;
    $('#today-mins').textContent = `khoảng ${left.reduce((s, t) => s + t.mins, 0)} phút`;
    $('#today-list').innerHTML = D.today.map((t, i) => `<li class="rowcard${t.done ? ' done' : ''}">
      <span class="tick${t.done ? ' on' : ''}" aria-label="${t.done ? 'Đã xong' : 'Chưa làm'}" role="img"></span>
      <div class="body"><div class="t${t.jp ? ' jpmix' : ''}">${t.jp ? esc(t.title).replace(/([㐀-鿿 ]{3,})$/, '<span lang="ja">$1</span>') : esc(t.title)}${t.required ? ' <span class="pill warn">Bắt buộc hôm nay</span>' : ''}</div><div class="s">${esc(t.sub)}</div></div>
      <span class="mins">${t.mins} phút</span>
      <span class="act">${t.done ? '<span class="meta">Đã xong</span>' : `<a class="btn sm" href="${t.href}"${t.id === 'kanji' ? ' data-moment="lesson"' : ''}>${t.required ? 'Ra sân ngay' : 'Ra sân'}</a>`}</span>
    </li>`).join('');

    $('#quota').innerHTML = `${D.requiredDone}<small>/${D.required}</small>`;
    $('#days').innerHTML = D.week.map((w) => {
      const dot = w.kind === 'required' ? `req${w.done ? ' done' : w.today ? ' due' : ''}` : w.kind === 'bonus' ? 'bonus' : '';
      const what = w.today ? 'HÔM NAY' : w.done ? 'THẮNG' : w.kind === 'bonus' ? 'GIAO HỮU' : w.kind === 'makeup' ? 'ĐÁ BÙ' : '–';
      return `<li class="day${w.today ? ' today' : ''}"><span class="d">${w.d}</span><span class="dot ${dot}" aria-hidden="true"></span><span class="what${w.done ? ' win' : ''}" title="${w.clip ? esc(w.clip) : ''}">${what}</span><span class="n">${w.mins ? `${w.mins} phút` : `${w.date}/10`}</span></li>`;
    }).join('');
    const sunday = D.week[D.week.length - 1];
    $('#rule-note').innerHTML = `<i class="card-y" aria-hidden="true"></i><b>Thẻ vàng:</b> lỡ trận hôm nay mà không đá bù Chủ nhật ${sunday.date}/10 thì treo giò bài mới tuần sau. Ôn tập không bao giờ bị cấm.`;
    mascotLine($('#home-mascot'), 'trang-chu', `"${D.streak.days} trận bất bại! Tối nay ra sân nốt nha!"`);

    const rnd = mulberry32(20261101), cols = ['#FFFFFF', '#D6B45C', '#DCE6F0', '#FFFFFF', '#78A878', '#D6B45C', '#F2DDD6'];
    $('#crowd').innerHTML = Array.from({ length: 72 }, () => `<i style="background:${cols[Math.floor(rnd() * cols.length)]}"></i>`).join('');

    $('#cov').innerHTML = D.coverage.map((c) => {
      const gap = c.learned - c.planToday;
      return `<li><div class="top"><span>${esc(c.label)}</span><span class="r"><b>${n0(c.learned)}</b> / ${n0(c.goal)} · <span class="${gap < 0 ? 'late' : ''}">${gap < 0 ? `chậm ${n0(-gap)} so với lộ trình` : 'đúng lộ trình'}</span></span></div>
        <div class="track" role="img" aria-label="${esc(c.label)}: đã học ${c.learned}, đã thuộc ${c.mature}, lộ trình hôm nay ${c.planToday}, mục tiêu ${c.goal}">
        <i class="learned" style="width:${(c.learned / c.goal) * 100}%"></i><i class="mature" style="width:${(c.mature / c.goal) * 100}%"></i><i class="mark" style="left:${(c.planToday / c.goal) * 100}%"></i></div></li>`;
    }).join('');

    const last = D.mocks[D.mocks.length - 1];
    const weakest = last.parts.indexOf(Math.min(...last.parts));
    $('#board').innerHTML = `<div class="top">THI THỬ ${esc(last.label)} · CHUNG KẾT ${ddmm(D.learner.examDate).slice(0, 5)}</div>
      <div class="score"><span>HƯNG</span><b>${last.total}–${D.exam.pass}</b><span>ĐIỂM ĐỖ</span></div>
      <div class="bot">Đang dẫn ${last.total - D.exam.pass} điểm · ${esc(D.parts[weakest])} là hàng thủ yếu nhất</div>`;
    $('#mock-finding').innerHTML = `Đề ${last.label}: <b>${last.total}/180</b>, hơn điểm đỗ ${last.total - D.exam.pass} điểm. ${esc(D.parts[weakest])} ${last.parts[weakest]}/60 là phần thấp nhất.`;
  }
  const charts = {
    'trang-chu': () => Charts.line($('#mock-chart'), { labels: D.mocks.map((m) => m.label), series: [{ name: 'Tổng điểm', values: D.mocks.map((m) => m.total) }], yTicks: [60, 80, 100, 120], reference: { value: D.exam.pass, label: `Điểm đỗ ${D.exam.pass}` }, endLabel: true, height: 190 }),
    'on-tap': () => Charts.bars($('#fc-chart'), { labels: D.forecast.map((f) => f.day.split(' ')[0]), values: D.forecast.map((f) => f.cards), highlight: 0, height: 150 }),
    shadowing: () => Charts.line($('#pitch-chart'), {
      labels: D.pitchOrig.map((_, i) => `${nf(1).format((i * (D.lines[2].end - D.lines[2].start)) / (D.pitchOrig.length - 1))} s`),
      series: [{ name: 'Bản gốc', values: D.pitchOrig }, { name: 'Giọng bạn', values: D.pitchMine }],
      yTicks: [180, 200, 220, 240, 260], format: (v) => `${n0(v)} Hz`, tickFormat: (v) => n0(v), height: 210,
      annotations: [{ at: 4, label: 'Lên giọng sớm ở 伺って', short: '伺って' }], legend: '#pitch-legend',
    }),
    jlpt: () => Charts.line($('#trend-chart'), { labels: D.mocks.map((m) => m.label), series: [{ name: 'Tổng điểm', values: D.mocks.map((m) => m.total) }], yTicks: [60, 80, 100, 120], reference: { value: D.exam.pass, label: `Điểm đỗ ${D.exam.pass}` }, endLabel: true, height: 250 }),
  };

  /* ---------------- Ôn tập ---------------- */
  const rv = { i: 0, open: false, done: 0, byKind: Object.fromEntries(D.due.map((k) => [k.kind, 0])) };
  function pitchHtml(read, p) {
    const mora = read.match(/.[ゃゅょャュョ]?/g);
    return mora.map((m, i) => `<span class="${p[i] ? (p[i - 1] === 0 ? 'rise' : 'hi') : ''}">${esc(m)}</span>`).join('');
  }
  function review() {
    const c = D.deck[rv.i];
    $('#review-sub').textContent = `Phiên tối ${ddmm(D.learner.today).slice(0, 5)} · ${D.dueTotal} thẻ đến hạn · FSRS, mức ghi nhớ 90%`;
    $('#review-bar').style.width = `${(rv.done / D.dueTotal) * 100}%`;
    $('#review-count').textContent = `${rv.done} / ${D.dueTotal}`;
    $('#kinds').innerHTML = D.due.map((k) => `<li><span>${esc(k.kind)}</span><span class="r"><b>${rv.byKind[k.kind]}</b> / ${k.count}</span></li>`).join('');
    const back = rv.open ? `<div class="back">
        ${c.pitch ? `<span class="read" lang="ja" role="img" aria-label="Cách đọc ${esc(c.read)}, trọng âm bằng">${pitchHtml(c.read, c.pitch)}</span>` : `<span class="read" lang="ja">${esc(c.read)}</span>`}
        <p class="meaning">${c.hv ? `<b>${esc(c.hv)}</b>` : ''}${esc(c.mean)}</p>
        <button class="btn sm" type="button">Nghe phát âm</button>
        <div class="ex"><p lang="ja">${ruby(c.ex)}</p><p class="vi">${esc(c.exVi)}</p><p class="src"><a class="card-link" href="#shadowing">${esc(c.src)}</a></p></div>
      </div>` : '<p class="prompt">Đọc thế nào, nghĩa là gì?</p>';
    const foot = rv.open
      ? `<div class="grades" role="group" aria-label="Bạn nhớ thẻ này thế nào?">${['Quên', 'Khó', 'Được', 'Dễ'].map((g, j) => `<button type="button" data-grade="${j}" class="${j === 2 ? 'good' : ''}"><b>${g}</b><span>${esc(c.next[j])}</span><kbd>phím ${j + 1}</kbd></button>`).join('')}</div>`
      : '<button class="reveal" type="button" id="reveal">Hiện đáp án <span class="kbd" style="color:#d4d4d0">· phím cách</span></button>';
    mascotLine($('#review-mascot'), 'on-tap', `"${D.dueTotal} thẻ đang chờ khởi động đó!"`);
    $('#flash').innerHTML = `<div class="tags"><span class="pill accent">${esc(c.kind)}</span><span class="pill">${esc(c.level)}</span></div>
      <p class="front" lang="ja">${esc(c.front)}</p>${back}<div class="foot">${foot}</div>`;
  }
  // "VÀO LƯỚI!" phủ lên thẻ 900ms khi chấm Dễ
  let goalTimer;
  function showGoal() {
    const g = $('#goal'), c = D.deck[rv.i];
    g.innerHTML = `<b>VÀO LƯỚI!</b><span>+5 XP · ${esc(c.next[3])} nữa gặp lại</span>`;
    g.classList.add('on'); clearTimeout(goalTimer);
    goalTimer = setTimeout(() => g.classList.remove('on'), 900);
  }
  let moment = null; // khoảnh khắc chuyển cảnh, ghi từ lần bấm [data-moment] gần nhất
  function grade(j) {
    const c = D.deck[rv.i];
    if (j === 3) showGoal();
    rv.done = Math.min(D.dueTotal, rv.done + 1); rv.byKind[c.kind] = Math.min(D.due.find((k) => k.kind === c.kind).count, rv.byKind[c.kind] + 1);
    rv.i = (rv.i + 1) % D.deck.length; rv.open = false; review();
    if (rv.done === D.dueTotal) { moment = 'day-done'; location.hash = '#trang-chu'; return; }
    $('#reveal')?.focus();
  }
  $('#flash').addEventListener('click', (e) => {
    if (e.target.closest('#reveal')) { rv.open = true; review(); $('.grades .good')?.focus(); }
    else if (e.target.closest('[data-grade]')) grade(+e.target.closest('[data-grade]').dataset.grade);
  });

  /* ---------------- Shadowing ---------------- */
  const FURI = { 電話: 'でんわ', 山田: 'やまだ', 商事: 'しょうじ', 田中: 'たなか', 世話: 'せわ', 恐: 'おそ', 入: 'い', 名前: 'なまえ', 伺: 'うかが', 佐藤: 'さとう', 様: 'さま', 申: 'もう', 訳: 'わけ', 鈴木: 'すずき', 席: 'せき', 外: 'はず', 折: 'お', 返: 'かえ', 念: 'ねん', 番号: 'ばんごう', 承知: 'しょうち', 失礼: 'しつれい' };
  const keys = Object.keys(FURI).sort((a, b) => b.length - a.length);
  const furi = (s, kanaOnly) => keys.reduce((acc, k) => acc.split(k).join(kanaOnly ? FURI[k] : `<ruby>${k}<rt>${FURI[k]}</rt></ruby>`), esc(s));
  const sh = { cur: 2, mode: 0, speed: 1, loop: 1, rec: false };
  const MODES = ['Đầy đủ', 'Tiếng Nhật', 'Chỉ kana', 'Ẩn'], SPEEDS = ['0,5×', '0,75×', '1×', '1,25×'], LOOPS = ['1 lần', '3 lần', '5 lần', 'vô hạn'];
  const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`; // taste-skill-ignore: đồng hồ phút:giây
  function shadowing() {
    const c = D.clip, l = D.lines[sh.cur];
    $('#h-shadow').textContent = c.title;
    $('#shadow-sub').textContent = `${c.cat} · ${c.level} · ${D.lines.length} câu · ${mmss(c.length)} · giọng ${c.voice.toLowerCase()} · tốc độ ${c.speed.toLowerCase()}`;
    mascotLine($('#shadow-mascot'), 'shadowing', '"Gâu! Câu 3 lên giọng sớm, chạy lại nhé!"');
    const longEnough = D.recorded.filter((r) => r.recLen / (r.end - r.start) >= 0.7).length;
    const checks = [
      ['Thời gian luyện thực tế', c.practisedMinutes, c.minMinutes, 'phút', c.practisedMinutes >= c.minMinutes],
      ['Ghi âm trọn clip', D.recorded.length, D.lines.length, 'câu', D.recorded.length === D.lines.length],
      ['Bản ghi dài ≥ 70% câu gốc', longEnough, D.recorded.length, 'bản', longEnough === D.recorded.length],
      [`Câu đạt ${c.target} điểm`, D.atTarget, 3, 'cần', D.atTarget >= 3],
    ];
    const valid = checks.every((x) => x[4]);
    $('#shadow-status').textContent = valid ? 'Buổi bắt buộc 2: hợp lệ' : `Buổi bắt buộc 2: còn ${checks.filter((x) => !x[4]).length} điều kiện`;
    $('#checks').innerHTML = checks.map(([t, v, of, u, ok]) => `<li><span class="tick${ok ? ' on' : ''}" role="img" aria-label="${ok ? 'Đạt' : 'Chưa đạt'}"></span><span>${esc(t)}</span><span class="v"><b>${v}</b> / ${of}${u === 'cần' ? '' : ` ${u}`}</span></li>`).join('');

    const text = sh.mode === 3 ? '<p class="sub-vi">Phụ đề đang ẩn. Nghe và nói theo.</p>'
      : `<p class="sub-jp" lang="ja">${furi(l.jp, sh.mode === 2)}</p>${sh.mode === 0 ? `<p class="sub-vi">${esc(l.vi)}</p>` : ''}`;
    $('#player').innerHTML = `<span class="src">Video YouTube nhúng · câu ${sh.cur + 1}/${D.lines.length} · lặp ${LOOPS[sh.loop]}</span><span class="time">${mmss(l.start)} / ${mmss(c.length)}</span>${text}
      <div class="scrub" role="img" aria-label="Vị trí câu ${sh.cur + 1} trong clip"><i style="left:0;width:${(l.start / c.length) * 100}%"></i><i class="seg" style="left:${(l.start / c.length) * 100}%;width:${((l.end - l.start) / c.length) * 100}%"></i></div>`;
    $('#seg-sub').innerHTML = MODES.map((m, i) => `<button type="button" data-mode="${i}" aria-pressed="${i === sh.mode}">${m}</button>`).join('');
    $('#seg-speed').innerHTML = SPEEDS.map((m, i) => `<button type="button" data-speed="${i}" aria-pressed="${i === sh.speed}">${m}</button>`).join('');
    $('#loop').textContent = `Lặp câu: ${LOOPS[sh.loop]}`;
    $('#rec').setAttribute('aria-pressed', sh.rec); $('#rec').textContent = sh.rec ? 'Đang ghi… bấm để dừng' : 'Ghi âm câu này';

    $('#lines-count').textContent = `${D.recorded.length}/${D.lines.length} đã ghi`;
    $('#lines').innerHTML = D.lines.map((x, i) => `<li><button type="button" class="line" data-line="${i}" aria-current="${i === sh.cur}">
      <span class="i">${i + 1}</span><span><span class="jp" lang="ja">${esc(x.jp)}</span>${i === sh.cur ? `<span class="vi" style="display:block">${esc(x.vi)}</span>` : ''}</span>
      <span class="sc ${x.score == null ? 'none' : x.score < c.target ? 'low' : ''}">${x.score == null ? '—' : x.score}</span></button></li>`).join('');

    const p = D.lines[2];
    $('#h-pitch').textContent = 'Cao độ câu 3 so với bản gốc';
    $('#pitch-finding').innerHTML = `Câu 3 được <b>${p.score} điểm</b>, dưới mục tiêu ${c.target} của ${c.level}. ${esc(p.note)}.`;
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-mode],[data-speed],[data-line]');
    if (b) { if (b.dataset.mode) sh.mode = +b.dataset.mode; if (b.dataset.speed) sh.speed = +b.dataset.speed; if (b.dataset.line) sh.cur = +b.dataset.line; shadowing(); }
  });
  $('#loop').addEventListener('click', () => { sh.loop = (sh.loop + 1) % LOOPS.length; shadowing(); });
  $('#rec').addEventListener('click', () => { sh.rec = !sh.rec; shadowing(); });

  /* ---------------- Kanji ---------------- */
  const k = D.kanji; let shown = k.strokes, timer = null;
  function strokes(animateFrom = null) {
    const box = $('#stroke-box');
    const paths = (cls) => k.paths.map((d, i) => `<path class="${cls === 'ink' && i === shown - 1 && shown < k.strokes ? 'current' : ''}" d="${d}" fill="none" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"${cls === 'ink' && i >= shown ? ' style="display:none"' : ''}/>`).join('');
    box.innerHTML = `<svg viewBox="0 0 109 109" role="img" aria-label="Thứ tự nét chữ ${k.char}, đang hiện ${shown} trên ${k.strokes} nét">
      <line class="guide" x1="54.5" y1="0" x2="54.5" y2="109"/><line class="guide" x1="0" y1="54.5" x2="109" y2="54.5"/>
      <g class="ghost">${paths('ghost')}</g><g class="ink">${paths('ink')}</g></svg>`;
    $('#stroke-n').textContent = `Nét ${shown} / ${k.strokes}`;
    if (animateFrom != null && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const p = box.querySelectorAll('.ink path')[animateFrom]; const len = p.getTotalLength();
      p.style.strokeDasharray = len; p.style.strokeDashoffset = len; p.getBoundingClientRect();
      p.style.transition = 'stroke-dashoffset 520ms cubic-bezier(0.22, 1, 0.36, 1)'; p.style.strokeDashoffset = 0;
    }
  }
  function kanji() {
    $('#h-kanji').textContent = `Chữ ${k.hv}: ${k.mean.split(',')[0]}`;
    $('#kanji-sub').textContent = `Kanji mới ${D.newKanji.indexOf(k.char) + 1}/${D.newKanji.length} hôm nay · JLPT ${k.level} · khối Kính ngữ công sở`;
    $('#lesson').innerHTML = D.newKanji.map((c) => `<li><a href="#kanji" lang="ja" aria-label="Chữ ${c}"${c === k.char ? ' aria-current="step"' : ''}>${c}</a></li>`).join('');
    mascotLine($('#kanji-mascot'), 'kanji', '"Tuýt! Nhớ thứ tự nét nhé."');
    $('#k-big').textContent = k.char; $('#k-hv').textContent = k.hv; $('#k-mean').textContent = k.mean;
    $('#facts').innerHTML = `<div><dt>Âm On</dt><dd class="jp" lang="ja">${k.on}</dd></div>
      <div><dt>Âm Kun</dt><dd class="jp" lang="ja">${k.kun[0]}<span style="color:var(--muted)">${k.kun[1]}</span></dd></div>
      <div><dt>Số nét</dt><dd>${k.strokes}</dd></div><div><dt>Cấp độ</dt><dd>JLPT ${k.level}</dd></div>
      <div class="wide"><dt>Bộ thủ cấu thành</dt><dd class="parts" style="margin-top:8px">${k.parts.map((p) => `<a href="#kanji"><b lang="ja">${p.c}</b>${esc(p.name)}</a>`).join('<span aria-hidden="true" style="color:var(--muted)">+</span>')}</dd></div>`;
    $('#h-words').innerHTML = `Từ có chữ <span lang="ja">${k.char}</span> <span class="chip">${k.words.length}</span>`;
    $('#words').innerHTML = k.words.map((w) => `<li class="rowcard"><span class="w" lang="ja"><ruby>${esc(w.w)}<rt>${esc(w.r)}</rt></ruby></span>
      <span class="body"><span class="hvs">${esc(w.hv)}</span><span style="display:block">${esc(w.vi)}</span></span><span class="pill">${w.lvl}</span>
      <span class="act"><button class="btn sm" type="button" aria-pressed="${w.inSrs}" data-srs>${w.inSrs ? 'Đã thêm' : 'Thêm vào ôn'}</button></span></li>`).join('');
    $('#mnemo').innerHTML = esc(k.mnemo).replace(/([亻司])/g, '<span class="jp" lang="ja">$1</span>');
    $('#k-ex').innerHTML = ruby(k.example); $('#k-ex-vi').textContent = k.exampleVi;
    $('#k-next').innerHTML = `Đã nhớ, sang chữ <span lang="ja">${D.newKanji[D.newKanji.indexOf(k.char) + 1]}</span>`;
    strokes();
  }
  $('#stroke-play').addEventListener('click', () => {
    clearInterval(timer); shown = 1; strokes(0);
    timer = setInterval(() => { if (shown >= k.strokes) return clearInterval(timer); shown++; strokes(shown - 1); }, 620);
  });
  $('#stroke-step').addEventListener('click', () => { clearInterval(timer); shown = shown >= k.strokes ? 1 : shown + 1; strokes(shown - 1); });
  $('#words').addEventListener('click', (e) => {
    const b = e.target.closest('[data-srs]'); if (!b) return;
    const on = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', on); b.textContent = on ? 'Đã thêm' : 'Thêm vào ôn';
  });

  /* ---------------- JLPT ---------------- */
  function jlpt() {
    const last = D.mocks[D.mocks.length - 1]; const [v, cls] = verdict(last);
    $('#jlpt-sub').textContent = `Thi Chủ nhật ${ddmm(D.learner.examDate)} · còn ${daysLeft} ngày · đề gần nhất ${last.total}/180`;
    $('#h-last').textContent = `Đề ngày ${last.label}`;
    mascotLine($('#jlpt-mascot'), 'jlpt', `"Đang dẫn ${last.total}–${D.exam.pass}. Giữ chắc khung thành!"`);
    $('#last-total').innerHTML = `${last.total}<small>/180</small>`;
    $('#last-verdict').textContent = v; $('#last-verdict').className = `pill ${cls}`;
    const low = Math.min(...last.parts);
    $('#parts-score').innerHTML = last.parts.map((p, i) => `<li><div class="top"><b>${esc(D.parts[i])}</b><span><b style="color:var(--text)">${p}</b> / 60</span></div>
      <div class="track" role="img" aria-label="${esc(D.parts[i])} ${p} trên 60, điểm liệt ${D.exam.sectionMin}"><i class="${p === low ? 'mature' : 'learned'}" style="width:${(p / 60) * 100}%${p === low ? '' : ';opacity:1;background:var(--chart-muted)'}"></i><i class="mark" style="left:${(D.exam.sectionMin / 60) * 100}%"></i></div></li>`).join('');
    const acc = [...D.byType].sort((a, b) => a.right / a.of - b.right / b.of);
    $('#acc-meta').textContent = `đề ${last.label}, yếu nhất trước`;
    $('#acc').innerHTML = acc.map((t, i) => `<li class="${i === 0 ? 'weak' : ''}"><span>${esc(t.label)}</span><span class="bar"><i style="width:${(t.right / t.of) * 100}%"></i></span><span class="p">${nf(0).format((t.right / t.of) * 100)}%<span>${t.right}/${t.of} câu</span></span></li>`).join('');
    $('#drill').textContent = `Luyện 10 câu ${acc[0].label}`;
    $('#hist-count').textContent = D.mocks.length;
    $('#hist').innerHTML = `<thead><tr><th>Ngày</th><th class="n">Kiến thức</th><th class="n">Đọc</th><th class="n">Nghe</th><th class="n">Tổng</th><th>Dự đoán</th></tr></thead><tbody>${[...D.mocks].reverse().map((m) => {
      const [vv, cc] = verdict(m);
      return `<tr><td>${m.label}</td>${m.parts.map((p) => `<td class="n">${p}</td>`).join('')}<td class="n"><b style="font-weight:500">${m.total}</b></td><td><span class="pill ${cc}">${vv}</span></td></tr>`;
    }).join('')}</tbody>`;
  }

  /* ---------------- router ---------------- */
  const VIEWS = { 'trang-chu': 'Trang chủ', 'on-tap': 'Ôn tập', shadowing: 'Shadowing', kanji: 'Kanji', jlpt: 'JLPT' };
  home(); review(); shadowing(); kanji(); jlpt();
  const MAIN = $('main.canvas'), SECTIONS = Object.fromEntries([...document.querySelectorAll('[data-view]')].map((s) => { s.hidden = false; return [s.dataset.view, s]; }));
  function route() {
    const id = VIEWS[location.hash.slice(1)] ? location.hash.slice(1) : 'trang-chu';
    // chỉ màn hình đang mở nằm trong DOM: một h1 cho mỗi màn hình; các nút giữ nguyên listener khi tách ra
    MAIN.replaceChildren(SECTIONS[id]);
    document.querySelectorAll('[data-nav]').forEach((a) => (a.dataset.nav === id ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
    $('#topbar-title').textContent = VIEWS[id];
    document.title = `${VIEWS[id]} · Nihon Nihon`;
    charts[id]?.();
    window.scrollTo(0, 0);
    SECTIONS[id].querySelector('h1')?.focus({ preventScroll: true });
    current = id;
  }
  let current = null, forceFull = false;
  const runner = Transitions.create({ layer: $('#fx'), content: MAIN, reducedMotion: () => !forceFull && matchMedia('(prefers-reduced-motion: reduce)').matches, stepped: () => true });
  const target = () => (VIEWS[location.hash.slice(1)] ? location.hash.slice(1) : 'trang-chu');
  addEventListener('click', (e) => { const m = e.target.closest?.('[data-moment]'); if (m) moment = m.dataset.moment; }, true);
  async function go() {
    const m = moment; moment = null;
    const r = await runner.run(Transitions.forMoment(m), () => route());
    // lần bấm bị bỏ qua: lượt đang chạy đọc location.hash lúc đổi màn, và tự kiểm tra lại sau khi xong
    if (r.mode === 'skipped') return;
    // hash đổi sau lúc đổi màn: đưa màn hình về khớp URL
    if (target() !== current) route();
  }
  addEventListener('hashchange', go);
  window.NihonDebug = {
    async go(view, m, o = {}) {
      forceFull = !!o.force;
      try { return await runner.run(Transitions.forMoment(m), () => { history.replaceState(null, '', '#' + view); route(); }); }
      finally { forceFull = false; }
    },
  };
  let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => charts[location.hash.slice(1) || 'trang-chu']?.(), 150); });
  document.fonts?.ready.then(route); route();

  // phím tắt: ôn tập (cách, 1–4) và shadowing (←, →, R, L)
  addEventListener('keydown', (e) => {
    if (e.target.closest('input, textarea') || e.ctrlKey || e.metaKey || e.altKey) return;
    const id = location.hash.slice(1);
    if (id === 'on-tap') {
      if (e.key === ' ' && !rv.open) { e.preventDefault(); rv.open = true; review(); }
      else if (rv.open && /^[1-4]$/.test(e.key)) grade(+e.key - 1);
    } else if (id === 'shadowing') {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { sh.cur = Math.max(0, Math.min(D.lines.length - 1, sh.cur + (e.key === 'ArrowRight' ? 1 : -1))); shadowing(); }
      else if (e.key.toLowerCase() === 'r') { sh.rec = !sh.rec; shadowing(); }
      else if (e.key.toLowerCase() === 'l') { sh.loop = (sh.loop + 1) % LOOPS.length; shadowing(); }
    }
  });
})();
