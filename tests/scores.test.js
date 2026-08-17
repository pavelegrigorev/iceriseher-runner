'use strict';
const { boot } = require('./harness');

const ALL_KEY = 'icherisheher.scores';
const DAY_KEY = 'icherisheher.today';
const NICK_KEY = 'icherisheher.nick';
const LEGACY_KEY = 'icherisheher.best';

const DAY = '2026-08-17';
const YESTERDAY = '2026-08-16';

/** A stored all-time table, shortest way to describe one. */
const table = (...scores) => JSON.stringify(scores.map((s, i) => ({ nick: 'p' + i, score: s })));
/** A stored day table. */
const dayTable = (day, ...scores) =>
  JSON.stringify({ day, rows: scores.map((s, i) => ({ nick: 'd' + i, score: s, day })) });

/** Boot with the calendar pinned, so nothing depends on when the suite runs. */
function bootOn(day, storage) {
  const g = boot({ storage });
  g.ICH.U.today = () => day;
  g.ICH.Scores.all = null;
  g.ICH.Scores.day = null;
  g.ICH.Scores.dayOf = '';
  return g;
}

/** Finish a run with a given score without playing it out. */
function finish(g, score, extra) {
  const { Game } = g.ICH;
  Game.newRun();
  Game.score = score;
  Object.assign(Game, extra || {});
  Game.gameOver();
  return Game.places;
}

describe('таблица рекордов: данные', () => {
  it('держит десять лучших и сортирует по убыванию', () => {
    const g = bootOn(DAY);
    const { Scores } = g.ICH;
    for (let i = 1; i <= 14; i++) Scores.add({ nick: 'n' + i, score: i * 100 });
    const list = Scores.loadAll();
    assert.equal(list.length, 10, 'таблица длиннее десяти строк');
    assert.equal(list[0].score, 1400, 'наверху не лучший результат');
    assert.equal(list[9].score, 500, 'внизу не десятый результат');
    for (let i = 1; i < list.length; i++) {
      assert.ok(list[i - 1].score >= list[i].score, 'порядок нарушен');
    }
  });

  it('слабый забег мимо полной таблицы не проходит', () => {
    const g = bootOn(DAY, { [ALL_KEY]: table(900, 800, 700, 600, 500, 400, 300, 200, 100, 50) });
    const { Scores } = g.ICH;
    assert.equal(Scores.qualifies(40, 'all'), false, 'слабый результат считается проходным');
    assert.equal(Scores.add({ nick: 'x', score: 40 }).all, -1, 'слабый результат попал в таблицу');
    assert.equal(Scores.loadAll().length, 10, 'длина таблицы изменилась');
    assert.equal(Scores.add({ nick: 'x', score: 60 }).all, 9, 'результат сильнее последнего не попал');
    assert.equal(Scores.loadAll()[9].nick, 'x', 'новая строка не заняла последнее место');
  });

  it('ничья не выбивает того, кто был раньше', () => {
    const g = bootOn(DAY, { [ALL_KEY]: table(500) });
    const { Scores } = g.ICH;
    assert.equal(Scores.add({ nick: 'поздний', score: 500 }).all, 1, 'ничья встала выше старой строки');
    assert.equal(Scores.loadAll()[0].nick, 'p0', 'старую строку сместили');
  });

  it('нулевой забег в таблицу не пишется', () => {
    const g = bootOn(DAY);
    const { Scores } = g.ICH;
    assert.deepEqual(Scores.add({ nick: 'x', score: 0 }), { all: -1, day: -1 }, 'ноль попал в таблицу');
    assert.equal(Scores.loadAll().length, 0, 'таблица не пуста');
  });

  /* Раньше рекорд был одним числом в icherisheher.best. Обновление игры не
     должно его стирать — иначе у всех, кто уже играл, счётчик обнулится. */
  it('рекорд из прошлой версии переезжает в таблицу', () => {
    const g = boot({ storage: { [LEGACY_KEY]: '4321' } });
    const { Scores, Game } = g.ICH;
    assert.equal(Scores.best(), 4321, 'старый рекорд потерян');
    assert.equal(Scores.loadAll()[0].nick, 'Qonaq', 'у перенесённой строки нет подписи по умолчанию');
    assert.equal(Game.best, 4321, 'игра не видит перенесённый рекорд');
  });

  it('очищенная таблица не воскрешает старый рекорд', () => {
    const g = bootOn(DAY, { [LEGACY_KEY]: '4321' });
    g.ICH.Scores.clear();
    assert.equal(g.stored(ALL_KEY), '[]', 'после очистки ключ должен остаться пустым списком');
    const again = bootOn(DAY, { [LEGACY_KEY]: '4321', [ALL_KEY]: '[]' });
    assert.equal(again.ICH.Scores.loadAll().length, 0, 'старый рекорд вернулся после очистки');
  });

  it('мусор в хранилище не роняет игру', () => {
    for (const raw of ['не json', '{}', 'null', '[1,2,3]', '[{"score":"ой"}]', '[{"score":-5}]']) {
      const g = bootOn(DAY, { [ALL_KEY]: raw, [DAY_KEY]: raw });
      assert.deepEqual(g.ICH.Scores.loadAll(), [], `таблица не очистилась от мусора: ${raw}`);
      assert.deepEqual(g.ICH.Scores.loadDay(), [], `дневная таблица не очистилась: ${raw}`);
      assert.equal(g.ICH.Scores.best(), 0, `рекорд не обнулился при мусоре: ${raw}`);
    }
  });

  it('битые числа в строке чинятся, а не разъезжаются', () => {
    const g = bootOn(DAY, { [ALL_KEY]: '[{"score":700,"dist":null,"kills":"5","combo":0}]' });
    const row = g.ICH.Scores.loadAll()[0];
    assert.equal(row.dist, 0, 'пустая дистанция должна стать нулём');
    assert.equal(row.kills, 5, 'число строкой должно разобраться');
    assert.equal(row.combo, 1, 'комбо меньше единицы не бывает');
  });
});

