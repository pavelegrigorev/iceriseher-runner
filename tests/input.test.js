'use strict';
const { boot } = require('./harness');

const PHONE = { touch: true, width: 740, height: 360 };

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

describe('ввод: стик под большим пальцем', () => {
  /* Прежде движение висело на трёх фиксированных кнопках, и палец искал их
     наощупь. Теперь стик рождается там, где палец лёг. */
  it('стик появляется там, где палец коснулся зоны', () => {
    const g = boot(PHONE);
    const In = g.ICH.Input;
    const [x, y] = g.stickCenter();
    g.touch('touchstart', [[x, y]]);
    assert.equal(In.stick.ox, x, 'начало стика не там, где палец');
    assert.equal(In.stick.oy, y, 'начало стика не там, где палец');
    assert.ok(!In.held('left') && !In.held('right'), 'касание без тяги никуда не ведёт');
  });

  it('тяга вправо и влево ведёт героя', () => {
    const g = boot(PHONE);
    const In = g.ICH.Input;
    const [x, y] = g.stickCenter();
    g.touch('touchstart', [[x, y]]);
    g.touch('touchmove', [[x + 30, y]]);
    assert.ok(In.held('right'), 'тяга вправо не побежала вправо');
    assert.ok(!In.held('left'));
    g.touch('touchmove', [[x - 30, y]]);
    assert.ok(In.held('left'), 'тяга влево не побежала влево');
    assert.ok(!In.held('right'), 'прежнее направление залипло');
  });

  it('мёртвая зона гасит дрожь пальца', () => {
    const g = boot(PHONE);
    const In = g.ICH.Input;
    const [x, y] = g.stickCenter();
    g.touch('touchstart', [[x, y]]);
    g.touch('touchmove', [[x + g.ICH.C.STICK_DEAD - 1, y]]);
    assert.ok(!In.held('right'), 'дрожь в пределах мёртвой зоны повела героя');
    g.touch('touchmove', [[x + g.ICH.C.STICK_DEAD + 2, y]]);
    assert.ok(In.held('right'), 'за мёртвой зоной герой не пошёл');
  });

  it('тяга вниз — подкат, а бег по диагонали — нет', () => {
    const g = boot(PHONE);
    const In = g.ICH.Input;
    const [x, y] = g.stickCenter();
    g.touch('touchstart', [[x, y]]);
    g.touch('touchmove', [[x, y + 30]]);
    assert.ok(In.held('down'), 'тяга вниз не дала подкат');
    g.touch('touchmove', [[x + 34, y + 18]]);
    assert.ok(In.held('right'), 'диагональ не побежала');
    assert.ok(!In.held('down'), 'бег с чуть опущенным пальцем не должен подкатывать');
  });

  /* Палец, уехавший через полэкрана, иначе больше не может потянуть обратно,
     не отрываясь — а именно это нужно, когда бежишь вправо и вдруг влево. */
  it('уехавший палец тянет обратно без отрыва', () => {
    const g = boot(PHONE);
    const In = g.ICH.Input;
    const [x, y] = g.stickCenter();
    g.touch('touchstart', [[x, y]]);
    g.touch('touchmove', [[x + 200, y]]); // долгий бег вправо
    assert.ok(In.held('right'));
    g.touch('touchmove', [[x + 200 - 30, y]]); // потянули обратно на 30 px
    assert.ok(In.held('left'), 'обратная тяга не сработала — начало стика не поехало за пальцем');
  });

  it('снятие пальца отпускает движение', () => {
    const g = boot(PHONE);
    const In = g.ICH.Input;
    const [x, y] = g.stickCenter();
    g.touch('touchstart', [[x, y]]);
    g.touch('touchmove', [[x + 40, y + 40]]);
    g.touch('touchend', []);
    const on = Object.keys(In.now).filter((k) => In.now[k]);
    assert.deepEqual(on, [], 'что-то залипло после отрыва');
    assert.equal(In.stick.id, null, 'стик не отпустился');
  });

  /* Регрессия по смыслу: палец, начавший на стике, не должен по дороге
     нажимать боевые кнопки, мимо которых его протащило. */
  it('палец со стика не жмёт кнопки, через которые проехал', () => {
    const g = boot(PHONE);
    const In = g.ICH.Input;
    const [x, y] = g.stickCenter();
    const jump = g.padCenter('jump');
    g.touch('touchstart', [[x, y, 7]]);
    g.touch('touchmove', [[jump[0], jump[1], 7]]);
    assert.ok(!In.held('jump'), 'протащенный палец нажал прыжок');
  });

  it('касание вне зоны стик не забирает', () => {
    const g = boot(PHONE);
    const In = g.ICH.Input;
    const jump = g.padCenter('jump');
    g.touch('touchstart', [[jump[0], jump[1]]]);
    assert.equal(In.stick.id, null, 'стик забрал палец из правой половины');
    assert.ok(In.held('jump'), 'кнопка прыжка не сработала');
  });
});

