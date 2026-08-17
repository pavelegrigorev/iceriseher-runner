'use strict';
const { boot } = require('./harness');

/** Generate a long stretch of street without running the game loop. */
function build(g, chunks, difficulty) {
  const { Level } = g.ICH;
  for (let i = 0; i < chunks; i++) Level.addChunk(difficulty === undefined ? 0.5 : difficulty);
  return Level;
}

/* The city is picked by U.seed, one seed per calendar day, so an invariant
   checked against a single city is checked against a single day. Every
   passability test sweeps a month and a half of them instead — otherwise a
   generator bug simply waits for its date to come up. */
const DAYS = 45;
function eachCity(g, fn) {
  const { U, Level } = g.ICH;
  for (let d = 0; d < DAYS; d++) {
    const day = `2026-${String((d % 12) + 1).padStart(2, '0')}-${String((d % 28) + 1).padStart(2, '0')}`;
    U.seed = U.daySeed(day);
    Level.reset();
    fn(day);
  }
}

describe('уровень: проходимость', () => {
  /* Регрессия. Герой ростом 56 px застревал под уступом крепостной стены,
     висевшим в 52 px над мостовой: под ним не пройти, а запрыгнуть мешает он
     же. Ни одна сплошная плита не должна оставлять просвет меньше роста. */
  it('ни одна сплошная плита не оставляет просвет ниже роста героя — в любом городе', () => {
    const g = boot();
    const { Level, C } = g.ICH;
    eachCity(g, (day) => {
      build(g, 120);
      const offenders = Level.platforms.filter((p) => {
        if (p.oneWay) return false;
        const bottom = p.y + p.h;
        return bottom < C.GROUND_Y && bottom > C.GROUND_Y - 64;
      });
      assert.deepEqual(
        offenders.map((p) => `${p.kind}@${p.x | 0} низ ${p.y + p.h}`),
        [],
        `плита висит слишком низко над улицей — под ней ловушка (город ${day})`
      );
    });
  });

  /* Порог — измеренная высота одиночного прыжка с разбега (см. loop.test.js),
     а не круглое число: раньше здесь стояло 122 px, и тест пропускал лестницу,
     которую одним прыжком не взять. */
  it('шаги лестниц берутся одним прыжком — в любом городе', () => {
    const g = boot();
    const { Level, C } = g.ICH;
    eachCity(g, (day) => {
      build(g, 120);
      const steps = Level.platforms
        .filter((p) => p.kind === 'stone' && p.y < C.GROUND_Y - 40)
        .map((p) => p.y)
        .sort((a, b) => b - a);
      for (let i = 1; i < steps.length; i++) {
        const rise = steps[i - 1] - steps[i];
        if (rise > 0 && rise < 200) assert.ok(rise <= 95, `подъём ${rise} px выше высоты прыжка (город ${day})`);
      }
    });
  });

  it('геометрия конечна — ни одной NaN-координаты, в любом городе', () => {
    const g = boot();
    const { Level } = g.ICH;
    eachCity(g, (day) => {
      build(g, 100);
      for (const set of ['platforms', 'hazards', 'pickups', 'enemies', 'decos', 'ropes']) {
        for (const o of Level[set]) {
          assert.finite(o.x, `${set}: x (город ${day})`);
          assert.finite(o.y, `${set}: y (город ${day})`);
        }
      }
    });
  });
});