describe('таблица рекордов: сегодня и всё время', () => {
  it('забег попадает в обе таблицы и помнит свой день', () => {
    const g = bootOn(DAY);
    const { Scores } = g.ICH;
    const places = Scores.add({ nick: 'Aygün', score: 500 });
    assert.deepEqual(places, { all: 0, day: 0 }, 'забег встал не на первое место в обеих');
    assert.equal(Scores.loadDay()[0].day, DAY, 'строка не подписана датой');
    assert.equal(Scores.loadAll()[0].day, DAY, 'дата не попала во всевременную таблицу');
  });

  /* Город меняется каждый день, поэтому вчерашний рейтинг ранжирует забеги
     через город, которого больше нет. */
  it('дневная таблица со вчерашней датой выбрасывается', () => {
    const g = bootOn(DAY, { [DAY_KEY]: dayTable(YESTERDAY, 9000, 8000) });
    const { Scores } = g.ICH;
    assert.deepEqual(Scores.loadDay(), [], 'вчерашняя таблица осталась на сегодня');
    assert.equal(Scores.add({ nick: 'x', score: 100 }).day, 0,
      'слабый забег должен быть первым в пустой сегодняшней таблице');
  });

  it('сегодняшняя таблица переживает перезапуск', () => {
    const g = bootOn(DAY);
    g.ICH.Scores.add({ nick: 'Rəşid', score: 700 });
    const again = bootOn(DAY, { [DAY_KEY]: g.stored(DAY_KEY) });
    assert.equal(again.ICH.Scores.loadDay().length, 1, 'сегодняшняя таблица не прочиталась');
    assert.equal(again.ICH.Scores.loadDay()[0].nick, 'Rəşid', 'строка потеряла подпись');
  });

  it('слабый за всё время может быть сильным за сегодня', () => {
    const g = bootOn(DAY, { [ALL_KEY]: table(9000, 8000, 7000, 6000, 5000, 4000, 3000, 2000, 1000, 900) });
    const places = g.ICH.Scores.add({ nick: 'x', score: 100 });
    assert.equal(places.all, -1, 'слабый забег попал во всевременную таблицу');
    assert.equal(places.day, 0, 'сегодня он должен быть первым');
  });

  it('очистка стирает обе таблицы', () => {
    const g = bootOn(DAY);
    g.ICH.Scores.add({ nick: 'x', score: 500 });
    g.ICH.Scores.clear();
    assert.equal(g.ICH.Scores.loadAll().length, 0, 'всевременная таблица уцелела');
    assert.equal(g.ICH.Scores.loadDay().length, 0, 'сегодняшняя таблица уцелела');
    assert.equal(JSON.parse(g.stored(DAY_KEY)).rows.length, 0, 'в хранилище остались строки');
  });

  it('подпись правит строку в обеих таблицах разом', () => {
    const g = bootOn(DAY);
    const { Scores } = g.ICH;
    const places = Scores.add({ nick: 'x', score: 500 });
    Scores.rename(places, 'Nigar');
    assert.equal(Scores.loadAll()[places.all].nick, 'Nigar', 'всевременная строка не переподписана');
    assert.equal(Scores.loadDay()[places.day].nick, 'Nigar', 'сегодняшняя строка не переподписана');
  });
});