describe('ввод: боевые кнопки', () => {
  it('касание кнопки включает её действие', () => {
    const g = boot(PHONE);
    g.touch('touchstart', [g.padCenter('slash')]);
    assert.ok(g.ICH.Input.held('slash'));
    assert.ok(!g.ICH.Input.held('jump'));
  });

  it('палец скользит между кнопками без отрыва', () => {
    const g = boot(PHONE);
    g.touch('touchstart', [g.padCenter('slash')]);
    g.touch('touchmove', [g.padCenter('jump')]);
    assert.ok(g.ICH.Input.held('jump'), 'управление передалось соседней кнопке');
    assert.ok(!g.ICH.Input.held('slash'), 'прежняя отпустилась');
  });

  it('мультитач: бег стиком и прыжок кнопкой', () => {
    const g = boot(PHONE);
    const In = g.ICH.Input;
    const [x, y] = g.stickCenter();
    const jump = g.padCenter('jump');
    g.touch('touchstart', [[x, y, 1]]);
    g.touch('touchmove', [[x + 30, y, 1]]);
    g.touch('touchstart', [[x + 30, y, 1], [jump[0], jump[1], 2]]);
    assert.ok(In.held('right'), 'бег потерялся при нажатии прыжка');
    assert.ok(In.held('jump'), 'прыжок не нажался');
    g.touch('touchend', [[x + 30, y, 1]]);
    assert.ok(In.held('right'), 'палец на бегу остался');
    assert.ok(!In.held('jump'), 'прыжок отпущен');
  });

  /* Регрессия. Экранная кнопка живёт на событиях, а игра читает ввод раз в
     кадр. Быстрый тап, у которого touchstart и touchend уложились между двумя
     кадрами, до починки терялся целиком. */
  it('короткий тап между кадрами не теряется', () => {
    const g = boot(PHONE);
    const In = g.ICH.Input;
    In.endFrame();
    g.touch('touchstart', [g.padCenter('slash')]);
    g.touch('touchend', []); // палец снят до того, как игра прочла ввод
    assert.ok(In.pressed('slash'), 'нажатие должно дожить до чтения в кадре');
    assert.ok(!In.held('slash'), 'но удержанием оно не является');
    In.endFrame();
    assert.ok(!In.pressed('slash'), 'и не повторяется на следующем кадре');
  });

  it('короткая тяга стика вниз тоже не теряется', () => {
    const g = boot(PHONE);
    const In = g.ICH.Input;
    const [x, y] = g.stickCenter();
    In.endFrame();
    g.touch('touchstart', [[x, y]]);
    g.touch('touchmove', [[x, y + 30]]);
    g.touch('touchend', []);
    assert.ok(In.pressed('down'), 'мгновенная тяга вниз потерялась');
    assert.ok(!In.held('down'), 'но удержанием она не является');
  });
});

describe('ввод: подкат со стика', () => {
  it('тяга «вниз» на бегу переводит героя в подкат', () => {
    const g = boot(PHONE);
    const { Game, Input } = g.ICH;
    Game.start();
    g.step(60, () => { Input.now.right = true; });
    assert.ok(Math.abs(Game.player.vx) > 120, 'герой набрал скорость');

    const [x, y] = g.stickCenter();
    g.touch('touchstart', [[x, y]]);
    g.touch('touchmove', [[x, y + 30]]);
    g.touch('touchend', []);
    g.step(1);
    assert.ok(Game.player.sliding, 'подкат начался');
    assert.equal(Game.player.h, 34, 'хитбокс присел');
  });

  it('подкат заканчивается и рост возвращается', () => {
    const g = boot(PHONE);
    const { Game, Input } = g.ICH;
    Game.start();
    g.step(60, () => { Input.now.right = true; });
    const [x, y] = g.stickCenter();
    g.touch('touchstart', [[x, y]]);
    g.touch('touchmove', [[x, y + 30]]);
    g.touch('touchend', []);
    g.step(1);
    assert.ok(Game.player.sliding);
    g.step(60, () => { Input.now.right = true; });
    assert.ok(!Game.player.sliding, 'подкат завершился');
    assert.equal(Game.player.h, 56, 'рост восстановлен');
  });
});
