'use strict';
const { boot } = require('./harness');

const KEY = 'icherisheher.scores';
const NICK_KEY = 'icherisheher.nick';
const LEGACY_KEY = 'icherisheher.best';

/** A stored table, shortest way to describe one. */
const table = (...scores) => JSON.stringify(scores.map((s, i) => ({ nick: 'p' + i, score: s })));

/** Finish a run with a given score without playing it out. */
function finish(g, score, extra) {
  const { Game } = g.ICH;
  Game.newRun();
  Game.score = score;
  Object.assign(Game, extra || {});
  Game.gameOver();
  return Game.rank;
}

describe('таблица рекордов: данные', () => {
  it('держит десять лучших и сортирует по убыванию', () => {
    const g = boot();
    const { Scores } = g.ICH;
    for (let i = 1; i <= 14; i++) Scores.add({ nick: 'n' + i, score: i * 100 });
    const list = Scores.load();
    assert.equal(list.length, 10, 'таблица длиннее десяти строк');
    assert.equal(list[0].score, 1400, 'наверху не лучший результат');
    assert.equal(list[9].score, 500, 'внизу не десятый результат');
    for (let i = 1; i < list.length; i++) {
      assert.ok(list[i - 1].score >= list[i].score, 'порядок нарушен');
    }
  });

  it('слабый забег мимо полной таблицы не проходит', () => {
    const g = boot({ storage: { [KEY]: table(900, 800, 700, 600, 500, 400, 300, 200, 100, 50) } });
    const { Scores } = g.ICH;
    assert.equal(Scores.qualifies(40), false, 'слабый результат считается проходным');
    assert.equal(Scores.add({ nick: 'x', score: 40 }), -1, 'слабый результат попал в таблицу');
    assert.equal(Scores.load().length, 10, 'длина таблицы изменилась');
    assert.equal(Scores.add({ nick: 'x', score: 60 }), 9, 'результат сильнее последнего не попал');
    assert.equal(Scores.load()[9].nick, 'x', 'новая строка не заняла последнее место');
  });

  it('ничья не выбивает того, кто был раньше', () => {
    const g = boot({ storage: { [KEY]: table(500) } });
    const { Scores } = g.ICH;
    assert.equal(Scores.add({ nick: 'поздний', score: 500 }), 1, 'ничья встала выше старой строки');
    assert.equal(Scores.load()[0].nick, 'p0', 'старую строку сместили');
  });

  it('нулевой забег в таблицу не пишется', () => {
    const g = boot();
    const { Scores } = g.ICH;
    assert.equal(Scores.add({ nick: 'x', score: 0 }), -1, 'ноль попал в таблицу');
    assert.equal(Scores.load().length, 0, 'таблица не пуста');
  });

  /* Раньше рекорд был одним числом в icherisheher.best. Обновление игры не
     должно его стирать — иначе у всех, кто уже играл, счётчик обнулится. */
  it('рекорд из прошлой версии переезжает в таблицу', () => {
    const g = boot({ storage: { [LEGACY_KEY]: '4321' } });
    const { Scores, Game } = g.ICH;
    assert.equal(Scores.best(), 4321, 'старый рекорд потерян');
    assert.equal(Scores.load()[0].nick, 'Qonaq', 'у перенесённой строки нет подписи по умолчанию');
    assert.equal(Game.best, 4321, 'игра не видит перенесённый рекорд');
  });

  it('очищенная таблица не воскрешает старый рекорд', () => {
    const g = boot({ storage: { [LEGACY_KEY]: '4321' } });
    g.ICH.Scores.clear();
    assert.equal(g.stored(KEY), '[]', 'после очистки ключ должен остаться пустым списком');
    const again = boot({ storage: { [LEGACY_KEY]: '4321', [KEY]: '[]' } });
    assert.equal(again.ICH.Scores.load().length, 0, 'старый рекорд вернулся после очистки');
  });

  it('мусор в хранилище не роняет игру', () => {
    for (const raw of ['не json', '{}', 'null', '[1,2,3]', '[{"score":"ой"}]', '[{"score":-5}]']) {
      const g = boot({ storage: { [KEY]: raw } });
      assert.deepEqual(g.ICH.Scores.load(), [], `таблица не очистилась от мусора: ${raw}`);
      assert.equal(g.ICH.Scores.best(), 0, `рекорд не обнулился при мусоре: ${raw}`);
    }
  });

  it('битые числа в строке чинятся, а не разъезжаются', () => {
    const g = boot({ storage: { [KEY]: '[{"score":700,"dist":null,"kills":"5","combo":0}]' } });
    const row = g.ICH.Scores.load()[0];
    assert.equal(row.dist, 0, 'пустая дистанция должна стать нулём');
    assert.equal(row.kills, 5, 'число строкой должно разобраться');
    assert.equal(row.combo, 1, 'комбо меньше единицы не бывает');
  });
});

