(function (root) {
  var PAL = { K: '#24332D', W: '#FFFFFF', O: '#E8956A', P: '#F4ABA3', p: '#FBDDD8', R: '#C8564B', Y: '#D6B45C', F: '#2F684E', G: '#C3CDD1', B: '#2F5D86', N: '#5A3E2B', n: '#7A5638', L: '#78A878', l: '#477D59', V: '#F7F6F1', Q: '#D9708A', q: '#FFFFFF' };
  var GRIDS = {
    ball: [
      '......KKKK......',
      '....KKWWWWKK....',
      '...KWWWKKWWWK...',
      '..KWWWKKKKWWWK..',
      '.KWKKWWKKWWKKWK.',
      '.KKKWWWWWWWWKKK.',
      'KWKWWWWWWWWWWKWK',
      'KWWWKKWWWWKKWWWK',
      'KWWWKKWWWWKKWWWK',
      'KWWPPWWWWWWPPWWK',
      'KWWWWKWWWWKWWWWK',
      '.KWWWWKKKKWWWWK.',
      '.KKWWWWWWWWWWKK.',
      '..KWWWKKKKWWWK..',
      '...KKWKKKKWKK...',
      '.....KKKKKK.....'
    ],
    cat: [
      '.KK.......KK....',
      'KKKK.....KPWK...',
      'KKKKKKKKKWWWK...',
      'KKKKKWWWWWWWK.KK',
      'KKKWWWWWWWWWKKWK',
      'KWWKKWWWKKWWKKWK',
      'KWWKWWWWKWWWKKWK',
      'KPPWWWRRWWPPKKWK',
      'KWWWWWKKWWWWKKKK',
      '.KWWWWWWWWWWK...',
      '.KFFFFFYFFFFK...',
      '.KWWWWWWWKKKK...',
      '.KWWWWWWKKKKK...',
      '.KWWWWWWWKKKK...',
      '.KWWKWWWWKWWK...',
      '..KKKKKKKKKK....'
    ],
    shiba: [
      '.KK..........KK.',
      'KOOK........KOOK',
      'KOPOKKKKKKKKOPOK',
      'KOOOOOOOOOOOOOOK',
      'KOOOOOOOOOOOOOOK',
      'KOOOWOOOOOOWOOOK',
      'KOOOKKOOOOKKOOOK',
      'KOOOKWOOOOKWOOOK',
      'KOPPWWWWWWWWPPOK',
      'KWWWWWWKKWWWWWWK',
      'KWWWWWKWWKWWWWWK',
      '.KWWWWWRRWWWWWK.',
      '.KBBBBBBBBBBBBK.',
      '.KBBBBBWWBBBBBK.',
      '.KBBBBBBBBBBBBK.',
      '..KKK......KKK..'
    ],
    penguin: [
      '.....KKKKKK.....',
      '...KKKKKKKKKK...',
      '..KKKKKKKKKKKK..',
      '.KKKWWWWWWWWKKK.',
      '.KKWWWWWWWWWWKK.',
      'KKWWKKWWWWKKWWKK',
      'KKWWKKWWWWKKWWKK',
      'KKWPPWWOOWWPPWKK',
      'KKWWWWWWWWWWWWKK',
      'KKKWWWWYYWWWWKKK',
      'KKKWWWWWWWWWWKKK',
      '.KKWWWWWWWWWWKYY',
      '..KKWWWWWWWWKKYY',
      '...KKWWWWWWKK...',
      '.....KKKKKK.....',
      '....OOO..OOO....'
    ],
    seal: [
      '......KKKK......',
      '.....KWKKWK.....',
      '.....KKWWKK.....',
      '.....KWKKWK.....',
      '......KKKK......',
      '.....KGGGGK.....',
      '...KKGGGGGGKK...',
      '..KGGGGGGGGGGK..',
      '.KGGKKGGGGKKGGK.',
      '.KGGKKGGGGKKGGK.',
      '.KPPGGGKKGGGPPK.',
      '.KGGGGKGGKGGGGK.',
      'KOKGGWWWWWWGGKOK',
      'KOOKWWWWWWWWKOOK',
      '.KKKWWWWWWWWKKK.',
      '...KWWWWWWWWK...',
      '....KGGGGGGKKKK.',
      '.....KKKKKK.KKK.'
    ],
    flower: [
      '...P...',
      '.PPPPP.',
      '.PPYPP.',
      'PPYYYPP',
      '.PPYPP.',
      '.PPPPP.',
      '...P...'
    ],
    bud: [
      '.......',
      '...p...',
      '..pPp..',
      '..pPp..',
      '...L...',
      '..L.L..',
      '.......'
    ],
    leaf: [
      '.....lL',
      '....lLL',
      '...lLLl',
      '..lLLl.',
      '.lLLl..',
      '.LLl...',
      'Ll.....'
    ],
    petal: [
      '.......',
      '..pp...',
      '.pPPp..',
      '.pPPPp.',
      '..pPPp.',
      '...pp..',
      '.......'
    ],
    dpetal: [
      '.pp.',
      'pPPp',
      'pPPp',
      '.pp.'
    ],
    mon: [
      '.....VVVVV.....',
      '...VVVVVVVVV...',
      '..VVV.....VVV..',
      '.VV.........VV.',
      '.VV...OOO...VV.',
      'VV...OOOOO...VV',
      'VV..OOOOOOO..VV',
      'VV..OOOOOOO..VV',
      'VV..OOOOOOO..VV',
      'VV...OOOOO...VV',
      '.VV...OOO...VV.',
      '.VV.........VV.',
      '..VVV.....VVV..',
      '...VVVVVVVVV...',
      '.....VVVVV.....'
    ],
    branch: [
      'NNN',
      'NNNNN',
      '.NNNNNN.........qQq',
      '..NNnNNNN......qQYQq',
      '...NN.NNNN......qQq...qQq',
      '..LlL...NNnN.........qQYQq',
      '...L......NNNN...LL...qQq',
      '......qQq...NNNN.LlL',
      '.....qQYQq....NNnNL......qQq',
      '......qQq.......NNNN....qQYQq',
      '..................NNNN...qQq',
      '.........LL.........NnNN',
      '........LlL...qQq.....NNNNN',
      '.........L...qQYQq......NNNN..qQq',
      '..............qQq.........NNNqQYQq',
      '.............................NNqQq',
      '..............................N'
    ]
  };
  var MASCOT = { 'trang-chu': 'ball', 'on-tap': 'cat', shadowing: 'shiba', kanji: 'penguin', jlpt: 'seal' };

  function rects(name) {
    var g = GRIDS[name];
    if (!g) throw new Error('Unknown sprite: ' + name);
    var out = [];
    g.forEach(function (row, y) {
      for (var x = 0; x < row.length; x++) if (PAL[row[x]]) out.push({ x: x, y: y, fill: PAL[row[x]] });
    });
    return { w: Math.max.apply(null, g.map(function (r) { return r.length; })), h: g.length, rects: out };
  }

  function draw(svg, name, scale) {
    var r = rects(name);
    svg.setAttribute('viewBox', '0 0 ' + r.w + ' ' + r.h);
    svg.setAttribute('shape-rendering', 'crispEdges');
    svg.setAttribute('aria-hidden', 'true');
    if (scale > 0) { svg.setAttribute('width', r.w * scale); svg.setAttribute('height', r.h * scale); }
    svg.innerHTML = r.rects.map(function (q) { return '<rect x="' + q.x + '" y="' + q.y + '" width="1" height="1" fill="' + q.fill + '"/>'; }).join('');
  }

  var api = { PAL: PAL, GRIDS: GRIDS, MASCOT: MASCOT, rects: rects, draw: draw };
  root.Sprites = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(globalThis);
