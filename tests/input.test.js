'use strict';
const { boot } = require('./harness');

describe('ввод: семантика нажатий', () => {
  it('pressed срабатывает один раз, held держится', () => {
    const g = boot();
    const In = g.ICH.Input;
    In.now.jump = true;
    assert.ok(In.pressed('jump'), 'первый кадр — нажатие');
    assert.ok(In.held('jump'));
    In.endFrame();
    assert.ok(!In.pressed('jump'), 'второй кадр — уже не нажатие');
    assert.ok(In.held('jump'), 'но всё ещё удерживается');
  });

  it('released срабатывает на отпускании', () => {
    const g = boot();
    const In = g.ICH.Input;
    In.now.jump = true;
    In.endFrame();
    In.now.jump = false;
    assert.ok(In.released('jump'));
  });
});

describe('ввод: экранные кнопки', () => {
  it('касание кнопки включает её действие', () => {
    const g = boot({ touch: true, width: 740, height: 360 });
    g.touch('touchstart', [g.padCenter('right')]);
    assert.ok(g.ICH.Input.held('right'));
    assert.ok(!g.ICH.Input.held('left'));
  });

  it('палец скользит между кнопками без отрыва', () => {
    const g = boot({ touch: true, width: 740, height: 360 });
    g.touch('touchstart', [g.padCenter('right')]);
    g.touch('touchmove', [g.padCenter('left')]);
    assert.ok(g.ICH.Input.held('left'), 'управление передалось соседней кнопке');
    assert.ok(!g.ICH.Input.held('right'), 'прежняя отпустилась');
  });

  it('мультитач: бег и прыжок одновременно', () => {
    const g = boot({ touch: true, width: 740, height: 360 });
    g.touch('touchstart', [g.padCenter('right'), g.padCenter('jump')]);
    assert.ok(g.ICH.Input.held('right'));
    assert.ok(g.ICH.Input.held('jump'));
    g.touch('touchend', [g.padCenter('right')]);
    assert.ok(g.ICH.Input.held('right'), 'палец на бегу остался');
    assert.ok(!g.ICH.Input.held('jump'), 'прыжок отпущен');
  });

  it('снятие всех пальцев отпускает всё', () => {
    const g = boot({ touch: true, width: 740, height: 360 });
    g.touch('touchstart', [g.padCenter('left'), g.padCenter('slash')]);
    g.touch('touchend', []);
    const on = Object.keys(g.ICH.Input.now).filter((k) => g.ICH.Input.now[k]);
    assert.deepEqual(on, [], 'ни одно действие не залипло');
  });

  /* Регрессия. Экранная кнопка живёт на событиях, а игра читает ввод раз в
     кадр. Быстрый тап, у которого touchstart и touchend уложились между двумя
     кадрами, до починки терялся целиком — и подкат на телефоне не срабатывал,
     потому что «вниз» по своей природе именно тапают, а не удерживают. */
  it('короткий тап между кадрами не теряется', () => {
    const g = boot({ touch: true, width: 740, height: 360 });
    const In = g.ICH.Input;
    In.endFrame();
    g.touch('touchstart', [g.padCenter('down')]);
    g.touch('touchend', []);            // палец снят до того, как игра прочла ввод
    assert.ok(In.pressed('down'), 'нажатие должно дожить до чтения в кадре');
    assert.ok(!In.held('down'), 'но удержанием оно не является');
    In.endFrame();
    assert.ok(!In.pressed('down'), 'и не повторяется на следующем кадре');
  });
});

describe('ввод: подкат с экранных кнопок', () => {
  it('тап «вниз» на бегу переводит героя в подкат', () => {
    const g = boot({ touch: true, width: 740, height: 360 });
    const { Game, Input } = g.ICH;
    Game.start();
    // разогнаться
    g.step(60, () => { Input.now.right = true; });
    assert.ok(Math.abs(Game.player.vx) > 120, 'герой набрал скорость');

    g.touch('touchstart', [g.padCenter('right'), g.padCenter('down')]);
    g.touch('touchend', [g.padCenter('right')]);   // «вниз» отпущен сразу
    g.step(1);
    assert.ok(Game.player.sliding, 'подкат начался');
    assert.equal(Game.player.h, 34, 'хитбокс присел');
  });

  it('подкат заканчивается и рост возвращается', () => {
    const g = boot({ touch: true, width: 740, height: 360 });
    const { Game, Input } = g.ICH;
    Game.start();
    g.step(60, () => { Input.now.right = true; });
    g.touch('touchstart', [g.padCenter('down')]);
    g.touch('touchend', []);
    g.step(1);
    assert.ok(Game.player.sliding);
    g.step(60, () => { Input.now.right = true; });
    assert.ok(!Game.player.sliding, 'подкат завершился');
    assert.equal(Game.player.h, 56, 'рост восстановлен');
  });
});
