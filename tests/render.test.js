'use strict';
const { boot, markup, scriptOrder } = require('./harness');

/* The 2d context in the harness records any non-finite argument. A NaN
   coordinate draws nothing at all in a real browser and leaves no error, so
   this is the only cheap way to catch it. */
function drawClean(g, frames, before) {
  g.record.bad.length = 0;
  g.step(frames, before);
  g.draw();
  return g.record.bad;
}

describe('отрисовка: ничего не уходит в NaN', () => {
  /* Регрессия. Массовая замена C.H → H при переносе HUD на локальные размеры
     съела C.HUD: масштаб стал объектом, ширина кадра — NaN, и весь правый
     край интерфейса рисовался по несуществующим координатам, то есть исчезал
     без единой ошибки в консоли. */
  it('HUD на телефоне считает конечные координаты', () => {
    const g = boot({ touch: true, width: 740, height: 360 });
    g.resize(740, 360);
    g.ICH.Game.start();
    assert.ok(g.ICH.C.HUD > 1, 'масштаб HUD должен быть числом больше единицы');
    assert.finite(g.ICH.C.W / g.ICH.C.HUD, 'ширина раскладки HUD');
    const bad = drawClean(g, 30, () => { g.ICH.Input.now.right = true; });
    assert.deepEqual(bad.slice(0, 3), [], 'в отрисовке появились нечисловые координаты');
  });

  it('кадр рисуется во всех формах экрана', () => {
    const g = boot();
    g.ICH.Game.start();
    for (const [w, h] of [[1600, 900], [844, 390], [1024, 768], [740, 360], [1280, 800]]) {
      g.resize(w, h);
      const bad = drawClean(g, 20, () => { g.ICH.Input.now.right = true; });
      assert.deepEqual(bad.slice(0, 3), [], `нечисловые координаты при ${w}×${h}`);
    }
  });

  it('долгий забег с боями и сменой района рисуется без ошибок', () => {
    const g = boot();
    const { Game, Input } = g.ICH;
    Game.start();
    g.record.bad.length = 0;
    for (let i = 0; i < 3000; i++) {
      const p = Game.player;
      Input.now.right = true;
      Input.now.jump = p.grounded || p.vy < -110;
      Input.now.slash = i % 20 < 2;
      Game.health = 5;
      if (Game.state === 'paused') Game.state = 'playing';
      Game.update(1 / 60);
      Input.endFrame();
      if (i % 120 === 0) Game.draw();
    }
    assert.deepEqual(g.record.bad.slice(0, 3), [], 'нечисловые координаты в долгом забеге');
    assert.ok(Game.dist > 50, 'герой всё-таки продвинулся');
  });

  it('каждый босс рисуется и получает урон', () => {
    const g = boot();
    const { Game, Boss, Level } = g.ICH;
    Game.start();
    for (const id of Object.keys(Boss.DEFS)) {
      Level.lap = 0;
      const b = Boss.create({ id, arena: { x0: 0, x1: 1000 }, final: !!Boss.DEFS[id].final });
      Game.boss = b;
      b.state = 'intro';
      g.record.bad.length = 0;
      for (let i = 0; i < 400; i++) {
        Boss.update(b, 1 / 60, Game);
        if (i % 40 === 0) Boss.damage(b, 1, Game, b.x - 40);
      }
      Game.draw();
      assert.deepEqual(g.record.bad.slice(0, 2), [], `нечисловые координаты у босса ${id}`);
      assert.ok(b.hp < b.maxHp, `босс ${id} не получает урон`);
      Game.boss = null;
    }
  });
});

describe('разметка и загрузка', () => {
  it('все id, которые ищет код, есть в index.html', () => {
    const fs = require('fs');
    const path = require('path');
    const { ids } = markup();
    const wanted = new Set();
    for (const rel of scriptOrder()) {
      const code = fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
      for (const m of code.matchAll(/getElementById\('([^']+)'\)/g)) wanted.add(m[1]);
    }
    const missing = [...wanted].filter((id) => !ids.includes(id));
    assert.deepEqual(missing, [], 'код обращается к элементам, которых нет в разметке');
  });

  it('все подключённые скрипты существуют', () => {
    const fs = require('fs');
    const path = require('path');
    for (const rel of scriptOrder()) {
      assert.ok(fs.existsSync(path.join(__dirname, '..', rel)), `нет файла ${rel}`);
    }
  });

  it('игра не тянет ничего извне', () => {
    const fs = require('fs');
    const path = require('path');
    const root = path.join(__dirname, '..');
    const files = ['index.html', 'styles.css'].concat(scriptOrder());
    for (const rel of files) {
      const text = fs.readFileSync(path.join(root, rel), 'utf8');
      const remote = [...text.matchAll(/(?:src|href|url)\s*[=(]\s*["']?(https?:)?\/\/[^"')\s]+/g)];
      assert.deepEqual(remote.map((m) => m[0]), [], `${rel} обращается наружу`);
    }
  });
});
