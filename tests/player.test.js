'use strict';
const { boot } = require('./harness');

/** Run the game with a fixed input pattern and report how high the hero got. */
function apexRise(g, hold) {
  const { Game, Input } = g.ICH;
  const groundY = Game.player.y;
  let top = groundY;
  g.step(80, (i) => {
    Input.now.jump = i < 2 || (hold && Game.player.vy < -110);
    top = Math.min(top, Game.player.y);
  });
  return groundY - top;
}

describe('герой: прыжок', () => {
  it('удержание даёт полную высоту, достаточную для уступа', () => {
    const g = boot();
    g.ICH.Game.start();
    const rise = apexRise(g, true);
    // площадки в генераторе поднимаются шагами по 78-84 px
    assert.between(rise, 100, 140, 'высота прыжка вне расчётного диапазона');
  });

  it('короткое нажатие даёт заметно более низкий прыжок', () => {
    const a = boot(); a.ICH.Game.start();
    const b = boot(); b.ICH.Game.start();
    const full = apexRise(a, true);
    const hop = apexRise(b, false);
    assert.ok(hop < full * 0.75, `подрезанный прыжок должен быть ниже: ${hop} против ${full}`);
  });

  it('второй прыжок в воздухе поднимает выше и крутит сальто', () => {
    const g = boot();
    const { Game, Input } = g.ICH;
    Game.start();
    const groundY = Game.player.y;
    let top = groundY;
    let flipped = false;
    g.step(90, (i) => {
      Input.now.jump = i < 2 || (i >= 22 && i < 24) || Game.player.vy < -110;
      top = Math.min(top, Game.player.y);
      if (Game.player.flipT > 0) flipped = true;
    });
    assert.ok(groundY - top > 150, 'двойной прыжок должен забирать выше одинарного');
    assert.ok(flipped, 'на втором прыжке крутится сальто');
  });

  it('койот-тайм позволяет прыгнуть чуть позже края', () => {
    const g = boot();
    const { Game, Input, C } = g.ICH;
    Game.start();
    Game.player.grounded = false;
    Game.player.coyote = C.COYOTE;
    g.step(1, () => { Input.press('jump'); });
    assert.ok(Game.player.vy < -400, 'прыжок засчитан в окне койот-тайма');
  });
});

describe('герой: подкат', () => {
  it('на месте не начинается', () => {
    const g = boot();
    const { Game, Input } = g.ICH;
    Game.start();
    g.step(1, () => { Input.press('down'); });
    assert.ok(!Game.player.sliding, 'подкат — приём на бегу');
  });

  it('на бегу приседает и разгоняет', () => {
    const g = boot();
    const { Game, Input } = g.ICH;
    Game.start();
    g.step(60, () => { Input.now.right = true; });
    const before = Game.player.h;
    g.step(1, () => { Input.now.right = true; Input.press('down'); });
    assert.equal(before, 56);
    assert.equal(Game.player.h, 34, 'хитбокс присел');
    assert.ok(Math.abs(Game.player.vx) >= 330, 'подкат даёт рывок');
  });
});

describe('герой: столкновения', () => {
  it('стоит на земле и не проваливается', () => {
    const g = boot();
    const { Game, C } = g.ICH;
    Game.start();
    g.clearWorld();
    g.step(120);
    assert.equal(Game.player.y + Game.player.h, C.GROUND_Y, 'ноги ровно на мостовой');
    assert.ok(Game.player.grounded);
  });

  it('сплошной блок останавливает по горизонтали', () => {
    const g = boot();
    const { Game, Level, Input, C, U } = g.ICH;
    Game.start();
    g.clearWorld();
    const wallX = Game.player.x + 200;
    Level.block(wallX, C.GROUND_Y - 200, 40, 210, 'stone', false, U.rng(1));
    g.step(120, () => { Input.now.right = true; });
    assert.ok(Game.player.x + Game.player.w <= wallX + 0.5, 'герой не прошёл сквозь стену');
  });

  it('сквозь односторонний навес можно пройти снизу и встать сверху', () => {
    const g = boot();
    const { Game, Level, Input, C, U } = g.ICH;
    Game.start();
    g.clearWorld();
    const y = C.GROUND_Y - 110;
    Level.block(Game.player.x - 40, y, 200, 20, 'wood', true, U.rng(2));
    let wentThrough = false;
    // один прыжок и не подпрыгивать снова, иначе он так и будет скакать
    g.step(90, (i) => {
      Input.now.jump = i < 2 || (i < 24 && Game.player.vy < -110);
      if (Game.player.y + Game.player.h < y) wentThrough = true;
    });
    assert.ok(wentThrough, 'снизу навес проницаем');
    assert.ok(Game.player.grounded, 'приземлился');
    assert.near(Game.player.y + Game.player.h, y, 1, 'стоит на навесе, а не провалился на мостовую');
  });

  it('удержание «вниз» на навесе спрыгивает с него', () => {
    const g = boot();
    const { Game, Level, Input, C, U } = g.ICH;
    Game.start();
    g.clearWorld();
    const y = C.GROUND_Y - 110;
    Level.block(Game.player.x - 40, y, 200, 20, 'wood', true, U.rng(3));
    g.step(90, (i) => { Input.now.jump = i < 2 || (i < 24 && Game.player.vy < -110); });
    assert.near(Game.player.y + Game.player.h, y, 1, 'сначала стоит на навесе');
    g.step(60, () => { Input.now.down = true; });
    assert.near(Game.player.y + Game.player.h, C.GROUND_Y, 1, 'спрыгнул на мостовую');
  });
});

describe('герой: урон', () => {
  it('снимает жизнь, даёт неуязвимость и отбрасывает', () => {
    const g = boot();
    const { Game } = g.ICH;
    Game.start();
    const hp = Game.health;
    Game.hurt(1, Game.player.x + 60);
    assert.equal(Game.health, hp - 1);
    assert.ok(Game.player.invulT > 0, 'выданы кадры неуязвимости');
    assert.ok(Game.player.vx < 0, 'отброшен в сторону от источника');
  });

  it('во время неуязвимости повторный урон не проходит', () => {
    const g = boot();
    const { Game } = g.ICH;
    Game.start();
    Game.hurt(1, 0);
    const hp = Game.health;
    Game.hurt(1, 0);
    assert.equal(Game.health, hp, 'второй удар подряд игнорируется');
  });

  it('на нуле жизней забег заканчивается', () => {
    const g = boot();
    const { Game } = g.ICH;
    Game.start();
    Game.health = 1;
    Game.hurt(1, 0);
    assert.equal(Game.state, 'dying');
    g.step(120);
    assert.equal(Game.state, 'over');
  });
});
