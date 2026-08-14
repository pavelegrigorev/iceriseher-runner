'use strict';
const { boot } = require('./harness');

/** How much screen the letterbox wastes at a given window size. */
function fit(g, w, h) {
  const { C } = g.ICH;
  g.resize(w, h);
  const scale = Math.min(w / C.W, h / C.H);
  return {
    logical: [C.W, C.H],
    css: [Math.floor(C.W * scale), Math.floor(C.H * scale)],
    hud: C.HUD,
  };
}

describe('кадр: адаптация под экран', () => {
  it('16:9 остаётся эталонными 960×540', () => {
    const g = boot();
    const r = fit(g, 1600, 900);
    assert.deepEqual(r.logical, [960, 540]);
    assert.equal(r.hud, 1, 'на большом экране HUD не увеличивается');
  });

  it('широкий телефон в альбоме не теряет ни пикселя на полосы', () => {
    const g = boot({ touch: true });
    const r = fit(g, 844, 390);
    assert.between(844 - r.css[0], 0, 1, 'полосы по горизонтали');
    assert.between(390 - r.css[1], 0, 1, 'полосы по вертикали');
    assert.ok(r.logical[0] > 960, 'на широком экране видно больше улицы');
    assert.equal(r.logical[1], 540, 'высота кадра остаётся эталонной');
  });

  it('высокий экран добавляет вертикали, а не сжимает ширину', () => {
    const g = boot();
    const r = fit(g, 1024, 768);
    assert.equal(r.logical[0], 960);
    assert.ok(r.logical[1] > 540, 'на 4:3 открывается больше неба');
  });

  it('экстремальные пропорции упираются в ограничители', () => {
    const g = boot();
    assert.between(fit(g, 3000, 400).logical[0], 960, 1400);
    assert.between(fit(g, 400, 3000).logical[1], 540, 820);
  });

  it('маленький экран получает увеличенный HUD', () => {
    const g = boot({ touch: true });
    assert.ok(fit(g, 740, 360).hud > 1.2, 'на телефоне HUD крупнее');
    assert.equal(fit(g, 1920, 1080).hud, 1, 'на десктопе — как есть');
  });

  it('нулевой размер окна не ломает кадр', () => {
    const g = boot();
    const before = [g.ICH.C.W, g.ICH.C.H];
    g.resize(0, 0);
    assert.deepEqual([g.ICH.C.W, g.ICH.C.H], before, 'скрытое окно не схлопывает кадр');
  });
});

describe('кадр: портрет', () => {
  it('на телефоне в портрете просит повернуть и ставит на паузу', () => {
    const g = boot({ touch: true });
    const { Game } = g.ICH;
    Game.start();
    g.resize(390, 844);
    assert.ok(Game.portrait, 'портрет распознан');
    assert.equal(Game.state, 'paused', 'забег приостановлен');
    assert.ok(!g.elements.get('screen-rotate').classList.contains('hidden'), 'экран поворота показан');
  });

  it('поворот в альбом убирает подсказку и позволяет продолжить', () => {
    const g = boot({ touch: true });
    const { Game } = g.ICH;
    Game.start();
    g.resize(390, 844);
    g.resize(844, 390);
    assert.ok(!Game.portrait);
    assert.ok(g.elements.get('screen-rotate').classList.contains('hidden'));
    Game.resume();
    assert.equal(Game.state, 'playing');
  });

  it('на десктопе портретное окно подсказку не показывает', () => {
    const g = boot({ touch: false });
    g.resize(600, 900);
    assert.ok(!g.ICH.Game.portrait, 'мышь и клавиатура — поворачивать нечего');
  });
});
