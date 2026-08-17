'use strict';
const { boot } = require('./harness');

/** Highest point the hero reaches from a jump, driven through the real loop at
    a given refresh rate.

    Every input is timed by simulation step rather than by display frame. A
    player on a 30 Hz screen genuinely cannot aim a double jump finer than
    33 ms, and that resolution is the display's business — what must not differ
    between monitors is where the same press lands the hero. */
function apex(hz, double) {
  const g = boot();
  const { Game, Input } = g.ICH;
  Game.start();
  g.clearWorld();
  const p = Game.player;
  g.frames(hz, 0.5); // settle on the pavement
  const y0 = p.y;
  let top = p.y;
  let step = 0;

  const real = Game.update.bind(Game);
  Game.update = function (dt) {
    if (step === 0) Input.press('jump');
    if (double && step === 18) Input.press('jump');
    Input.now.jump = step < 24; // held for full height
    Input.now.right = true;
    step++;
    real(dt);
    top = Math.min(top, p.y);
  };

  g.frames(hz, 1.4);
  return y0 - top;
}

describe('цикл: симуляция не зависит от частоты кадров', () => {
  /* Регрессия. Цикл отдавал в update кадровую дельту, а гравитация
     интегрируется — прыжок выходил 106.7 px на 30 Hz и 115.9 px на 144 Hz.
     Разная игра на разных мониторах и нечестная таблица рекордов. */
  it('высота прыжка одинакова на 30, 60, 120 и 144 Hz', () => {
    const heights = [30, 60, 120, 144].map((hz) => apex(hz, false));
    const spread = Math.max(...heights) - Math.min(...heights);
    assert.ok(spread < 1, `высота прыжка разъезжается на ${spread.toFixed(2)} px: ${heights.map((h) => h.toFixed(1))}`);
    assert.between(heights[1], 100, 130, 'прыжок на 60 Hz перестал быть прежним');
  });

  it('двойной прыжок тоже одинаков', () => {
    const heights = [30, 60, 144].map((hz) => apex(hz, true));
    const spread = Math.max(...heights) - Math.min(...heights);
    assert.ok(spread < 1, `двойной прыжок разъезжается на ${spread.toFixed(2)} px`);
    assert.ok(heights[0] > apex(60, false), 'двойной прыжок должен быть выше одиночного');
  });

  it('за секунду проходит одинаковый путь на любой частоте', () => {
    const runs = [30, 60, 144].map((hz) => {
      const g = boot();
      g.ICH.Game.start();
      g.clearWorld();
      g.frames(hz, 3, () => { g.ICH.Input.now.right = true; });
      return g.ICH.Game.dist;
    });
    const spread = Math.max(...runs) - Math.min(...runs);
    assert.ok(spread < 0.5, `путь разъезжается на ${spread.toFixed(2)} м: ${runs.map((r) => r.toFixed(2))}`);
  });

  it('очки за время идут по своим часам, а не по кадрам', () => {
    const scores = [30, 60, 144].map((hz) => {
      const g = boot();
      g.ICH.Game.start();
      g.clearWorld();
      g.frames(hz, 2);
      return g.ICH.Game.score;
    });
    const spread = Math.max(...scores) - Math.min(...scores);
    assert.ok(spread < 1, `очки разъезжаются на ${spread.toFixed(2)}`);
  });
});

describe('цикл: телефон не рисует лишнего', () => {
  /* Отрисовка — дорогая половина кадра на телефоне, а кадр, в котором ничего
     не посчиталось, выглядит ровно как предыдущий. */
  it('на 120 Hz мир считается 60 раз в секунду и столько же рисуется', () => {
    const g = boot();
    g.ICH.Game.start();
    g.record.draws = 0;
    g.frames(120, 1);
    assert.between(g.draws(), 55, 65, 'на 120 Hz должно быть около 60 отрисовок в секунду');
  });

  it('на 60 Hz рисуется каждый кадр', () => {
    const g = boot();
    g.ICH.Game.start();
    g.record.draws = 0;
    g.frames(60, 1);
    assert.between(g.draws(), 57, 61, 'на 60 Hz кадр не должен пропадать');
  });

  it('на паузе мир не перерисовывается', () => {
    const g = boot();
    const { Game } = g.ICH;
    Game.start();
    Game.pause();
    g.record.draws = 0;
    g.frames(60, 1);
    assert.equal(g.draws(), 1, 'пауза должна стоить одну отрисовку, а не шестьдесят');
  });

  it('смена размера кадра перерисовывает даже без шага симуляции', () => {
    const g = boot();
    const { Game } = g.ICH;
    Game.start();
    Game.pause();
    g.frames(60, 0.5);
    g.record.draws = 0;
    g.resize(1000, 600);
    g.frames(60, 0.1);
    assert.ok(g.draws() >= 1, 'после resize кадр обязан перерисоваться');
  });
});

describe('цикл: провалы времени', () => {
  it('вкладка, проспавшая полминуты, не телепортирует героя', () => {
    const g = boot();
    const { Game } = g.ICH;
    Game.start();
    g.clearWorld();
    g.frames(60, 1, () => { g.ICH.Input.now.right = true; });
    const before = Game.dist;
    // один кадр длиной в тридцать секунд
    g._ts += 30000;
    Game.loop(g._ts);
    const jump = Game.dist - before;
    assert.ok(jump < 3, `один провал времени продвинул героя на ${jump.toFixed(1)} м`);
    assert.finite(Game.player.x, 'координата героя уцелела');
  });

  it('нулевая и отрицательная дельта не ломают накопитель', () => {
    const g = boot();
    const { Game } = g.ICH;
    Game.start();
    Game.loop(g._ts); // та же метка времени: дельта ноль
    Game.loop(g._ts - 500); // часы прыгнули назад
    assert.finite(Game.acc, 'накопитель ушёл в NaN');
    assert.ok(Game.acc >= 0, 'накопитель ушёл в минус');
  });
});
