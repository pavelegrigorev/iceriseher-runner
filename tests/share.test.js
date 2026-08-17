'use strict';
const { boot } = require('./harness');

const RUN = { nick: 'Aygün', score: 8123, dist: 640, kills: 23, coins: 87, combo: 12, day: '2026-08-17' };

/** Let the share promises settle. Counting microtasks would be guesswork —
    assimilating a promise from the sandbox costs its own ticks. */
const settle = () => new Promise((r) => setTimeout(r, 0));

/** Finish a run so the results screen has something to share. */
function finish(g, score) {
  const { Game } = g.ICH;
  Game.newRun();
  Game.score = score;
  Game.dist = 640;
  Game.kills = 23;
  Game.comboMax = 12;
  Game.gameOver();
}

describe('поделиться: текст', () => {
  it('в тексте есть счёт, метры, ник и ссылка', () => {
    const g = boot();
    const t = g.ICH.Share.text(RUN);
    assert.ok(t.indexOf('Aygün') >= 0, 'нет ника');
    assert.ok(/8\s123/.test(t), 'нет счёта с разрядами');
    assert.ok(t.indexOf('640') >= 0, 'нет метров');
    assert.ok(t.indexOf('комбо ×12') >= 0, 'нет комбо');
    assert.ok(/https?:\/\//.test(t), 'нет ссылки, по которой можно прийти играть');
  });

  it('безымянный забег не оставляет пустого тире', () => {
    const g = boot();
    const t = g.ICH.Share.text(Object.assign({}, RUN, { nick: '' }));
    assert.ok(t.indexOf('—') < 0, 'осталось висячее тире от пустого ника');
    assert.ok(t.indexOf('İçərişəhər Runner') === 0, 'текст должен начинаться с названия');
  });

  it('комбо ×1 в текст не лезет', () => {
    const g = boot();
    const t = g.ICH.Share.text(Object.assign({}, RUN, { combo: 1 }));
    assert.ok(t.indexOf('комбо') < 0, 'комбо ×1 нечем хвастаться');
  });

  it('дата человеческая, а битая — просто отсутствует', () => {
    const g = boot();
    const { Share } = g.ICH;
    assert.equal(Share.dayLabel('2026-08-17'), '17 августа');
    assert.equal(Share.dayLabel('2026-01-01'), '1 января');
    assert.equal(Share.dayLabel('чепуха'), '', 'битая дата должна дать пустую строку');
    assert.equal(Share.dayLabel(undefined), '', 'без даты — пустая строка');
  });
});

describe('поделиться: как отдаём', () => {
  it('на телефоне уходит в системное окно вместе с картинкой', () => {
    const g = boot();
    const nav = g.sandbox.navigator;
    const shared = [];
    // canvas в песочнице рисовать не умеет, поэтому карточка не соберётся —
    // проверяем, что путь без картинки всё равно отдаёт текст в share
    nav.share = (data) => { shared.push(data); return Promise.resolve(); };
    let how = null;
    g.ICH.Share.run(RUN, (h) => { how = h; });
    assert.equal(shared.length, 1, 'ничего не ушло в системное окно');
    assert.ok(shared[0].text.indexOf('Aygün') >= 0, 'в системное окно ушёл не тот текст');
    return settle().then(() => {
      assert.equal(how, 'shared', 'результат отдачи не доложен');
    });
  });

  it('без системного окна текст ложится в буфер обмена', () => {
    const g = boot();
    const nav = g.sandbox.navigator;
    const copied = [];
    nav.clipboard = { writeText: (t) => { copied.push(t); return Promise.resolve(); } };
    g.ICH.Share.run(RUN, () => {});
    assert.equal(copied.length, 1, 'в буфер ничего не легло');
    assert.ok(copied[0].indexOf('8') >= 0, 'в буфер лёг не тот текст');
  });

  it('браузер без всего просто говорит «не вышло»', () => {
    const g = boot();
    let how = null;
    g.ICH.Share.run(RUN, (h) => { how = h; });
    assert.equal(how, 'failed', 'должен честно доложить, что отдать некуда');
  });

  it('отменённое окно не считается отправкой', () => {
    const g = boot();
    g.sandbox.navigator.share = () => Promise.reject(new Error('отменено'));
    let how = null;
    g.ICH.Share.run(RUN, (h) => { how = h; });
    return settle().then(() => {
      assert.equal(how, 'cancel', 'отмена не должна читаться как успех');
    });
  });
});

describe('поделиться: кнопка', () => {
  it('кнопка делится именно последним забегом', () => {
    const g = boot();
    const shared = [];
    g.sandbox.navigator.share = (d) => { shared.push(d); return Promise.resolve(); };
    finish(g, 4200);
    g.elements.get('btn-share').click();
    assert.equal(shared.length, 1, 'кнопка ничем не поделилась');
    assert.ok(/4\s200/.test(shared[0].text), 'поделились не последним забегом');
  });

  it('подписанный ник попадает в карточку', () => {
    const g = boot();
    const shared = [];
    g.sandbox.navigator.share = (d) => { shared.push(d); return Promise.resolve(); };
    finish(g, 4200);
    const nick = g.elements.get('over-nick');
    nick.value = 'Nigar';
    nick.dispatchEvent({ type: 'input', preventDefault() {} });
    g.elements.get('btn-share').click();
    assert.ok(shared[0].text.indexOf('Nigar') >= 0, 'в карточку ушёл старый ник');
  });

  it('без забега кнопка молчит и ничего не роняет', () => {
    const g = boot();
    let calls = 0;
    g.sandbox.navigator.share = () => { calls++; return Promise.resolve(); };
    g.elements.get('btn-share').click();
    assert.equal(calls, 0, 'поделились несуществующим забегом');
  });

  it('неудача честно пишется на кнопке', () => {
    const g = boot();
    finish(g, 4200);
    g.elements.get('btn-share').click();
    assert.equal(g.elements.get('btn-share').textContent, 'Не вышло',
      'кнопка должна сказать, что не получилось, а не молчать');
  });
});