describe('таблица рекордов: подпись', () => {
  it('ник обрезается по длине и лишним пробелам', () => {
    const g = boot();
    const { Scores } = g.ICH;
    assert.equal(Scores.normNick('  Пaвел   Г  '), 'Пaвел Г', 'пробелы не схлопнулись');
    assert.equal(Scores.normNick('длиннющее прозвище').length, Scores.nickMax, 'ник не обрезан');
    assert.equal(Scores.normNick(null), '', 'пустой ник должен остаться пустым');
    Scores.add({ nick: '   ', score: 100 });
    assert.equal(Scores.load()[0].nick, 'Qonaq', 'безымянная строка не подписана по умолчанию');
  });

  it('ник переживает перезапуск', () => {
    const g = boot();
    g.ICH.Scores.setNick('Xəzri');
    assert.equal(g.stored(NICK_KEY), 'Xəzri', 'ник не записан в хранилище');
    const again = boot({ storage: { [NICK_KEY]: 'Xəzri' } });
    assert.equal(again.ICH.Scores.loadNick(), 'Xəzri', 'ник не прочитан при запуске');
  });

  /* Ник попадает в разметку таблицы, а таблица собирается строкой. */
  it('ник в таблице экранируется', () => {
    const g = boot();
    const { Scores } = g.ICH;
    Scores.add({ nick: '<img src=x>', score: 100 });
    const html = Scores.tableHTML(-1);
    assert.ok(html.indexOf('<img') < 0, 'тег из ника попал в разметку как тег');
    assert.ok(html.indexOf('&lt;img src=x&gt;') > 0, 'ник не экранирован');
  });

  it('пустая таблица показывает подсказку, а не пустую сетку', () => {
    const g = boot();
    const html = g.ICH.Scores.tableHTML(-1);
    assert.ok(html.indexOf('<table') < 0, 'пустая таблица рисует сетку');
    assert.ok(html.indexOf('board-empty') > 0, 'нет подсказки для пустой таблицы');
  });
});

describe('таблица рекордов: конец забега', () => {
  it('итог забега попадает в таблицу и подсвечивается', () => {
    const g = boot({ storage: { [NICK_KEY]: 'Ага' } });
    const { Game, Scores } = g.ICH;
    const rank = finish(g, 1234.7, { dist: 412.9, kills: 23, coins: 87, comboMax: 12 });
    assert.equal(rank, 0, 'первый забег не занял первое место');
    const row = Scores.load()[0];
    assert.equal(row.nick, 'Ага', 'строка не подписана сохранённым ником');
    assert.equal(row.score, 1234, 'очки округляются вниз');
    assert.equal(row.dist, 412, 'дистанция округляется вниз');
    assert.equal(Game.best, 1234, 'рекорд не обновился');
    assert.ok(g.elements.get('over-board').innerHTML.indexOf('class="me"') > 0, 'своя строка не подсвечена');
    assert.equal(g.elements.get('over-place').classList.contains('hidden'), false, 'поле подписи спрятано');
  });

  it('итог сводится к одному числу и строке подробностей', () => {
    const g = boot();
    finish(g, 5000, { dist: 300, kills: 1, coins: 4, comboMax: 3 });
    assert.equal(g.elements.get('over-score').textContent, '5 000', 'разряды не разделены');
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

  it('забег мимо таблицы не предлагает подписаться', () => {
    const g = boot({ storage: { [KEY]: table(900, 800, 700, 600, 500, 400, 300, 200, 100, 50) } });
    assert.equal(finish(g, 10), -1, 'слабый забег попал в таблицу');
    assert.equal(g.elements.get('over-place').classList.contains('hidden'), true, 'поле подписи показано зря');
    assert.ok(g.elements.get('over-board').innerHTML.indexOf('class="me"') < 0, 'подсвечена чужая строка');
  });

  it('комбо запоминается по максимуму за забег, а не по последнему', () => {
    const g = boot();
    const { Game } = g.ICH;
    Game.newRun();
    for (let i = 0; i < 6; i++) Game.bumpCombo(0, 0);
    Game.combo = 1; // сбилось от удара
    Game.score = 100;
    Game.gameOver();
    assert.equal(g.ICH.Scores.load()[0].combo, 7, 'записано текущее комбо вместо максимального');
  });

  it('подпись переписывает строку на месте', () => {
    const g = boot();
    finish(g, 900);
    const nick = g.elements.get('over-nick');
    nick.value = 'Nigar';
    nick.dispatchEvent({ type: 'input', preventDefault() {} });
    assert.equal(g.ICH.Scores.load()[0].nick, 'Nigar', 'строка не переподписана');
    assert.equal(g.stored(NICK_KEY), 'Nigar', 'ник не сохранён для следующего забега');
    assert.ok(g.elements.get('over-board').innerHTML.indexOf('Nigar') > 0, 'таблица не перерисована');
    assert.ok(JSON.parse(g.stored(KEY))[0].nick === 'Nigar', 'таблица не записана в хранилище');
  });
});

describe('таблица рекордов: ввод не воюет с игрой', () => {
  /* Почти каждая буква занята игрой, а на экране итога пробел и Enter
     запускают новый забег. Ник из букв «arwd» иначе набирался бы вместе с
     подкатом, ударом и рестартом. */
  it('печать в поле ника не управляет игрой', () => {
    const g = boot();
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
    const g = boot();
    const { Game } = g.ICH;
    finish(g, 900);
    g.key('keydown', 'Space');
    Game.update(1 / 60);
    assert.equal(Game.state, 'playing', 'пробел на экране итога не начал забег');
  });

  it('пробел на экране рекордов не начинает забег', () => {
    const g = boot();
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
