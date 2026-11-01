// Dữ liệu mẫu cho prototype Nihon Nihon. Mọi con số trên màn hình đều được tính từ đây.
// Thời điểm giả lập: Thứ Năm 21/10/2027, 19:40 — tuần 51 của lộ trình N5 → N2 (khối "Kính ngữ công sở").
// Toàn bộ là dữ liệu mẫu: thay bằng dữ liệu thật của người học trước khi dùng.
const D = (() => {
  const learner = { name: 'Hưng', target: 'N3', examDate: '2027-12-05', today: '2027-10-21', now: '19:40', weekOfPlan: 51, planWeeks: 87 };

  // Hàng ôn hôm nay theo loại thẻ
  const due = [
    { kind: 'Từ vựng', count: 52, done: 0 },
    { kind: 'Kanji', count: 21, done: 0 },
    { kind: 'Ngữ pháp', count: 9, done: 0 },
    { kind: 'Câu shadowing', count: 5, done: 0 },
  ];
  const dueTotal = due.reduce((s, r) => s + r.count, 0);

  // Dự báo số thẻ đến hạn 7 ngày tới (hôm nay là phần tử đầu)
  const forecast = [
    { day: 'T5 21', cards: dueTotal }, { day: 'T6 22', cards: 74 }, { day: 'T7 23', cards: 69 },
    { day: 'CN 24', cards: 58 }, { day: 'T2 25', cards: 92 }, { day: 'T3 26', cards: 81 }, { day: 'T4 27', cards: 77 },
  ];

  // Việc hôm nay, theo thứ tự buổi học trong lộ trình (mục 3.1)
  const newKanji = ['申', '伺', '拝'];
  const today = [
    { id: 'srs', title: `Ôn ${dueTotal} thẻ đến hạn`, sub: due.map((r) => `${r.count} ${r.kind.toLowerCase()}`).join(' · '), mins: 25, href: '#on-tap', done: false },
    { id: 'recog', title: 'Nhận mặt nhanh', sub: '10 câu lạ chứa kính ngữ đã học', mins: 5, href: '#on-tap', done: true },
    { id: 'kanji', title: `Kanji mới: ${newKanji.join(' ')}`, sub: 'Khối Kính ngữ công sở, kèm 7 từ', mins: 15, href: '#kanji', done: false, jp: true },
    { id: 'vocab', title: '17 từ mới', sub: '申し上げる, 伺う, 拝見する, 承る…', mins: 15, href: '#on-tap', done: false },
    { id: 'grammar', title: 'Ngữ pháp: ～させていただく', sub: 'Tự đặt 2 câu', mins: 10, href: '#on-tap', done: false },
    { id: 'shadow', title: 'Shadowing bắt buộc: Gọi điện cho khách hàng', sub: 'Buổi 2 của tuần · Công sở · 8 câu · 0:35', mins: 20, href: '#shadowing', done: false, required: true },
  ];

  // Shadowing tuần này (18/10 → 24/10). Bắt buộc: T3, T5. Khuyến khích: T7.
  const week = [
    { d: 'T2', date: 18, kind: null, done: false },
    { d: 'T3', date: 19, kind: 'required', done: true, mins: 18, clip: 'Họp đầu ngày (朝礼)' },
    { d: 'T4', date: 20, kind: null, done: false },
    { d: 'T5', date: 21, kind: 'required', done: false, today: true },
    { d: 'T6', date: 22, kind: null, done: false },
    { d: 'T7', date: 23, kind: 'bonus', done: false },
    { d: 'CN', date: 24, kind: 'makeup', done: false },
  ];
  const requiredDone = week.filter((w) => w.kind === 'required' && w.done).length;
  const required = 2;

  const streak = { days: 46, freezes: 1, shadowWeeks: 22 };
  const xp = 1240;
  const retention = 0.884; // tỉ lệ nhớ 30 ngày (FSRS)

  // Độ phủ N3: đã học / mục tiêu ở ngày thi, và mức lộ trình yêu cầu tới hôm nay
  const coverage = [
    { label: 'Kanji', learned: 612, mature: 548, planToday: 628, goal: 650 },
    { label: 'Từ vựng', learned: 3486, mature: 3020, planToday: 3609, goal: 3750 },
    { label: 'Ngữ pháp', learned: 268, mature: 231, planToday: 273, goal: 280 },
  ];

  // Thi thử N3: 3 phần, mỗi phần 0–60, điểm liệt 19, điểm đỗ 95/180
  const exam = { pass: 95, sectionMin: 19, sectionMax: 60, ready: 110 };
  const mocks = [
    { date: '2027-08-22', label: '22/8', parts: [24, 20, 22] },
    { date: '2027-09-05', label: '5/9', parts: [27, 22, 25] },
    { date: '2027-09-19', label: '19/9', parts: [30, 24, 26] },
    { date: '2027-10-03', label: '3/10', parts: [33, 29, 25] },
    { date: '2027-10-17', label: '17/10', parts: [38, 31, 29] },
  ].map((m) => ({ ...m, total: m.parts.reduce((a, b) => a + b, 0) }));
  const parts = ['Kiến thức ngôn ngữ', 'Đọc hiểu', 'Nghe hiểu'];

  // Tỉ lệ đúng theo dạng bài, đề 17/10 (đúng / tổng câu)
  const byType = [
    { label: 'Cách đọc kanji', right: 7, of: 8 },
    { label: 'Chọn ngữ pháp', right: 10, of: 13 },
    { label: 'Ngữ cảnh từ vựng', right: 8, of: 11 },
    { label: 'Sắp xếp câu (並べ替え)', right: 2, of: 5 },
    { label: 'Đọc đoạn trung', right: 3, of: 6 },
    { label: 'Nghe phản hồi nhanh', right: 4, of: 9 },
  ];

  // Thẻ của phiên ôn (lấy 4 thẻ đầu để chạy thử)
  const deck = [
    { kind: 'Từ vựng', level: 'N3', front: '伺う', read: 'うかがう', pitch: [0, 1, 1, 1], hv: 'TỨ', mean: 'hỏi; đến thăm (khiêm nhường ngữ)',
      ex: [['明日', 'あした'], ['の'], ['午後', 'ごご'], ['、'], ['御社', 'おんしゃ'], ['に'], ['伺', 'うかが', true], ['います。']], exVi: 'Chiều mai tôi xin phép đến thăm quý công ty.', src: 'Từ clip: Gọi điện cho khách hàng',
      next: ['10 phút', '3 ngày', '9 ngày', '21 ngày'] },
    { kind: 'Kanji', level: 'N3', front: '承', read: 'ショウ · うけたまわ(る)', pitch: null, hv: 'THỪA', mean: 'tiếp nhận, nghe (khiêm nhường)',
      ex: [['承知', 'しょうち', true], ['いたしました。']], exVi: 'Tôi đã rõ ạ.', src: 'Khối Kính ngữ công sở', next: ['10 phút', '2 ngày', '6 ngày', '15 ngày'] },
    { kind: 'Ngữ pháp', level: 'N3', front: '～させていただく', read: 'V (thể sai khiến) + ていただく', pitch: null, hv: '', mean: 'xin phép được làm (rất lịch sự)',
      ex: [['本日', 'ほんじつ'], ['は'], ['休', 'やす'], ['ませていただきます', '', true], ['。']], exVi: 'Hôm nay tôi xin phép được nghỉ.', src: 'Ngữ pháp tuần 51', next: ['10 phút', '1 ngày', '4 ngày', '11 ngày'] },
    { kind: 'Từ vựng', level: 'N3', front: '拝見', read: 'はいけん', pitch: [0, 1, 1, 1], hv: 'BÁI KIẾN', mean: 'xem (khiêm nhường ngữ)',
      ex: [['資料', 'しりょう'], ['を'], ['拝見', 'はいけん', true], ['しました。']], exVi: 'Tôi đã xem tài liệu rồi ạ.', src: 'Bộ N3 · Công sở', next: ['10 phút', '2 ngày', '7 ngày', '18 ngày'] },
  ];

  // Clip shadowing: Gọi điện cho khách hàng. start/end tính bằng giây; score null = chưa ghi âm.
  const clip = { title: 'Gọi điện cho khách hàng', cat: 'Công sở', level: 'N3', speed: 'Tự nhiên', voice: 'Nữ', target: 75, minMinutes: 15, practisedMinutes: 11 };
  const lines = [
    { jp: 'お電話ありがとうございます。山田商事の田中でございます。', vi: 'Cảm ơn quý khách đã gọi. Tôi là Tanaka, công ty Yamada.', start: 0.0, end: 3.8, score: 81, recLen: 3.6 },
    { jp: 'いつもお世話になっております。', vi: 'Cảm ơn anh chị đã luôn giúp đỡ.', start: 4.6, end: 7.0, score: 77, recLen: 2.5 },
    { jp: '恐れ入りますが、お名前を伺ってもよろしいでしょうか。', vi: 'Xin lỗi, cho phép tôi hỏi tên quý khách được không ạ?', start: 7.9, end: 12.0, score: 64, recLen: 4.4, note: 'Lên giọng sớm ở 伺って; bản gốc giữ bằng tới でしょうか' },
    { jp: '佐藤様でいらっしゃいますね。', vi: 'Quý khách là ông Sato phải không ạ.', start: 13.4, end: 15.6, score: 79, recLen: 2.1 },
    { jp: '申し訳ございません、鈴木はただいま席を外しております。', vi: 'Rất xin lỗi, anh Suzuki hiện không có ở chỗ ngồi.', start: 16.5, end: 21.1, score: 70, recLen: 4.9 },
    { jp: 'よろしければ、折り返しお電話させていただきます。', vi: 'Nếu được, tôi xin phép gọi lại cho quý khách.', start: 22.0, end: 25.9, score: null, recLen: null },
    { jp: '念のため、お電話番号を伺えますか。', vi: 'Để chắc chắn, cho tôi xin số điện thoại được không ạ?', start: 27.3, end: 30.6, score: null, recLen: null },
    { jp: '承知いたしました。失礼いたします。', vi: 'Tôi đã rõ. Xin phép cúp máy.', start: 31.4, end: 34.1, score: null, recLen: null },
  ];
  clip.length = Math.ceil(lines[lines.length - 1].end + 0.9);
  const recorded = lines.filter((l) => l.score != null);
  const atTarget = recorded.filter((l) => l.score >= clip.target).length;

  // Đường cao độ câu 3 (Hz, 20 điểm đều nhau): bản gốc và giọng người học
  const pitchOrig = [212, 218, 224, 226, 222, 230, 236, 238, 236, 234, 236, 238, 236, 232, 230, 228, 224, 216, 206, 198];
  const pitchMine = [205, 214, 222, 238, 252, 248, 240, 236, 230, 226, 224, 226, 228, 224, 220, 214, 206, 198, 190, 186];

  // Kanji 伺: thứ tự nét từ KanjiVG (CC BY-SA 3.0, Ulrich Apel), viewBox 0 0 109 109
  const kanji = {
    char: '伺', hv: 'TỨ', mean: 'hỏi thăm, đến thăm (khiêm nhường)', on: 'シ', kun: ['うかが', 'う'], strokes: 7, level: 'N3', freq: 1661,
    parts: [{ c: '亻', name: 'nhân đứng, người' }, { c: '司', name: 'TI, cai quản' }],
    mnemo: 'Người 亻 đến chỗ quan cai quản 司 thì phải khép nép hỏi thăm.',
    paths: [
      'M32.25,13.14c0.13,1.23,0.22,2.78-0.11,4.29C30,27,23,45.12,13.06,59.72',
      'M26.53,40.75c0.98,0.98,1.26,2.25,1.26,3.98c0,10.23-0.01,30.65-0.01,44.52c0,3.57-0.03,6.5-0.03,8.37',
      'M40,22.74c2.55,0.46,5.19,0.6,7.76,0.19C63,20.5,74.88,18.38,85.31,16.99c4.18-0.55,6.01,1.88,6.01,6.07c0,2.36-0.03,59.12-0.03,64.54c0,14.15-5.91,5.9-8.72,2.82',
      'M40,39.64c2.5,0.49,5.07,0.21,7.15-0.11c6.36-0.97,16.64-3.03,22.98-3.84c2.06-0.26,4.36-0.42,6.37,0.07',
      'M44.75,54.91c0.86,0.86,1,1.97,1.21,3.45c0.45,3.23,1.29,8.45,1.83,13.17c0.18,1.58,0.35,3.1,0.52,4.46',
      'M46.74,56.35c7.76-1.72,15.41-2.81,22.28-3.6c2.56-0.29,5.11,1.12,4.14,4.26c-1.66,5.37-2.56,7.4-4.31,13.26',
      'M49.13,73.44c5.73-0.56,10.72-1.31,17.64-1.95c1.68-0.15,3.44-0.3,5.31-0.43',
    ],
    words: [
      { w: '伺う', r: 'うかがう', hv: 'TỨ', vi: 'hỏi; đến thăm (khiêm nhường)', lvl: 'N3', inSrs: true },
      { w: 'お伺いする', r: 'おうかがいする', hv: 'TỨ', vi: 'xin phép hỏi / đến (rất lịch sự)', lvl: 'N3', inSrs: false },
      { w: '伺い', r: 'うかがい', hv: 'TỨ', vi: 'sự hỏi ý kiến, xin chỉ thị', lvl: 'N2', inSrs: false },
      { w: '伺い書', r: 'うかがいしょ', hv: 'TỨ THƯ', vi: 'văn bản xin chỉ thị cấp trên', lvl: 'N1', inSrs: false },
    ],
    example: [['後', 'のち'], ['ほど'], ['お'], ['伺', 'うかが', true], ['いします。']], exampleVi: 'Lát nữa tôi xin phép đến ạ.',
  };

  // Các phép kiểm: số liệu xuất hiện ở hai nơi phải là một biến
  console.assert(today[0].title.includes(String(dueTotal)), 'việc ôn khớp tổng thẻ');
  console.assert(forecast[0].cards === dueTotal, 'dự báo hôm nay = tổng thẻ đến hạn');
  console.assert(mocks.every((m) => m.total === m.parts[0] + m.parts[1] + m.parts[2]), 'tổng đề thi thử');
  console.assert(kanji.paths.length === kanji.strokes, 'số nét = số path KanjiVG');
  console.assert(coverage.every((c) => c.mature <= c.learned && c.learned <= c.goal), 'độ phủ hợp lệ');
  console.assert(byType.every((t) => t.right <= t.of), 'đúng ≤ tổng câu');

  return { learner, retention, due, dueTotal, forecast, newKanji, today, week, requiredDone, required, streak, coverage, exam, mocks, parts, byType, deck, clip, lines, recorded, atTarget, pitchOrig, pitchMine, kanji, xp };
})();
