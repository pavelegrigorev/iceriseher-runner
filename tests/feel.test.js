'use strict';
const { boot } = require('./harness');

describe('управление: нажатие не теряется', () => {
  /* У прыжка буфер был с самого начала, у сабли — нет. Нажатие, попавшее в
     0.3 с отката, просто выбрасывалось: играющий вразнос по толпе стражи
     получал тишину на каждый второй тап и читал это как «кнопка не работает». */
  it('удар, нажатый на исходе отката, срабатывает сразу после него', () => {
    const g = boot();
    const { Game, Input } = g.ICH;
    Game.start();
    g.clearWorld();
    const p = Game.player;

    Input.press('slash');
    g.step(1);
    assert.ok(p.slashT > 0, 'первый удар не начался');
    const first = p.slashId;

    // откат 0.3 с — 18 кадров; тап на двенадцатом раньше просто пропадал
    g.step(11);
    Input.press('slash');
    g.step(1);
    assert.equal(p.slashId, first, 'откат не должен пропускать удар мгновенно');

    g.step(8); // откат заканчивается
    assert.equal(p.slashId, first + 1, 'запомненный удар так и не вышел');
  });

  it('буфер удара не бесконечен', () => {
    const g = boot();
    const { Game, Input, C } = g.ICH;
    Game.start();
    g.clearWorld();
    const p = Game.player;
    Input.press('slash');
    g.step(1);
    const first = p.slashId;
    Input.press('slash');
    // ждём дольше буфера, но дольше отката — удар не должен всплыть сам
    g.step(Math.ceil(C.SLASH_BUFFER * 60) + 2);
    const afterBuffer = p.slashId;
    g.step(30);
    assert.equal(p.slashId, afterBuffer, 'просроченный буфер всё-таки выстрелил');
  });

  it('прыжок по-прежнему буферизуется', () => {
    const g = boot();
    const { Game, Input } = g.ICH;
    Game.start();
    g.clearWorld();
    const p = Game.player;
    g.step(10);
    p.grounded = false;
    p.y -= 40;
    p.coyote = 0;
    p.jumps = 2; // прыжки кончились
    Input.press('jump');
    g.step(2);
    assert.ok(p.y > 0, 'герой на месте');
    assert.ok(p.buffer >= 0, 'буфер прыжка исчез');
  });
});

describe('управление: угол уступа не съедает прыжок', () => {
  /* Задеть плиту головой на пару пикселей — и прыжок раньше гасился насмерть.
     Читается как жульничество геометрии, а не как промах. */
  it('задетый краем уступ обходится, а не гасит подъём', () => {
    const g = boot();
    const { Game, Level, C } = g.ICH;
    Game.start();
    g.clearWorld();
    const p = Game.player;
    g.step(20);

    // плита прямо над головой, задета на три пикселя правым краем героя
    const slab = { x: p.x + p.w - 3, y: p.y - 30, w: 200, h: 20, kind: 'stone' };
    Level.platforms.push(slab);
    const x0 = p.x;
    p.vy = -400;
    g.step(2);

    assert.ok(p.vy < 0, 'подъём погас на трёхпиксельном задевании');
    assert.ok(p.x < x0, 'героя не сдвинуло в сторону от края');
    assert.ok(x0 - p.x <= C.NUDGE + 1, `сдвиг ${(x0 - p.x).toFixed(1)} px больше допустимого`);
  });

  it('плита, в которую влетаешь серединой, по-прежнему останавливает', () => {
    const g = boot();
    const { Game, Level } = g.ICH;
    Game.start();
    g.clearWorld();
    const p = Game.player;
    g.step(20);

    Level.platforms.push({ x: p.x - 100, y: p.y - 30, w: 300, h: 20, kind: 'stone' });
    p.vy = -400;
    g.step(2);
    assert.ok(p.vy >= 0, 'герой прошёл сквозь сплошную плиту');
  });
});

describe('отдача: вибрация', () => {
  it('урон отдаёт в руку, а выключенный звук выключает и её', () => {
    const g = boot();
    const { Game, FX, Audio } = g.ICH;
    const buzzes = [];
    g.sandbox.navigator.vibrate = (v) => { buzzes.push(v); return true; };

    Game.start();
    Game.hurt(1, Game.player.x - 40);
    assert.equal(buzzes.length, 1, 'урон не отдал в руку');

    Audio.muted = true;
    FX.buzz(30);
    assert.equal(buzzes.length, 1, 'выключенный звук должен выключать и вибрацию');
  });

  it('браузер без вибрации не роняет игру', () => {
    const g = boot();
    delete g.sandbox.navigator.vibrate;
    g.ICH.FX.buzz(30);
    g.ICH.FX.buzz([10, 20]);
  });
});

describe('телефон: возврат из фона', () => {
  /* Аудиоконтекст засыпает, когда вкладка уходит в фон, и сам не просыпается,
     а разблокировка звука одноразовая — вернувшись из уведомления, игрок
     раньше получал немую игру без единого способа это починить. */
  it('возврат во вкладку будит звук', () => {
    const g = boot();
    const { Game, Audio } = g.ICH;
    Game.start();
    let unlocks = 0;
    const real = Audio.unlock.bind(Audio);
    Audio.unlock = function () { unlocks++; real(); };

    g.visibility(true);
    assert.equal(Game.state, 'paused', 'уход в фон не поставил игру на паузу');
    g.visibility(false);
    assert.equal(unlocks, 1, 'возврат не разбудил звук');
  });

  it('уход в фон оставляет способ вернуться в игру', () => {
    const g = boot();
    const { Game } = g.ICH;
    Game.start();
    g.visibility(true);
    assert.equal(g.elements.get('screen-pause').classList.contains('hidden'), false,
      'экран паузы должен быть виден, иначе из паузы не выйти');
  });
});
