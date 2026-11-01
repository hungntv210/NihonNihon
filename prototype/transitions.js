// Bộ chuyển cảnh: shoji, sakura, noren, sensu + bộ chạy có khoá bận.
(function (root) {
  'use strict';

  var MOMENTS = { area: 'shoji', lesson: 'noren', 'day-done': 'sakura', 'level-up': 'sakura', 'mock-result': 'sensu' };
  function forMoment(moment) { return MOMENTS[moment] || 'shoji'; }
  function shouldAnimate(o) { return !o.reducedMotion; }

  // Sprites tra cứu muộn để module nạp được trong Node khi không có Sprites.
  var sprite = function (el, name) { root.Sprites.draw(el, name); };
  var anim = function (el, kf, o) { return el.animate(kf, Object.assign({ fill: 'forwards' }, o)).finished; };
  var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

  // độ trễ lớn nhất của ô hoa không vượt khung 390×720 (maxD = 556) để hiệu ứng ≤ 1.150 ms ở màn lớn
  function sakuraDelayScale(size) {
    var cols = Math.ceil(size.w / 48), rows = Math.ceil(size.h / 48);
    return Math.min(1, 556 / (((cols - 1) + (rows - 1)) * 22 + 6 * 12));
  }

  var EFFECTS = {
    // cửa shoji: hai cánh trượt vào giữa (360ms), quả bóng hiện (140ms), cánh trượt ra (440ms)
    shoji: {
      build: function (fx) {
        var lattice = '<svg class="lattice" preserveAspectRatio="none" viewBox="0 0 60 120"><g stroke="#24332D" stroke-width="1.6" fill="none">'
          + [20, 40].map(function (x) { return '<line x1="' + x + '" y1="0" x2="' + x + '" y2="120"/>'; }).join('')
          + [24, 48, 72, 96].map(function (y) { return '<line x1="0" y1="' + y + '" x2="60" y2="' + y + '"/>'; }).join('')
          + '</g></svg>';
        fx.innerHTML = '<div class="door l">' + lattice + '<span class="pull"></span></div><div class="door r">' + lattice + '<span class="pull"></span></div><svg class="seal" data-s="ball"></svg>';
        sprite(fx.querySelector('.seal'), 'ball');
      },
      cover: async function (fx, opts) {
        var d = fx.querySelectorAll('.door'), l = d[0], r = d[1];
        await Promise.all([anim(l, [{ transform: 'translateX(-101%)' }, { transform: 'translateX(0)' }], { duration: 360, easing: opts.easing('--ease-in-out') }),
                           anim(r, [{ transform: 'translateX(101%)' }, { transform: 'translateX(0)' }], { duration: 360, easing: opts.easing('--ease-in-out') })]);
        await anim(fx.querySelector('.seal'), [{ opacity: 0, transform: 'scale(.6)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 140, easing: opts.easing('--ease-expo') });
      },
      reveal: async function (fx, opts) {
        var d = fx.querySelectorAll('.door'), l = d[0], r = d[1];
        anim(fx.querySelector('.seal'), [{ opacity: 1 }, { opacity: 0 }], { duration: 120, easing: 'linear' });
        await Promise.all([anim(l, [{ transform: 'translateX(0)' }, { transform: 'translateX(-101%)' }], { duration: 440, easing: opts.easing('--ease-expo') }),
                           anim(r, [{ transform: 'translateX(0)' }, { transform: 'translateX(101%)' }], { duration: 440, easing: opts.easing('--ease-expo') })]);
      },
    },
    // hoa anh đào: cành hoa vươn vào từ góc trên trái, cánh hoa bay chéo, ô hoa nở theo đường chéo đến khi phủ kín; khi mở các ô rơi rụng
    sakura: {
      build: function (fx, size) {
        var cell = 48, cols = Math.ceil(size.w / cell), rows = Math.ceil(size.h / cell);
        fx.innerHTML = '<div class="petals" style="grid-template-columns:repeat(' + cols + ',1fr);grid-template-rows:repeat(' + rows + ',1fr)">' + '<i><svg></svg></i>'.repeat(cols * rows) + '</div>'
          + '<div class="drift">' + '<i><svg></svg></i>'.repeat(16) + '</div><svg class="branch"></svg>';
        var seed = 20261101, scale = sakuraDelayScale(size);
        var rnd = function () { seed = (seed + 0x6D2B79F5) | 0; var t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) % 101; };
        fx.querySelectorAll('.petals i').forEach(function (el, i) {
          var r = rnd() % 20, kind = r < 7 ? 'flower' : r < 15 ? null : r < 17 ? 'petal' : r < 19 ? 'bud' : 'leaf';
          if (kind) sprite(el.querySelector('svg'), kind);
          el.dataset.d = (((i % cols) + Math.floor(i / cols)) * 22 + (rnd() % 7) * 12) * scale;
          el.dataset.side = rnd() % 2 ? 1 : -1;
        });
        fx.querySelectorAll('.drift i').forEach(function (el, i) {
          sprite(el.querySelector('svg'), 'dpetal');
          el.style.left = (-10 + (rnd() % 60)) + '%'; el.style.top = (-10 + (rnd() % 40)) + '%';
          el.dataset.dx = 180 + rnd() * 2.2; el.dataset.dy = 260 + rnd() * 3.4; el.dataset.d = i * 22 + (rnd() % 5) * 15;
        });
        sprite(fx.querySelector('.branch'), 'branch');
      },
      cover: async function (fx, opts) {
        var br = fx.querySelector('.branch');
        fx.querySelectorAll('.drift i').forEach(function (el) {
          anim(el, [
            { opacity: 0, transform: 'translate(0,0) rotate(0deg)' }, { opacity: 1, offset: 0.15 },
            { opacity: 1, transform: 'translate(' + el.dataset.dx + 'px, ' + el.dataset.dy + 'px) rotate(300deg)' }], { duration: 900, delay: +el.dataset.d, easing: 'linear' });
        });
        var branchIn = anim(br, [{ transform: 'translate(-70%, -70%) rotate(-6deg)' }, { transform: 'translate(0, 0) rotate(0deg)' }], { duration: 340, easing: opts.easing('--ease-expo') });
        var tiles = Array.from(fx.querySelectorAll('.petals i')).map(function (el) {
          return anim(el, [{ transform: 'scale(0) rotate(90deg)' }, { transform: 'scale(1.06) rotate(0deg)' }], { duration: 260, delay: 70 + +el.dataset.d * 0.47, easing: opts.easing('--ease-expo') });
        });
        await Promise.all([branchIn].concat(tiles));
      },
      reveal: async function (fx, opts) {
        fx.querySelectorAll('.drift i').forEach(function (el) { el.getAnimations().forEach(function (a) { a.cancel(); }); });
        anim(fx.querySelector('.branch'), [{ transform: 'translate(0, 0)' }, { transform: 'translate(-70%, -70%) rotate(-6deg)' }], { duration: 260, easing: opts.easing('--ease-exit') });
        await Promise.all(Array.from(fx.querySelectorAll('.petals i')).map(function (el) {
          return anim(el, [
            { transform: 'translate(0, 0) scale(1.06) rotate(0deg)', opacity: 1 },
            { transform: 'translate(' + (el.dataset.side * 10) + 'px, 46px) scale(.45) rotate(' + (el.dataset.side * 40) + 'deg)', opacity: 0 }], { duration: 300, delay: +el.dataset.d * 0.33, easing: opts.easing('--ease-exit') });
        }));
      },
    },
    // rèm noren: thanh treo rơi xuống, bốn tấm rèm buông và đung đưa; khi mở, rèm rẽ hai bên rồi vén lên
    noren: {
      build: function (fx) {
        var panel = function (cls, inner) { return '<div class="pn ' + cls + '"><span class="band"></span>' + inner + '<span class="hem"></span></div>'; };
        fx.innerHTML = '<div class="noren2"><div class="rod"></div><div class="panels">'
          + panel('p1', '<span class="v">日本語</span>') + panel('p2', '<svg class="mon"></svg>') + panel('p3', '<svg class="mon"></svg>') + panel('p4', '<span class="v">道場</span>')
          + '</div></div>';
        fx.querySelectorAll('.mon').forEach(function (m) { sprite(m, 'mon'); });
      },
      cover: async function (fx, opts) {
        anim(fx.querySelector('.rod'), [{ transform: 'translateY(-60px)' }, { transform: 'translateY(0)' }], { duration: 160, easing: opts.easing('--ease-expo') });
        await Promise.all(Array.from(fx.querySelectorAll('.pn')).map(function (el, i) {
          return anim(el, [
            { transform: 'scaleY(0) rotate(0deg)' }, { transform: 'scaleY(1.02) rotate(0deg)', offset: 0.65 },
            { transform: 'scaleY(1) rotate(1.2deg)', offset: 0.85 }, { transform: 'scaleY(1) rotate(0deg)' }], { duration: 420, delay: 60 + i * 40, easing: opts.easing('--ease-in-out') });
        }));
      },
      reveal: async function (fx, opts) {
        var swing = [14, 26, -26, -14];
        var parts = Array.from(fx.querySelectorAll('.pn')).map(function (el, i) {
          return anim(el, [{ transform: 'scaleY(1) rotate(0deg)' }, { transform: 'scaleY(1) rotate(' + swing[i] + 'deg)' }], { duration: 240, easing: opts.easing('--ease-out') });
        });
        await wait(120);
        await Promise.all(parts.concat([anim(fx.querySelector('.noren2'), [{ transform: 'translateY(0)' }, { transform: 'translateY(-108%)' }], { duration: 300, easing: opts.easing('--ease-expo') })]));
      },
    },
    // quạt sensu: 11 nan quạt xoè ra từ trục ở đáy màn hình, rồi gập sang phải
    sensu: {
      build: function (fx) {
        var n = 11, step = 17, ribs = '';
        for (var i = 0; i < n; i++) ribs += '<div class="rib" data-a="' + (-85 + i * step) + '"><b></b><svg class="' + (i % 2 ? 'near' : 'far') + '"></svg></div>';
        fx.innerHTML = '<div class="sensu">' + ribs + '<span class="rivet"></span></div>';
        fx.querySelectorAll('.rib svg').forEach(function (el) { sprite(el, 'flower'); });
      },
      cover: async function (fx, opts) {
        await Promise.all(Array.from(fx.querySelectorAll('.rib')).map(function (el, i) {
          return anim(el, [{ transform: 'rotate(-100deg)' }, { transform: 'rotate(' + el.dataset.a + 'deg)' }], { duration: 360, delay: i * 16, easing: opts.easing('--ease-in-out') });
        }));
      },
      reveal: async function (fx, opts) {
        var ribs = Array.from(fx.querySelectorAll('.rib'));
        await Promise.all(ribs.map(function (el, i) {
          return anim(el, [{ transform: 'rotate(' + el.dataset.a + 'deg)' }, { transform: 'rotate(100deg)' }], { duration: 330, delay: (ribs.length - 1 - i) * 13, easing: opts.easing('--ease-expo') });
        }));
      },
    },
  };

  function create(cfg) {
    var layer = cfg.layer, content = cfg.content, busy = false;
    var opts = {
      easing: function (name) {
        return cfg.stepped() ? 'steps(6, jump-end)' : getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      },
    };
    // mờ chuyển: mỗi nửa 75ms
    function fade(from, to) {
      var a = content.animate([{ opacity: from }, { opacity: to }], { duration: 75, fill: 'forwards' });
      return a.finished.then(function () { if (a.cancel) a.cancel(); });
    }
    async function run(name, swap) {
      if (busy) return { mode: 'skipped', ms: 0 };
      busy = true;
      var t0 = performance.now(), mode = 'full', swapped = false;
      var doSwap = function () { if (!swapped) { swapped = true; swap(); } };
      try {
        if (cfg.reducedMotion()) {
          mode = 'reduced';
          await fade(1, 0); doSwap(); await fade(0, 1);
        } else {
          var e = EFFECTS[name] || EFFECTS.shoji, r = layer.getBoundingClientRect();
          try {
            e.build(layer, { w: r.width, h: r.height });
            await e.cover(layer, opts);
            doSwap();
            await wait(40);
            await e.reveal(layer, opts);
          } catch (err) {
            mode = 'error'; doSwap();
          }
        }
      } finally {
        layer.innerHTML = '';
        busy = false;
      }
      return { mode: mode, ms: performance.now() - t0 };
    }
    return { run: run, get busy() { return busy; } };
  }

  var api = { MOMENTS: MOMENTS, forMoment: forMoment, sakuraDelayScale: sakuraDelayScale, shouldAnimate: shouldAnimate, EFFECTS: EFFECTS, create: create };
  root.Transitions = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(globalThis);
