/* İçərişəhər Runner — sharing a finished run.

   The game has no server, so a shared run cannot be a link to a scoreboard.
   What it can be is a picture: the card is drawn here on an offscreen canvas
   and handed to the OS share sheet, which on a phone is the one place people
   actually pass things around. Everything degrades — share sheet, then the
   clipboard, then nothing — because none of these APIs exist everywhere.

   Nothing is ever sent anywhere by itself: the share sheet is opened by the
   player's tap and they choose where it goes. */
(function (ICH) {
  'use strict';
  const U = ICH.U;
  const P = ICH.P;

  const HOME = 'https://pavelegrigorev.github.io/iceriseher-runner/';
  const SIZE = 1080;
  const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

  /** Where to send people. On a page served over http this is the page itself,
      so a copy hosted anywhere points at itself rather than at the original. */
  function link() {
    if (typeof location === 'object' && /^https?:$/.test(location.protocol || '')) {
      return location.origin + location.pathname;
    }
    return HOME;
  }

  function dayLabel(day) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(day || ''));
    if (!m) return '';
    return Number(m[3]) + ' ' + (MONTHS[Number(m[2]) - 1] || '');
  }

  function text(run) {
    const S = ICH.Scores;
    const who = run.nick ? run.nick + ' — ' : '';
    return who + 'İçərişəhər Runner: ' + S.num(run.score) + ' очков, '
      + S.num(run.dist) + ' м'
      + (run.combo > 1 ? ', комбо ×' + run.combo : '') + '.\n'
      + 'Город меняется каждый день и у всех одинаковый. Обгони: ' + link();
  }

  /** A square card, which is the shape chats and stories treat kindly. */
  function card(run) {
    let cv = null;
    try { cv = document.createElement('canvas'); } catch (e) { return null; }
    if (!cv || typeof cv.getContext !== 'function') return null;
    cv.width = SIZE;
    cv.height = SIZE;
    const ctx = cv.getContext('2d');
    if (!ctx || typeof ctx.createLinearGradient !== 'function') return null;
    const S = ICH.Scores;
    const font = (w, px) => { ctx.font = w + ' ' + px + 'px "Trebuchet MS", system-ui, sans-serif'; };

    /* Two halves. The top is the postcard: sand sky and a crenellated skyline,
       with the title in dark stone because gold on sand cannot be read. Every
       number lives in the dark half below, which is the only place light text
       is legible — a shared card is looked at for about a second. */
    const HORIZON = 600;

    // an opaque base first: the panel below fades in from nothing, and without
    // this the card ships with transparent pixels that show whatever is behind
    // it in a chat
    ctx.fillStyle = '#170d05';
    ctx.fillRect(0, 0, SIZE, SIZE);

    const sky = ctx.createLinearGradient(0, 0, 0, HORIZON);
    sky.addColorStop(0, '#f6dcaa');
    sky.addColorStop(1, '#d59657');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, SIZE, HORIZON);

    // the same shape language as the game's backdrop, seeded off the run's day
    // so the card carries that day's city rather than a generic one
    const salt = U.daySeed(run.day || '');
    ctx.fillStyle = 'rgba(74, 46, 20, 0.5)';
    let x = -40;
    let i = 0;
    while (x < SIZE + 40) {
      const w = 78 + (U.hash(salt + i, 3) % 96);
      const h = 130 + (U.hash(salt + i, 9) % 190);
      ctx.fillRect(x, HORIZON - h, w, h);
      for (let k = 0; k * 36 < w - 16; k++) {
        ctx.fillRect(x + k * 36, HORIZON - h - 20, 22, 22);
      }
      x += w + 14 + (U.hash(salt + i, 5) % 28);
      i++;
    }

    const panel = ctx.createLinearGradient(0, HORIZON - 150, 0, SIZE);
    panel.addColorStop(0, 'rgba(24, 14, 6, 0)');
    panel.addColorStop(0.34, 'rgba(24, 14, 6, 0.93)');
    panel.addColorStop(1, '#170d05');
    ctx.fillStyle = panel;
    ctx.fillRect(0, HORIZON - 150, SIZE, SIZE - HORIZON + 150);

    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(88, 55, 22, 0.9)';
    font('700', 52);
    ctx.fillText('۞', SIZE / 2, 118);
    font('700', 62);
    ctx.fillText('İÇƏRİŞƏHƏR RUNNER', SIZE / 2, 196);

    const grad = ctx.createLinearGradient(0, 640, 0, 790);
    grad.addColorStop(0, '#fff3cf');
    grad.addColorStop(1, '#e09a1e');
    ctx.fillStyle = grad;
    font('800', 158);
    ctx.fillText(S.num(run.score), SIZE / 2, 790);
    ctx.fillStyle = 'rgba(246,231,196,0.78)';
    font('600', 38);
    ctx.fillText('очков', SIZE / 2, 846);

    if (run.nick) {
      ctx.fillStyle = P.gold;
      font('700', 50);
      ctx.fillText(run.nick, SIZE / 2, 918);
    }

    font('600', 34);
    ctx.fillStyle = 'rgba(246,231,196,0.88)';
    const bits = [S.num(run.dist) + ' м', run.kills + ' побеждено', 'комбо ×' + run.combo];
    ctx.fillText(bits.join('   ·   '), SIZE / 2, run.nick ? 976 : 940);

    const day = dayLabel(run.day);
    ctx.fillStyle = 'rgba(246,231,196,0.5)';
    font('600', 28);
    ctx.fillText(day ? 'город за ' + day : 'город дня', SIZE / 2, 1026);
    ctx.fillStyle = 'rgba(246,231,196,0.38)';
    ctx.fillText(link().replace(/^https?:\/\//, '').replace(/\/$/, ''), SIZE / 2, 1062);

    return cv;
  }

  /** Hand the run to whatever this device can do with it. Calls back with
      'shared' | 'copied' | 'cancel' | 'failed' so the button can say so. */
  function run(entry, done) {
    const finish = (how) => { if (done) done(how); };
    const msg = text(entry);
    const nav = typeof navigator === 'object' ? navigator : null;
    if (!nav) return finish('failed');

    const plain = () => {
      if (nav.share) {
        Promise.resolve(nav.share({ text: msg }))
          .then(() => finish('shared'), () => finish('cancel'));
      } else if (nav.clipboard && nav.clipboard.writeText) {
        Promise.resolve(nav.clipboard.writeText(msg))
          .then(() => finish('copied'), () => finish('failed'));
      } else {
        finish('failed');
      }
    };

    const cv = card(entry);
    if (!cv || !cv.toBlob || !nav.share || !nav.canShare) return plain();

    let handed = false;
    // toBlob is async and a browser that quietly never calls back would leave
    // the button stuck on "…", so the plain path takes over after a moment
    const guard = setTimeout(() => { if (!handed) { handed = true; plain(); } }, 1200);
    cv.toBlob((blob) => {
      if (handed) return;
      handed = true;
      clearTimeout(guard);
      let file = null;
      try { file = new File([blob], 'icherisheher.png', { type: 'image/png' }); } catch (e) { file = null; }
      if (!file || !nav.canShare({ files: [file] })) return plain();
      Promise.resolve(nav.share({ files: [file], text: msg }))
        .then(() => finish('shared'), () => finish('cancel'));
    }, 'image/png');
  }

  ICH.Share = { run, text, card, link, dayLabel };
})(window.ICH);