describe('таблица рекордов: подпись', () => {
  it('ник обрезается по длине и лишним пробелам', () => {
    const g = bootOn(DAY);
    const { Scores } = g.ICH;
    assert.equal(Scores.normNick('  Пaвел   Г  '), 'Пaвел Г', 'пробелы не схлопнулись');
    assert.equal(Scores.normNick('длиннющее прозвище').length, Scores.nickMax, 'ник не обрезан');
    assert.equal(Scores.normNick(null), '', 'пустой ник должен остаться пустым');
    Scores.add({ nick: '   ', score: 100 });
    assert.equal(Scores.loadAll()[0].nick, 'Qonaq', 'безымянная строка не подписана по умолчанию');
  });

  it('ник переживает перезапуск', () => {
    const g = bootOn(DAY);
    g.ICH.Scores.setNick('Xəzri');
    assert.equal(g.stored(NICK_KEY), 'Xəzri', 'ник не записан в хранилище');
    const again = bootOn(DAY, { [NICK_KEY]: 'Xəzri' });
    assert.equal(again.ICH.Scores.loadNick(), 'Xəzri', 'ник не прочитан при запуске');
  });

  /* Ник попадает в разметку таблицы, а таблица собирается строкой. */
  it('ник в таблице экранируется', () => {
    const g = bootOn(DAY);
    const { Scores } = g.ICH;
    Scores.add({ nick: '<img src=x>', score: 100 });
    const html = Scores.tableHTML('all', -1);
    assert.ok(html.indexOf('<img') < 0, 'тег из ника попал в разметку как тег');
    assert.ok(html.indexOf('&lt;img src=x&gt;') > 0, 'ник не экранирован');
  });

  it('пустая таблица показывает подсказку, а не пустую сетку', () => {
    const g = bootOn(DAY);
    const { Scores } = g.ICH;
    assert.ok(Scores.tableHTML('all', -1).indexOf('<table') < 0, 'пустая таблица рисует сетку');
    assert.ok(Scores.tableHTML('day', -1).indexOf('board-empty') > 0, 'нет подсказки для пустого дня');
  });
});

