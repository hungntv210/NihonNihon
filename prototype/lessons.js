/* Sample lessons and browser-local practice; no service or account required. */
(function (root) {
  'use strict';
  const vocab = [
    { id: 'v1', word: '伺う', kana: 'うかがう', meaning: 'hỏi; đến thăm (khiêm nhường)', level: 'N3', topic: 'Công sở', example: '明日の午後、御社に伺います。', vi: 'Chiều mai tôi xin phép đến thăm quý công ty.' },
    { id: 'v2', word: '拝見する', kana: 'はいけんする', meaning: 'xem (khiêm nhường)', level: 'N3', topic: 'Công sở', example: '資料を拝見しました。', vi: 'Tôi đã xem tài liệu.' },
    { id: 'v3', word: '承知する', kana: 'しょうちする', meaning: 'hiểu; nắm được; đồng ý', level: 'N3', topic: 'Công sở', example: '承知しました。すぐに確認します。', vi: 'Tôi hiểu rồi. Tôi sẽ kiểm tra ngay.' },
    { id: 'v4', word: '予約', kana: 'よやく', meaning: 'việc đặt trước; đặt chỗ', level: 'N4', topic: 'Đời sống', example: 'レストランを予約しました。', vi: 'Tôi đã đặt chỗ ở nhà hàng.' },
    { id: 'v5', word: '確認', kana: 'かくにん', meaning: 'sự xác nhận; kiểm tra lại', level: 'N3', topic: 'Công sở', example: '時間を確認してください。', vi: 'Hãy kiểm tra lại thời gian.' },
    { id: 'v6', word: '間に合う', kana: 'まにあう', meaning: 'kịp giờ; kịp lúc', level: 'N4', topic: 'Đời sống', example: '電車に間に合いました。', vi: 'Tôi đã kịp chuyến tàu.' },
    { id: 'v7', word: '食べる', kana: 'たべる', meaning: 'ăn', level: 'N5', topic: 'Đời sống', example: '毎朝、パンを食べます。', vi: 'Mỗi sáng tôi ăn bánh mì.' },
    { id: 'v8', word: '検討', kana: 'けんとう', meaning: 'sự xem xét; cân nhắc', level: 'N2', topic: 'Công sở', example: '新しい提案を検討しています。', vi: 'Chúng tôi đang xem xét đề xuất mới.' },
  ];
  const grammar = [
    { id: 'g1', title: '〜させていただく', level: 'N3', meaning: 'Xin phép được làm…', form: 'Động từ thể sai khiến bỏ る + ていただく', explanation: 'Diễn đạt khiêm nhường khi làm điều gì đó với sự cho phép của người khác và nhận được lợi ích từ việc đó. Tránh dùng cho mọi hành động chỉ để làm câu nghe lịch sự hơn.', example: '本日は、私が説明させていただきます。', vi: 'Hôm nay, xin phép để tôi trình bày.', questions: [
      { prompt: 'Xin phép nghỉ ngày mai: 明日、休ま＿＿いただきます。', options: ['せて', 'されて', 'して'], answer: 0, why: '休む → 休ませる → 休ませていただく.' },
      { prompt: 'Cách nói nào là lời xin phép trình bày?', options: ['説明してあげます。', '説明させていただけますか。', '説明されます。'], answer: 1, why: '〜させていただけますか là cách hỏi xin phép khiêm nhường.' },
    ] },
    { id: 'g2', title: '〜ようにする', level: 'N4', meaning: 'Cố gắng tạo thói quen…', form: 'V thể từ điển / Vない + ようにする', explanation: 'Nói về nỗ lực có chủ ý để thường xuyên làm hoặc tránh làm một việc. ようにしている diễn tả việc duy trì nỗ lực đó.', example: '毎日、日本語を聞くようにしています。', vi: 'Tôi cố gắng nghe tiếng Nhật mỗi ngày.', questions: [
      { prompt: '毎日、野菜を＿＿ようにしています。', options: ['食べる', '食べて', '食べたの'], answer: 0, why: 'Dùng động từ thể từ điển trước ようにする.' },
      { prompt: 'Cố gắng không quên: 忘れ＿＿ようにします。', options: ['て', 'た', 'ない'], answer: 2, why: 'Vない + ようにする: cố gắng không làm gì.' },
    ] },
    { id: 'g3', title: '〜にもかかわらず', level: 'N2', meaning: 'Mặc dù… nhưng…', form: 'V/Aい thể thường + にもかかわらず; N/Aな + (である)にもかかわらず', explanation: 'Nêu kết quả trái với điều thường được dự đoán. Cách nói khá trang trọng, thường gặp trong văn viết và thông báo.', example: '雨にもかかわらず、多くの人が集まりました。', vi: 'Mặc dù trời mưa, rất nhiều người vẫn tụ họp.', questions: [
      { prompt: '雨にもかかわらず、試合は＿＿。', options: ['中止になりました', '行われました', '雨でした'], answer: 1, why: 'Trời mưa nhưng trận đấu vẫn diễn ra: kết quả trái dự đoán.' },
      { prompt: 'Ý nghĩa của にもかかわらず gần với…', options: ['bởi vì', 'để làm gì', 'mặc dù'], answer: 2, why: 'Mẫu câu này chỉ sự tương phản, không phải nguyên nhân hay mục đích.' },
    ] },
  ];
  const readings = [
    { id: 'r1', title: 'Một lời nhắn từ đồng nghiệp', level: 'N3', minutes: 3, topic: 'Công sở', paragraphs: [
      '<ruby>田中<rt>たなか</rt></ruby>さんへ。お<ruby>疲<rt>つか</rt></ruby>れさまです。',
      '<ruby>明日<rt>あした</rt></ruby>の<ruby>会議<rt>かいぎ</rt></ruby>は、<ruby>午後<rt>ごご</rt></ruby>２<ruby>時<rt>じ</rt></ruby>から３<ruby>時<rt>じ</rt></ruby>に<ruby>変更<rt>へんこう</rt></ruby>になりました。<ruby>場所<rt>ばしょ</rt></ruby>は２<ruby>階<rt>かい</rt></ruby>の<ruby>会議室<rt>かいぎしつ</rt></ruby>です。',
      '<ruby>新<rt>あたら</rt></ruby>しい<ruby>資料<rt>しりょう</rt></ruby>をメールで<ruby>送<rt>おく</rt></ruby>りましたので、<ruby>会議<rt>かいぎ</rt></ruby>の<ruby>前<rt>まえ</rt></ruby>に<ruby>確認<rt>かくにん</rt></ruby>してください。<ruby>印刷<rt>いんさつ</rt></ruby>は<ruby>必要<rt>ひつよう</rt></ruby>ありません。よろしくお<ruby>願<rt>ねが</rt></ruby>いします。<ruby>山田<rt>やまだ</rt></ruby>',
    ], translation: 'Gửi anh/chị Tanaka. Cảm ơn anh/chị đã làm việc chăm chỉ. Cuộc họp ngày mai đã được đổi từ 2 giờ sang 3 giờ chiều. Địa điểm là phòng họp tầng 2. Tôi đã gửi tài liệu mới qua email, vì vậy hãy kiểm tra trước cuộc họp. Không cần in tài liệu. Mong anh/chị hỗ trợ. Yamada.', questions: [
      { prompt: 'Cuộc họp ngày mai bắt đầu lúc mấy giờ?', options: ['2 giờ chiều', '3 giờ chiều', '3 giờ sáng'], answer: 1, why: '午後２時から３時に変更: đổi từ 2 giờ sang 3 giờ chiều.' },
      { prompt: 'Tanaka cần làm gì trước cuộc họp?', options: ['In tài liệu', 'Gửi email cho khách', 'Kiểm tra tài liệu mới'], answer: 2, why: '会議の前に確認してください. Đoạn sau ghi rõ không cần in.' },
    ] },
    { id: 'r2', title: 'Cuối tuần ở thư viện', level: 'N4', minutes: 2, topic: 'Đời sống', paragraphs: [
      '<ruby>日曜日<rt>にちようび</rt></ruby>、<ruby>私<rt>わたし</rt></ruby>は<ruby>駅<rt>えき</rt></ruby>の<ruby>近<rt>ちか</rt></ruby>くの<ruby>図書館<rt>としょかん</rt></ruby>に<ruby>行<rt>い</rt></ruby>きました。',
      '<ruby>朝<rt>あさ</rt></ruby>９<ruby>時<rt>じ</rt></ruby>に<ruby>着<rt>つ</rt></ruby>きましたが、<ruby>図書館<rt>としょかん</rt></ruby>は１０<ruby>時<rt>じ</rt></ruby>に<ruby>開<rt>あ</rt></ruby>きます。それで、<ruby>隣<rt>となり</rt></ruby>のカフェでコーヒーを<ruby>飲<rt>の</rt></ruby>みながら<ruby>待<rt>ま</rt></ruby>ちました。',
      '<ruby>図書館<rt>としょかん</rt></ruby>で<ruby>日本<rt>にほん</rt></ruby>の<ruby>料理<rt>りょうり</rt></ruby>の<ruby>本<rt>ほん</rt></ruby>を２<ruby>冊<rt>さつ</rt></ruby><ruby>借<rt>か</rt></ruby>りました。<ruby>来週<rt>らいしゅう</rt></ruby>、<ruby>家<rt>いえ</rt></ruby>で<ruby>作<rt>つく</rt></ruby>ってみたいです。',
    ], translation: 'Chủ nhật, tôi đến thư viện gần ga. Tôi đến lúc 9 giờ sáng nhưng thư viện mở cửa lúc 10 giờ. Vì thế tôi vừa uống cà phê vừa đợi ở quán bên cạnh. Tôi đã mượn hai cuốn sách về món ăn Nhật. Tuần sau tôi muốn thử nấu ở nhà.', questions: [
      { prompt: 'Vì sao người viết đợi ở quán cà phê?', options: ['Thư viện chưa mở cửa', 'Đang đợi bạn', 'Không tìm được sách'], answer: 0, why: 'Người viết đến lúc 9 giờ, trong khi thư viện mở lúc 10 giờ.' },
      { prompt: 'Người viết đã mượn sách về chủ đề gì?', options: ['Du lịch', 'Nấu ăn Nhật', 'Học tiếng Nhật'], answer: 1, why: '日本の料理の本: sách về món ăn Nhật.' },
    ] },
  ];
  const conversations = [
    { id: 'c1', title: 'Đặt bàn tại nhà hàng', level: 'N4', role: 'Bạn là khách gọi điện đặt bàn.', steps: [
      { jp: 'お電話ありがとうございます。レストランさくらです。', vi: 'Cảm ơn quý khách đã gọi. Đây là nhà hàng Sakura.', options: ['今夜７時に、２名で予約したいんですが。', '昨日は楽しかったです。'], answer: 0, reply: 'Vâng, đặt bàn cho 2 người lúc 7 giờ tối nay.', why: 'Nêu rõ giờ, số người và mong muốn đặt bàn.' },
      { jp: 'かしこまりました。お名前をお願いします。', vi: 'Vâng ạ. Xin cho biết tên của quý khách.', options: ['７時です。', 'フンと申します。'], answer: 1, reply: 'Cảm ơn anh Hưng.', why: '〜と申します là cách giới thiệu tên lịch sự.' },
      { jp: '７時にお待ちしております。', vi: 'Chúng tôi xin đợi quý khách lúc 7 giờ.', options: ['ありがとうございます。よろしくお願いします。', '名前は何ですか。'], answer: 0, reply: 'Rất hân hạnh được đón tiếp quý khách.', why: 'Cảm ơn và xác nhận lịch sự để kết thúc cuộc gọi.' },
    ] },
    { id: 'c2', title: 'Nhận điện thoại tại công ty', level: 'N3', role: 'Bạn là nhân viên tiếp nhận cuộc gọi của khách.', steps: [
      { jp: '田中さんはいらっしゃいますか。', vi: 'Anh/chị Tanaka có ở đó không ạ?', options: ['申し訳ございません。田中はただいま席を外しております。', '知らないよ。'], answer: 0, reply: 'Vậy à, anh/chị ấy đang không có ở chỗ ngồi.', why: 'Nói lịch sự rằng đồng nghiệp đang vắng mặt; không dùng kính ngữ cho người công ty mình khi nói với khách.' },
      { jp: 'では、後でまた電話します。', vi: 'Vậy lát nữa tôi sẽ gọi lại.', options: ['電話しないでください。', '承知いたしました。お名前を伺ってもよろしいでしょうか。'], answer: 1, reply: 'Tôi là Sato của công ty Sakura.', why: 'Xác nhận và xin tên người gọi bằng khiêm nhường ngữ.' },
      { jp: 'さくら商事の佐藤です。よろしくお願いします。', vi: 'Tôi là Sato của công ty Sakura. Nhờ anh/chị giúp.', options: ['佐藤様ですね。田中に申し伝えます。', '佐藤さんに聞いてください。'], answer: 0, reply: 'Cảm ơn. Chào anh/chị.', why: 'Nhắc lại tên khách và hứa chuyển lời cho đồng nghiệp.' },
    ] },
  ];
  const normalize = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim();
  function filterWords(query, level, savedOnly, saved) {
    const q = normalize(query);
    return vocab.filter(v => (!level || v.level === level) && (!savedOnly || saved.includes(v.id)) && normalize(`${v.word} ${v.kana} ${v.meaning} ${v.topic}`).includes(q));
  }
  function readProgress(raw) {
    try {
      const parsed = JSON.parse(raw) || {};
      return Object.fromEntries([['saved', vocab], ['grammar', grammar], ['reading', readings], ['conversation', conversations]].map(([key, items]) => [key, Array.isArray(parsed[key]) ? [...new Set(parsed[key].filter(id => items.some(item => item.id === id)))] : []]));
    } catch { return { saved: [], grammar: [], reading: [], conversation: [] }; }
  }
  const api = { vocab, grammar, readings, conversations, filterWords, readProgress };
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof document === 'undefined') return;

  const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  let progress;
  try { progress = readProgress(localStorage.getItem('nihon-practice-v1')); } catch { progress = readProgress(null); }
  const roots = {};
  const state = { query: '', level: '', savedOnly: false, grammar: 'g1', reading: 'r1', conversation: 'c1', furigana: true, translation: false, step: 0, accepted: false };
  const main = document.querySelector('main');
  const names = { 'tu-vung': 'Từ vựng', 'ngu-phap': 'Ngữ pháp', doc: 'Đọc', 'giao-tiep': 'Giao tiếp' };
  function save() {
    try { localStorage.setItem('nihon-practice-v1', JSON.stringify(progress)); }
    catch { document.querySelector('#practice-status').textContent = 'Trình duyệt không cho lưu. Tiến độ chỉ giữ trong lần mở này.'; }
  }
  function complete(kind, id) { if (!progress[kind].includes(id)) progress[kind].push(id); save(); }
  for (const [id, name] of Object.entries(names)) {
    const section = document.createElement('section');
    section.dataset.view = id; section.className = 'col view-tight practice-view'; section.hidden = true;
    section.innerHTML = `<div class="title-row"><div><h1 tabindex="-1">${name}</h1><p class="sub">Thư viện mẫu · học và luyện thử theo nhịp của bạn</p></div><span class="pill accent">N5 → N2</span></div><div class="practice-content"></div>`;
    roots[id] = section; main.append(section);
  }
  const host = id => roots[id].querySelector('.practice-content');
  function focusLesson(id) {
    const title = roots[id].querySelector('.lesson-detail > h2');
    title.tabIndex = -1; title.focus();
  }
  function exercise(questions, kind, id) {
    return `<form class="exercise" data-kind="${kind}" data-lesson="${id}"><header><h2>Kiểm tra nhanh</h2><span class="meta">${questions.length} câu · chọn một đáp án mỗi câu</span></header>${questions.map((q, i) => `<fieldset><legend>${i + 1}. ${esc(q.prompt)}</legend>${q.options.map((o, j) => `<label class="answer-option"><input type="radio" name="q${i}" value="${j}" required><span lang="ja">${esc(o)}</span></label>`).join('')}<p class="answer-note" id="${id}-answer-${i}"></p></fieldset>`).join('')}<button class="btn primary" type="submit">Kiểm tra đáp án</button><p class="exercise-result" role="status"></p></form>`;
  }
  function vocabQuestions() {
    return vocab.slice(0, 3).map((v, i) => ({ prompt: `${v.word} (${v.kana}) có nghĩa là gì?`, options: [vocab[(i+1)%3].meaning, v.meaning, vocab[(i+2)%3].meaning], answer: 1, why: `${v.word}: ${v.meaning}.` }));
  }
  function renderVocab() {
    host('tu-vung').innerHTML = `<div class="practice-toolbar"><label class="search-field">Tìm từ vựng<input type="search" id="vocab-search" placeholder="Tiếng Nhật, cách đọc hoặc nghĩa…" value="${esc(state.query)}"></label><label>Cấp độ<select id="vocab-level"><option value="">Tất cả cấp độ</option>${['N5','N4','N3','N2'].map(l => `<option${state.level === l ? ' selected' : ''}>${l}</option>`).join('')}</select></label><label class="saved-filter"><input id="vocab-saved" type="checkbox"${state.savedOnly ? ' checked' : ''}> Chỉ từ đã lưu</label><button class="btn primary" id="vocab-practice">Luyện 3 từ công sở</button></div><p class="library-count" role="status"></p><div class="vocab-results"></div><div id="vocab-exercise"></div>`;
    renderWords();
  }
  function renderWords() {
    const matches = filterWords(state.query, state.level, state.savedOnly, progress.saved);
    host('tu-vung').querySelector('.library-count').textContent = `${matches.length} từ trong thư viện mẫu · ${progress.saved.length} từ đã lưu`;
    host('tu-vung').querySelector('.vocab-results').innerHTML = matches.length ? matches.map(v => `<article class="panel vocab-card"><div><span class="pill">${v.level}</span><span class="meta">${v.topic}</span></div><h2 lang="ja"><ruby>${v.word}<rt>${v.kana}</rt></ruby></h2><p>${esc(v.meaning)}</p><details><summary>Ví dụ trong ngữ cảnh</summary><p lang="ja">${v.example}</p><p class="meta">${v.vi}</p></details><button class="btn sm" data-save-word="${v.id}" aria-pressed="${progress.saved.includes(v.id)}">${progress.saved.includes(v.id) ? 'Đã lưu · bỏ lưu' : 'Lưu từ'}</button></article>`).join('') : '<div class="empty">Không có từ phù hợp. Thử bỏ bộ lọc hoặc tìm từ khác.</div>';
  }
  function lessonNav(items, active, attr, done) {
    return `<aside class="panel lesson-library"><h2>Chọn bài học</h2>${items.map(item => `<button class="lesson-choice" data-${attr}="${item.id}" aria-pressed="${item.id === active}"><span class="pill">${item.level}</span><b>${item.title}</b><small>${done.includes(item.id) ? '✓ Đã hoàn thành' : 'Chưa hoàn thành'}</small></button>`).join('')}</aside>`;
  }
  function renderGrammar() {
    const g = grammar.find(g => g.id === state.grammar);
    host('ngu-phap').innerHTML = `<div class="lesson-layout">${lessonNav(grammar, g.id, 'grammar', progress.grammar)}<article class="panel lesson-detail"><span class="eyebrow">NGỮ PHÁP ${g.level}</span><h2 lang="ja">${g.title}</h2><p class="lesson-meaning">${g.meaning}</p><div class="lesson-formula"><b>Cấu trúc</b><p>${g.form}</p></div><p>${g.explanation}</p><blockquote><p lang="ja">${g.example}</p><p>${g.vi}</p></blockquote>${exercise(g.questions, 'grammar', g.id)}</article></div>`;
  }
  function renderReading() {
    const r = readings.find(r => r.id === state.reading);
    host('doc').innerHTML = `<div class="lesson-layout">${lessonNav(readings, r.id, 'reading', progress.reading)}<article class="panel lesson-detail"><span class="eyebrow">${r.topic.toUpperCase()} · ${r.minutes} PHÚT ĐỌC</span><h2>${r.title}</h2><div class="controls"><button class="btn sm" id="reading-furigana" aria-pressed="${state.furigana}">Furigana: ${state.furigana ? 'bật' : 'tắt'}</button><button class="btn sm" id="reading-translation" aria-expanded="${state.translation}" aria-controls="reading-translation-text">${state.translation ? 'Ẩn' : 'Xem'} bản dịch</button></div><div class="reading-passage${state.furigana ? '' : ' no-furigana'}" lang="ja">${r.paragraphs.map(p => `<p>${p}</p>`).join('')}</div><div class="reading-translation" id="reading-translation-text"${state.translation ? '' : ' hidden'}>${r.translation}</div>${exercise(r.questions, 'reading', r.id)}</article></div>`;
  }
  function renderConversation() {
    const c = conversations.find(c => c.id === state.conversation), step = c.steps[state.step];
    host('giao-tiep').innerHTML = `<div class="lesson-layout">${lessonNav(conversations, c.id, 'conversation', progress.conversation)}<article class="panel lesson-detail"><span class="eyebrow">HỘI THOẠI CÓ HƯỚNG DẪN · ${c.level}</span><h2>${c.title}</h2><p class="lesson-meaning">${c.role}</p>${step ? `<p class="meta">Lượt ${state.step + 1} / ${c.steps.length} · chọn lời đáp phù hợp</p><div class="dialogue-bubble"><span class="meta">Người đối thoại</span><p lang="ja">${step.jp}</p><p>${step.vi}</p></div><div class="dialogue-options">${step.options.map((o,i) => `<button class="btn" data-reply="${i}"${state.accepted ? ' disabled' : ''} lang="ja">${o}</button>`).join('')}</div><div class="conversation-feedback" role="status">${state.accepted ? `<b>Phù hợp!</b> ${step.why}<p>${step.reply}</p>` : ''}</div>${state.accepted ? '<button class="btn primary" id="conversation-next">Tiếp tục hội thoại</button>' : ''}` : `<div class="practice-complete"><span aria-hidden="true">✓</span><h3>Bạn đã hoàn thành tình huống!</h3><p>Đọc lại các lời đáp để luyện nói thành tiếng.</p>${c.steps.map(s => `<p lang="ja">${s.options[s.answer]}</p>`).join('')}<button class="btn primary" id="conversation-restart">Luyện lại từ đầu</button></div>`}</article></div>`;
  }
  document.addEventListener('input', e => {
    if (e.target.id === 'vocab-search') { state.query = e.target.value; renderWords(); }
  });
  document.addEventListener('change', e => {
    if (e.target.id === 'vocab-level') { state.level = e.target.value; renderWords(); }
    if (e.target.id === 'vocab-saved') { state.savedOnly = e.target.checked; renderWords(); }
  });
  document.addEventListener('click', e => {
    const button = e.target.closest('button'); if (!button) return;
    if (button.dataset.saveWord) {
      const id = button.dataset.saveWord;
      if (!vocab.some(v => v.id === id)) return;
      progress.saved = progress.saved.includes(id) ? progress.saved.filter(v => v !== id) : [...progress.saved, id];
      save(); renderWords();
      const next = host('tu-vung').querySelector(`[data-save-word="${id}"]`) || host('tu-vung').querySelector('.library-count');
      next.tabIndex = 0; next.focus({ preventScroll: true });
    }
    if (button.id === 'vocab-practice') { host('tu-vung').querySelector('#vocab-exercise').innerHTML = `<section class="panel">${exercise(vocabQuestions(), 'vocab', 'vocab')}</section>`; host('tu-vung').querySelector('#vocab-exercise legend').scrollIntoView({block:'center'}); }
    if (button.dataset.grammar) { state.grammar = button.dataset.grammar; renderGrammar(); focusLesson('ngu-phap'); }
    if (button.dataset.reading) { state.reading = button.dataset.reading; renderReading(); focusLesson('doc'); }
    if (button.id === 'reading-furigana') {
      state.furigana = !state.furigana; button.setAttribute('aria-pressed', state.furigana); button.textContent = `Furigana: ${state.furigana ? 'bật' : 'tắt'}`;
      host('doc').querySelector('.reading-passage').classList.toggle('no-furigana', !state.furigana);
    }
    if (button.id === 'reading-translation') {
      state.translation = !state.translation; button.setAttribute('aria-expanded', state.translation); button.textContent = `${state.translation ? 'Ẩn' : 'Xem'} bản dịch`;
      host('doc').querySelector('.reading-translation').hidden = !state.translation;
    }
    if (button.dataset.conversation) { state.conversation = button.dataset.conversation; state.step = 0; state.accepted = false; renderConversation(); focusLesson('giao-tiep'); }
    if (button.dataset.reply !== undefined) {
      const c = conversations.find(c => c.id === state.conversation), step = c.steps[state.step];
      if (!step || state.accepted) return;
      if (+button.dataset.reply === step.answer) { state.accepted = true; renderConversation(); host('giao-tiep').querySelector('#conversation-next').focus(); }
      else { host('giao-tiep').querySelector('.conversation-feedback').textContent = `Chưa phù hợp. ${step.why} Hãy chọn lại nhé.`; button.disabled = true; }
    }
    if (button.id === 'conversation-next' && state.accepted) {
      state.step++; state.accepted = false;
      const c = conversations.find(c => c.id === state.conversation);
      if (state.step === c.steps.length) complete('conversation', c.id);
      renderConversation();
      focusLesson('giao-tiep');
    }
    if (button.id === 'conversation-restart') { state.step = 0; state.accepted = false; renderConversation(); focusLesson('giao-tiep'); }
  });
  document.addEventListener('submit', e => {
    const form = e.target.closest('.exercise'); if (!form) return; e.preventDefault();
    const kind = form.dataset.kind, id = form.dataset.lesson;
    const questions = kind === 'vocab' ? vocabQuestions() : (kind === 'grammar' ? grammar : readings).find(item => item.id === id)?.questions;
    if (!questions || !form.reportValidity()) return;
    let correct = 0;
    questions.forEach((q, i) => {
      const selected = Number(new FormData(form).get(`q${i}`)), ok = selected === q.answer;
      if (ok) correct++;
      const note = form.querySelector(`#${id}-answer-${i}`);
      note.textContent = `${ok ? '✓ Chính xác.' : 'Chưa đúng.'} ${q.why}`; note.className = `answer-note ${ok ? 'correct' : 'incorrect'}`;
    });
    const passed = correct === questions.length;
    form.querySelector('.exercise-result').textContent = `${correct}/${questions.length} câu đúng. ${passed ? 'Hoàn thành! Bạn có thể chọn bài tiếp theo.' : 'Đọc giải thích, sửa đáp án rồi kiểm tra lại nhé.'}`;
    if (passed && kind !== 'vocab') {
      complete(kind, id);
      const nav = roots[kind === 'grammar' ? 'ngu-phap' : 'doc'].querySelector(`[data-${kind}="${id}"] small`);
      nav.textContent = '✓ Đã hoàn thành';
    }
  });
  const status = document.createElement('p'); status.id = 'practice-status'; status.className = 'practice-storage-note'; status.setAttribute('role', 'status'); main.after(status);
  status.textContent = 'Dùng thử với dữ liệu mẫu · từ đã lưu và bài hoàn thành được giữ trên trình duyệt này.';
  renderVocab(); renderGrammar(); renderReading(); renderConversation();
})(globalThis);
