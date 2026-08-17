'use strict';
const fs = require('fs');
const path = require('path');
const { boot, markup, ROOT } = require('./harness');

describe('меню: вкладки вместо простыни', () => {
  it('справка открывается на управлении и переключается', () => {
    const g = boot();
    g.elements.get('btn-help').click();
    const pane = (k) => g.elements.get('help-' + k);
    const tab = (k) => g.elements.get('help-tab-' + k);

    assert.equal(pane('keys').classList.contains('hidden'), false, 'справка открылась не на управлении');
    assert.ok(tab('keys').classList.contains('on'), 'вкладка управления не подсвечена');
    assert.equal(pane('city').classList.contains('hidden'), true, 'вторая панель показана сразу');

    tab('city').click();
    assert.equal(pane('city').classList.contains('hidden'), false, 'вкладка «Город» не открылась');
    assert.equal(pane('keys').classList.contains('hidden'), true, 'прежняя панель не спряталась');
    assert.equal(pane('around').classList.contains('hidden'), true, 'открылись сразу две панели');
  });

  it('справка всегда возвращается на первую вкладку', () => {
    const g = boot();
    g.elements.get('btn-help').click();
    g.elements.get('help-tab-around').click();
    g.elements.get('btn-help-back').click();
    g.elements.get('btn-help').click();
    assert.equal(g.elements.get('help-keys').classList.contains('hidden'), false,
      'справка открылась там, где её закрыли в прошлый раз');
  });

  /* На телефоне список клавиш бесполезен, а без него панель управления
     оставалась пустой: игрок с телефона не узнавал про стик вообще ничего. */
  it('у телефона есть своё описание управления', () => {
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const css = fs.readFileSync(path.join(ROOT, 'styles.css'), 'utf8');
    assert.ok(/class="keys touch"/.test(html), 'нет отдельного списка управления для телефона');
    assert.ok(/class="keys desk"/.test(html), 'нет отдельного списка клавиш для десктопа');
    assert.ok(/body\.has-touch \.keys\.desk\s*\{\s*display:\s*none/.test(css),
      'на телефоне клавиатурный список не прячется');
    assert.ok(/body\.has-touch \.keys\.touch\s*\{\s*display:\s*grid/.test(css),
      'на телефоне список для тача не показывается');
    assert.ok(html.indexOf('джойстик появляется прямо под пальцем') > 0,
      'управление стиком нигде не описано');
  });
});

describe('меню: длинные списки не выдавливают кнопки', () => {
  /* Экраны с длинным содержимым — плита-колонка: уступает список, а не
     кнопки. Иначе на альбомном телефоне «Ещё раз» уезжает под фолд. */
  it('каждая плита с длинным списком объявлена колонкой', () => {
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const css = fs.readFileSync(path.join(ROOT, 'styles.css'), 'utf8');
    for (const screen of ['screen-help', 'screen-over', 'screen-scores']) {
      const at = html.indexOf('id="' + screen + '"');
      assert.ok(at > 0, `нет экрана ${screen}`);
      const plate = html.slice(at, at + 200);
      assert.ok(/class="plate[^"]*tabbed"/.test(plate), `плита ${screen} не колонка — кнопки уедут за экран`);
    }
    assert.ok(/\.plate\.tabbed\s*\{[^}]*flex-direction:\s*column/.test(css), 'колонка не описана в стилях');
    assert.ok(/\.plate\.tabbed \.board,\s*\n?\s*\.plate\.tabbed \.pane\s*\{[^}]*overflow-y:\s*auto/.test(css),
      'списку не разрешено прокручиваться самому');
  });

  it('спрятанная панель остаётся спрятанной внутри колонки', () => {
    const css = fs.readFileSync(path.join(ROOT, 'styles.css'), 'utf8');
    // правило скрытия должно быть не слабее правила раскладки
    const hide = /(^|\n)\.pane\.hidden\s*\{\s*display:\s*none/.test(css);
    assert.ok(hide, 'нет правила, прячущего панель');
    assert.ok(!/\.plate\.tabbed \.pane\s*\{[^}]*display:/.test(css),
      'раскладка задаёт display панели и перебьёт скрытие — панели покажутся все разом');
  });

  /* Слой управления лежит выше меню — иначе кнопки не видно поверх канваса.
     Пока он был виден всегда, зона стика (левые 46% экрана) перехватывала
     тапы по левой половине любого меню, включая «Ещё раз». */
  it('слой управления живёт только в игре', () => {
    const g = boot({ touch: true, width: 844, height: 390 });
    const { Game } = g.ICH;
    const inGame = () => g.sandbox.document.body.classList.contains('in-game');

    Game.toMenu();
    assert.equal(inGame(), false, 'в меню слой управления остался поверх кнопок');
    Game.start();
    assert.equal(inGame(), true, 'в игре слой управления не появился');
    Game.pause();
    assert.equal(inGame(), false, 'на паузе слой управления остался');
    Game.resume();
    assert.equal(inGame(), true, 'после паузы слой управления не вернулся');
    Game.gameOver();
    assert.equal(inGame(), false, 'на экране итога слой управления остался');

    const css = require('fs').readFileSync(require('path').join(ROOT, 'styles.css'), 'utf8');
    assert.ok(/body\.has-touch\.in-game #touch\s*\{\s*\n?\s*display:\s*block/.test(css),
      'стили показывают слой управления вне игры');
  });

  it('палец, зажатый к моменту меню, не продолжает рулить', () => {
    const g = boot({ touch: true, width: 844, height: 390 });
    const { Game, Input } = g.ICH;
    Game.start();
    const [x, y] = g.stickCenter();
    g.touch('touchstart', [[x, y]]);
    g.touch('touchmove', [[x + 40, y]]);
    assert.ok(Input.held('right'), 'стик не завёлся');
    Game.pause();
    assert.ok(!Input.held('right'), 'герой продолжает бежать за меню');
    assert.equal(Input.stick.id, null, 'стик не отпустился при открытии меню');
  });

  it('меню не залезает под вырез телефона', () => {
    const css = fs.readFileSync(path.join(ROOT, 'styles.css'), 'utf8');
    assert.ok(/\.screen\s*\{[^}]*env\(safe-area-inset-left\)/.test(css),
      'экраны не учитывают безопасную зону — на телефоне с вырезом меню обрежется');
  });
});

describe('меню: разметка и код не разъезжаются', () => {
  it('каждая вкладка, которую ждёт код, есть в разметке', () => {
    const { ids } = markup();
    for (const k of ['keys', 'city', 'around']) {
      assert.ok(ids.includes('help-tab-' + k), `нет кнопки вкладки help-tab-${k}`);
      assert.ok(ids.includes('help-' + k), `нет панели help-${k}`);
    }
    for (const p of ['over', 'scores']) {
      assert.ok(ids.includes(p + '-tab-day'), `нет вкладки «сегодня» на ${p}`);
      assert.ok(ids.includes(p + '-tab-all'), `нет вкладки «всё время» на ${p}`);
      assert.ok(ids.includes(p + '-board'), `нет таблицы на ${p}`);
    }
  });

  it('вкладки — настоящие кнопки, а не подписи', () => {
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const tabs = html.match(/<button[^>]*class="tab[^"]*"[^>]*>/g) || [];
    assert.equal(tabs.length, 7, `вкладок должно быть семь, найдено ${tabs.length}`);
    const css = fs.readFileSync(path.join(ROOT, 'styles.css'), 'utf8');
    const min = /\.tab\s*\{[^}]*min-height:\s*(\d+)px/.exec(css);
    assert.ok(min && Number(min[1]) >= 32, 'вкладка меньше пальца — на телефоне в неё не попасть');
  });
});