describe('таблица рекордов: конец забега', () => {
  it('итог забега попадает в таблицу и подсвечивается', () => {
    const g = bootOn(DAY, { [NICK_KEY]: 'Ага' });
    const { Game, Scores } = g.ICH;
    const places = finish(g, 1234.7, { dist: 412.9, kills: 23, coins: 87, comboMax: 12 });
    assert.deepEqual(places, { all: 0, day: 0 }, 'первый забег не занял первое место');
    const row = Scores.loadAll()[0];
    assert.equal(row.nick, 'Ага', 'строка не подписана сохранённым ником');
    assert.equal(row.score, 1234, 'очки округляются вниз');
    assert.equal(row.dist, 412, 'дистанция округляется вниз');
    assert.equal(Game.best, 1234, 'рекорд не обновился');
    assert.ok(g.elements.get('over-board').innerHTML.indexOf('class="me"') > 0, 'своя строка не подсвечена');
    assert.equal(g.elements.get('over-place').classList.contains('hidden'), false, 'поле подписи спрятано');
  });

  it('итог сводится к одному числу и строке подробностей', () => {
    const g = bootOn(DAY);
    finish(g, 5000, { dist: 300, kills: 1, coins: 4, comboMax: 3 });
    const score = g.elements.get('over-score').textContent;
    assert.equal(score, g.ICH.Scores.num(5000), 'число собрано не тем же форматом');
    assert.ok(/^5\s000$/.test(score), 'разряды не разделены');
    assert.equal(
      g.elements.get('over-details').textContent,
      '300 м · 1 враг · 4 золота · комбо ×3',
      'строка подробностей собрана не так',
    );
    finish(g, 4000, { dist: 10, kills: 22, coins: 0, comboMax: 1 });
    assert.ok(g.elements.get('over-details').textContent.indexOf('22 врага') > 0, 'склонение по числу');
    finish(g, 3000, { dist: 10, kills: 15, coins: 0, comboMax: 1 });
    assert.ok(g.elements.get('over-details').textContent.indexOf('15 врагов') > 0, 'склонение на -надцать');
  });

  it('экран итога открывается на сегодняшней таблице', () => {
    const g = bootOn(DAY);
    finish(g, 900);
    assert.equal(g.ICH.Game.board, 'day', 'по умолчанию должна быть таблица «сегодня»');
    assert.ok(g.elements.get('over-tab-day').classList.contains('on'), 'вкладка «сегодня» не подсвечена');
    assert.ok(g.elements.get('over-place-label').textContent.indexOf('сегодня') > 0,
      'подпись места не про сегодня');
  });

  it('вкладка переключает таблицу и подсветку', () => {
    const g = bootOn(DAY, { [ALL_KEY]: table(9000, 8000, 7000, 6000, 5000, 4000, 3000, 2000, 1000, 900) });
    finish(g, 100);
    g.elements.get('over-tab-all').click();
    assert.equal(g.ICH.Game.board, 'all', 'вкладка не переключилась');
    assert.ok(g.elements.get('over-board').innerHTML.indexOf('class="me"') < 0,
      'забег не попал во всевременную таблицу, подсвечивать нечего');
    g.elements.get('over-tab-day').click();
    assert.ok(g.elements.get('over-board').innerHTML.indexOf('class="me"') > 0, 'своя строка потерялась');
  });

  it('забег мимо обеих таблиц не предлагает подписаться', () => {
    const full = table(900, 800, 700, 600, 500, 400, 300, 200, 100, 50);
    const g = bootOn(DAY, { [ALL_KEY]: full, [DAY_KEY]: dayTable(DAY, 900, 800, 700, 600, 500, 400, 300, 200, 100, 50) });
    assert.deepEqual(finish(g, 10), { all: -1, day: -1 }, 'слабый забег куда-то попал');
    assert.equal(g.elements.get('over-place').classList.contains('hidden'), true, 'поле подписи показано зря');
  });

  it('комбо запоминается по максимуму за забег, а не по последнему', () => {
    const g = bootOn(DAY);
    const { Game } = g.ICH;
    Game.newRun();
    for (let i = 0; i < 6; i++) Game.bumpCombo(0, 0);
    Game.combo = 1; // сбилось от удара
    Game.score = 100;
    Game.gameOver();
    assert.equal(g.ICH.Scores.loadAll()[0].combo, 7, 'записано текущее комбо вместо максимального');
  });

  it('подпись переписывает строку на месте', () => {
    const g = bootOn(DAY);
    finish(g, 900);
    const nick = g.elements.get('over-nick');
    nick.value = 'Nigar';
    nick.dispatchEvent({ type: 'input', preventDefault() {} });
    assert.equal(g.ICH.Scores.loadAll()[0].nick, 'Nigar', 'строка не переподписана');
    assert.equal(g.stored(NICK_KEY), 'Nigar', 'ник не сохранён для следующего забега');
    assert.ok(g.elements.get('over-board').innerHTML.indexOf('Nigar') > 0, 'таблица не перерисована');
    assert.equal(JSON.parse(g.stored(ALL_KEY))[0].nick, 'Nigar', 'таблица не записана в хранилище');
  });
});

describe('таблица рекордов: ввод не воюет с игрой', () => {
  /* Почти каждая буква занята игрой, а на экране итога пробел и Enter
     запускают новый забег. Ник из букв «arwd» иначе набирался бы вместе с
     подкатом, ударом и рестартом. */
  it('печать в поле ника не управляет игрой', () => {
    const g = bootOn(DAY);
    const { Game, Input } = g.ICH;
    finish(g, 900);
    const nick = g.elements.get('over-nick');
    for (const code of ['KeyA', 'KeyR', 'KeyM', 'Space', 'Enter']) {
      g.key('keydown', code, nick);
      g.key('keyup', code, nick);
    }
    assert.deepEqual(Object.keys(Input.now), [], 'нажатия в поле ввода дошли до игры');
    Game.update(1 / 60);
    assert.equal(Game.state, 'over', 'печать в поле ника перезапустила забег');
  });

  it('та же клавиша вне поля ввода работает как раньше', () => {
    const g = bootOn(DAY);
    const { Game } = g.ICH;
    finish(g, 900);
    g.key('keydown', 'Space');
    Game.update(1 / 60);
    assert.equal(Game.state, 'playing', 'пробел на экране итога не начал забег');
  });

  it('пробел на экране рекордов не начинает забег', () => {
    const g = bootOn(DAY);
    const { Game } = g.ICH;
    g.elements.get('btn-scores').click();
    g.key('keydown', 'Space');
    Game.update(1 / 60);
    assert.equal(Game.state, 'title', 'пробел поверх таблицы рекордов начал забег');
    g.elements.get('btn-scores-back').click();
    g.key('keydown', 'Space');
    Game.update(1 / 60);
    assert.equal(Game.state, 'playing', 'пробел в меню перестал начинать забег');
  });
});