describe('город: один на день, разный по дням', () => {
  it('одна и та же дата даёт один и тот же город', () => {
    const shape = (day) => {
      const g = boot();
      const { U, Level } = g.ICH;
      U.seed = U.daySeed(day);
      Level.reset();
      build(g, 40);
      return Level.platforms.map((p) => `${p.kind}@${p.x | 0},${p.y | 0}`).join('|');
    };
    assert.equal(shape('2026-08-17'), shape('2026-08-17'), 'один день — два разных города');
  });

  it('разные даты дают разные города', () => {
    const shape = (day) => {
      const g = boot();
      const { U, Level } = g.ICH;
      U.seed = U.daySeed(day);
      Level.reset();
      build(g, 40);
      return Level.platforms.map((p) => `${p.kind}@${p.x | 0},${p.y | 0}`).join('|');
    };
    const days = ['2026-08-17', '2026-08-18', '2026-08-19', '2026-09-01'];
    const seen = new Set(days.map(shape));
    assert.equal(seen.size, days.length, 'разные дни выдали одинаковую улицу');
  });

  it('забег берёт сегодняшний сид сам', () => {
    const g = boot();
    const { Game, U } = g.ICH;
    U.today = () => '2026-12-31';
    Game.newRun();
    assert.equal(U.seed, U.daySeed('2026-12-31'), 'newRun не выставил сид дня');
  });
});

describe('уровень: районы и боссы', () => {
  it('районы идут по кругу и упираются в финальную арену', () => {
    const g = boot();
    const { Level, Zones, FinalZone } = g.ICH;
    Level.reset();
    const seen = [];
    let guard = 0;
    while (seen.length < 7 && guard++ < 400) {
      const before = Level.marks.length;
      Level.addChunk(0.5);
      if (Level.marks.length > before) seen.push(Level.marks[Level.marks.length - 1].zone.id);
    }
    const expected = Zones.map((z) => z.id);
    assert.equal(seen[0], expected[1], 'после первого района идёт второй');
    assert.ok(seen.includes(FinalZone.id), 'за пятым районом появляется площадь огня');
    const finalAt = seen.indexOf(FinalZone.id);
    assert.equal(seen[finalAt - 1], expected[4], 'финал ровно после морских ворот');
    assert.equal(seen[finalAt + 1], expected[0], 'после финала круг начинается заново');
  });

  it('у каждого района своя арена с боссом и воротами', () => {
    const g = boot();
    const { Level, Zones, FinalZone } = g.ICH;
    Level.reset();
    build(g, 260);
    const ids = Level.bosses.map((b) => b.id);
    assert.ok(ids.length >= 5, `арен сгенерировано мало: ${ids.length}`);
    const known = Zones.map((z) => z.boss).concat([FinalZone.boss]);
    for (const b of Level.bosses) {
      assert.ok(known.includes(b.id), `неизвестный босс ${b.id}`);
      assert.ok(b.gate && b.gate.w > 0, 'у арены нет ворот');
      assert.ok(b.arena.x1 > b.arena.x0, 'арена нулевой ширины');
    }
  });

  it('круг повышает сложность', () => {
    const g = boot();
    const { Level } = g.ICH;
    Level.reset();
    assert.equal(Level.lap, 0);
    let guard = 0;
    while (Level.lap === 0 && guard++ < 400) Level.addChunk(0.5);
    assert.equal(Level.lap, 1, 'после финальной арены счётчик круга растёт');
  });

  it('у босса больше здоровья на следующем круге', () => {
    const g = boot();
    const { Boss, Level } = g.ICH;
    const spec = { id: 'serkerde', arena: { x0: 0, x1: 900 } };
    Level.lap = 0;
    const first = Boss.create(spec).maxHp;
    Level.lap = 2;
    const later = Boss.create(spec).maxHp;
    assert.ok(later > first, `здоровье должно расти: ${first} → ${later}`);
  });
});

describe('уровень: память', () => {
  it('прошлое выгружается, списки не растут бесконечно', () => {
    const g = boot();
    const { Level, C } = g.ICH;
    Level.reset();
    let camX = 0;
    for (let i = 0; i < 400; i++) {
      camX += 600;
      Level.ensure(camX, 0.6);
    }
    assert.ok(Level.platforms.length < 60, `платформ накопилось ${Level.platforms.length}`);
    assert.ok(Level.decos.length < 120, `декора накопилось ${Level.decos.length}`);
    assert.ok(Level.marks.length <= 24, `меток районов накопилось ${Level.marks.length}`);
    const behind = Level.platforms.filter((p) => p.x + p.w < camX - C.W * 3);
    assert.equal(behind.length, 0, 'далеко позади ничего не осталось');
  });
});
