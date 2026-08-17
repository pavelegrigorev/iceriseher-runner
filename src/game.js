/* İçərişəhər Runner — game state, main loop, rules and rendering order. */
(function (ICH) {
  'use strict';
  const U = ICH.U;
  const P = ICH.P;
  const C = ICH.C;
  const FX = ICH.FX;
  const Art = ICH.Art;
  const Audio = ICH.Audio;
  const Level = ICH.Level;
  const Backdrop = ICH.Backdrop;
  const Ent = ICH.Ent;
  const Boss = ICH.Boss;
  const Scores = ICH.Scores;
  const buta = (ctx, x, y, r, rot) => ICH.Art.buta(ctx, x, y, r, rot);

  /** Russian counts: 1 враг, 2 врага, 5 врагов. */
  function plural(n, one, few, many) {
    const a = Math.abs(n) % 100;
    const b = a % 10;
    if (a > 10 && a < 20) return many;
    if (b === 1) return one;
    if (b > 1 && b < 5) return few;
    return many;
  }

  /* Street furniture that belongs behind the masonry rather than in front. */
  const BEHIND = {
    rug: 1, lamp: 1, door: 1, plaque: 1, loom: 1, copper: 1,
    net: 1, drip: 1, column: 1, dish: 1,
  };

  const Game = {
    canvas: null,
    ctx: null,
    state: 'title', // title | playing | paused | dying | over
    player: null,
    projectiles: [],
    arrows: [],
    zone: null,
    banner: null,
    boss: null,
    lapsDone: 0,

    time: 0,
    camX: 0,
    camY: 0,
    pushX: 0,
    maxCamX: 0,
    dist: 0,
    score: 0,
    coins: 0,
    kills: 0,
    best: 0,
    rank: -1, // place in the record table for the run just finished, -1 if none
    health: C.MAX_HEALTH,
    ammo: 3,
    combo: 1,
    comboMax: 1,
    comboT: 0,
    comboPop: 0,
    healthPop: 0,
    pushWarn: 0,
    mutedFlash: 0,
    dyingT: 0,
    acc: 0,
    last: 0,

    /* ------------------------------------------------------------- setup */
    init() {
      this.canvas = document.getElementById('game');
      this.ctx = this.canvas.getContext('2d', { alpha: false });
      this.best = Scores.best();
      Scores.loadNick();

      FX.init();
      C.touch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0
        || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
      document.body.classList.toggle('has-touch', C.touch);
      ICH.Input.init();
      this.resize();
      window.addEventListener('resize', () => this.resize());
      window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 120));
      // any first contact is enough to let the browser start audio
      const wake = () => {
        Audio.unlock();
        if (!C.touch) { C.touch = true; document.body.classList.add('has-touch'); this.resize(); }
      };
      window.addEventListener('touchstart', wake, { once: true, passive: true });
      window.addEventListener('pointerdown', wake, { once: true });
      window.addEventListener('blur', () => {
        if (this.state === 'playing') this.pause();
      });

      this.bindUI();
      this.newRun();
      this.state = 'title';
      this.show('screen-title');

      this.last = performance.now();
      requestAnimationFrame((t) => this.loop(t));
    },

    resize() {
      const aw = window.innerWidth;
      const ah = window.innerHeight;
      // a hidden or zero-sized window would collapse the frame; keep the last one
      if (aw < 2 || ah < 2) return;
      const aspect = aw / ah;

      // Grow the logical frame along whichever axis the screen has to spare,
      // so a wide phone sees more street instead of black bars. Clamped so an
      // extreme aspect cannot zoom the world out to nothing.
      C.W = Math.round(U.clamp(C.BASE_H * aspect, C.BASE_W, 1400));
      C.H = Math.round(U.clamp(C.BASE_W / aspect, C.BASE_H, 820));

      const scale = Math.min(aw / C.W, ah / C.H);
      const cw = Math.floor(C.W * scale);
      const ch = Math.floor(C.H * scale);

      // keep the backing store within reach of a phone GPU
      let dpr = Math.min(window.devicePixelRatio || 1, 2);
      const budget = 2.6e6;
      if (cw * ch * dpr * dpr > budget) dpr = Math.sqrt(budget / (cw * ch));

      this.canvas.style.width = cw + 'px';
      this.canvas.style.height = ch + 'px';
      this.canvas.width = Math.floor(cw * dpr);
      this.canvas.height = Math.floor(ch * dpr);

      // a small screen needs a proportionally bigger HUD to stay legible
      C.HUD = ch < 420 ? 1.45 : ch < 560 ? 1.22 : 1;

      this._vig = null;

      this.portrait = C.touch && ah > aw * 1.05;
      document.body.classList.toggle('portrait', !!this.portrait);
      const rot = document.getElementById('screen-rotate');
      if (rot) rot.classList.toggle('hidden', !this.portrait);
      if (this.portrait && this.state === 'playing') this.pause(true);
    },

    /** Full screen plus a landscape lock, where the browser allows it. */
    toggleFullscreen() {
      const el = document.getElementById('app');
      if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        const req = el.requestFullscreen || el.webkitRequestFullscreen;
        if (req) {
          Promise.resolve(req.call(el)).then(() => {
            if (screen.orientation && screen.orientation.lock) {
              screen.orientation.lock('landscape').catch(() => {});
            }
          }).catch(() => {});
        }
      } else {
        const exit = document.exitFullscreen || document.webkitExitFullscreen;
        if (exit) exit.call(document);
      }
    },

    bindUI() {
      const on = (id, fn) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('click', (e) => { e.preventDefault(); Audio.unlock(); Audio.play('ui'); fn(); });
      };
      on('btn-start', () => this.start());
      on('btn-help', () => this.show('screen-help'));
      on('btn-help-back', () => this.show('screen-title'));
      on('btn-scores', () => { this.renderBoard('scores-board', -1); this.show('screen-scores'); });
      on('btn-scores-back', () => this.show('screen-title'));
      on('btn-scores-clear', () => {
        if (typeof confirm === 'function' && !confirm('Стереть таблицу рекордов?')) return;
        Scores.clear();
        this.best = 0;
        this.renderBoard('scores-board', -1);
      });
      on('btn-resume', () => this.resume());
      on('btn-retry', () => this.start());
      on('btn-retry2', () => this.start());
      on('btn-menu', () => this.toMenu());
      on('btn-menu2', () => this.toMenu());
      on('btn-pause', () => (this.state === 'playing' ? this.pause() : this.resume()));
      on('btn-mute', () => this.toggleMute());
      on('btn-full', () => this.toggleFullscreen());
      on('btn-rotate-play', () => this.toggleFullscreen());

      // The name is signed on the results screen and kept for the next run.
      // The field sits outside the table so redrawing a row cannot steal focus
      // mid-word.
      const nick = document.getElementById('over-nick');
      if (nick) {
        nick.addEventListener('input', () => {
          Scores.setNick(nick.value);
          if (this.rank >= 0) {
            Scores.rename(this.rank, nick.value);
            this.renderBoard('over-board', this.rank);
          }
        });
      }
    },

    renderBoard(id, mark) {
      const el = document.getElementById(id);
      if (!el) return;
      el.innerHTML = Scores.tableHTML(mark);
      // The table scrolls when the screen is short, and the row worth reading
      // is the one just earned. Measured in client rects, not offsetTop: the
      // offsetParent of a <tr> is its own table, so the two would be counted
      // from different origins. scrollIntoView is no good either — it drags
      // every ancestor along with it.
      const me = el.querySelector && el.querySelector('.me');
      if (me && me.getBoundingClientRect) {
        const row = me.getBoundingClientRect();
        const box = el.getBoundingClientRect();
        el.scrollTop += row.top - box.top - (box.height - row.height) / 2;
      }
    },

    show(id) {
      document.querySelectorAll('.screen').forEach((s) => {
        if (s.id !== 'screen-rotate') s.classList.toggle('hidden', s.id !== id);
      });
      document.body.classList.toggle('in-game', id === null || id === '');
    },

    hideScreens() {
      document.querySelectorAll('.screen').forEach((s) => {
        if (s.id !== 'screen-rotate') s.classList.add('hidden');
      });
    },

    /* -------------------------------------------------------------- flow */
    newRun() {
      Level.reset();
      Backdrop.reset();
      FX.reset();
      this.projectiles.length = 0;
      this.arrows.length = 0;
      this.zone = ICH.Zones[0];
      this.banner = null;
      this.boss = null;
      this.lapsDone = 0;
      this.player = Ent.Player.create();
      this.time = 0;
      this.camX = 0;
      this.camY = 0;
      this.pushX = 0;
      this.maxCamX = 0;
      this.dist = 0;
      this.score = 0;
      this.coins = 0;
      this.kills = 0;
      this.rank = -1;
      this.health = C.MAX_HEALTH;
      this.ammo = 3;
      this.combo = 1;
      this.comboMax = 1;
      this.comboT = 0;
      this.dyingT = 0;
      this.pushWarn = 0;
      Level.ensure(0, 0);
    },

    start() {
      this.newRun();
      this.state = 'playing';
      this.hideScreens();
      Audio.unlock();
      Audio.play('start');
      Audio.startMusic();
    },

    pause(silent) {
      if (this.state !== 'playing') return;
      this.state = 'paused';
      if (!silent) this.show('screen-pause');
    },

    resume() {
      if (this.state !== 'paused' || this.portrait) return;
      this.state = 'playing';
      this.hideScreens();
      this.last = performance.now();
    },

    toMenu() {
      Audio.stopMusic();
      this.newRun();
      this.state = 'title';
      this.show('screen-title');
    },

    toggleMute() {
      const m = Audio.toggleMute();
      this.mutedFlash = 1.6;
      const b = document.getElementById('btn-mute');
      if (b) b.textContent = m ? '🔇' : '🔊';
    },

    /* --------------------------------------------------------- game rules */
    addScore(n, x, y, label, color) {
      const total = Math.round(n * this.combo);
      this.score += total;
      if (label !== false) FX.text(x, y, (label || '+' + total), color || P.gold, 15);
    },

    bumpCombo(x, y) {
      this.comboT = C.COMBO_TIME;
      if (this.combo < 15) {
        this.combo++;
        if (this.combo > this.comboMax) this.comboMax = this.combo;
        this.comboPop = 1;
        if (this.combo % 5 === 0) {
          FX.text(x, y - 26, 'ƏLA! ×' + this.combo, '#fff0bd', 18);
          Audio.play('gem');
        }
      }
    },

    hurt(amount, fromX) {
      const p = this.player;
      if (p.invulT > 0 || p.dead || this.state !== 'playing') return;
      this.health -= amount;
      p.invulT = C.INVUL_TIME;
      p.hurtT = 0.4;
      const dir = Math.sign(p.x + p.w / 2 - fromX) || -1;
      p.vx = dir * 280;
      p.vy = -320;
      p.grounded = false;
      if (p.rope) { p.rope.holder = null; p.rope = null; }
      this.combo = 1;
      this.comboT = 0;
      FX.shake(9, 0.34);
      FX.flash('rgba(200,40,46,0.55)', 0.5);
      FX.burst(p.x + p.w / 2, p.y + p.h / 2, 12, { color: ['#ff8a6a', '#c8262e'], speedMax: 260, kind: 'spark' });
      Audio.play('hurt');
      if (this.health <= 0) this.die();
    },

    die() {
      const p = this.player;
      this.health = 0;
      p.dead = true;
      p.deadT = 0;
      p.vy = -520;
      p.vx = -120;
      this.state = 'dying';
      this.dyingT = 0;
      FX.shake(12, 0.5);
      FX.slowmo(0.9, 0.35);
      Audio.play('die');
      Audio.stopMusic();
    },

    /* One number is the result — metres, kills and loot are already folded into
       it. The rest is shown as a single line of detail, and the table is what
       gives the number meaning. */
    gameOver() {
      this.state = 'over';
      const run = {
        nick: Scores.loadNick(),
        score: Math.floor(this.score),
        dist: Math.floor(this.dist),
        kills: this.kills,
        coins: this.coins,
        combo: this.comboMax,
      };
      this.rank = Scores.add(run);
      this.best = Scores.best();
      // shown before it is filled: a hidden plate has no layout, and the table
      // cannot scroll to the row just earned without one
      this.show('screen-over');

      const text = (id, s) => {
        const el = document.getElementById(id);
        if (el) el.textContent = s;
      };
      text('over-score', Scores.num(run.score));
      text('over-details', [
        run.dist + ' м',
        run.kills + ' ' + plural(run.kills, 'враг', 'врага', 'врагов'),
        run.coins + ' золота',
        'комбо ×' + run.combo,
      ].join(' · '));
      text('over-place-label', this.rank === 0
        ? 'Первое место — подпишись'
        : this.rank + 1 + '-е место в таблице — подпишись');

      const place = document.getElementById('over-place');
      if (place) place.classList.toggle('hidden', this.rank < 0);
      const nick = document.getElementById('over-nick');
      // no autofocus: on a phone that throws the on-screen keyboard over a
      // fullscreen landscape game the moment you die
      if (nick) nick.value = Scores.loadNick();
      this.renderBoard('over-board', this.rank);
    },

    /** Falling into a pit costs a heart and drops you back onto the street. */
    respawn() {
      const p = this.player;
      let target = null;
      for (const pl of Level.platforms) {
        if (pl.oneWay) continue;
        if (pl.x + pl.w > this.camX + 260 && (!target || pl.x < target.x)) target = pl;
      }
      const x = target ? Math.max(target.x + 60, this.camX + 200) : this.camX + 300;
      const y = (target ? target.y : C.GROUND_Y) - 140;
      p.x = x;
      p.y = y;
      p.vx = 0;
      p.vy = 0;
      p.invulT = C.INVUL_TIME;
      p.dead = false;
      FX.burst(x + p.w / 2, y + p.h, 16, { color: ['#f6e7c4', '#f5c542'], speedMax: 220, kind: 'spark' });
    },

    /* ------------------------------------------------------------ update */
    update(dt) {
      const In = ICH.Input;
      In.pollPad();

      if (In.pressed('mute')) this.toggleMute();
      this.mutedFlash = Math.max(0, this.mutedFlash - dt);

      if (this.state === 'title') {
        // the menu stays in this state behind the help and record screens, and
        // a space bar there means "scroll", not "start"
        const front = document.getElementById('screen-title');
        const onTitle = !front || !front.classList.contains('hidden');
        if (onTitle && (In.pressed('jump') || In.pressed('confirm'))) this.start();
        this.time += dt;
        this.pushX += 46 * dt;
        this.camX = this.pushX;
        this.camY = 0;
        Level.ensure(this.camX, 0.2);
        this.updateHazards(dt);
        for (const e of Level.enemies) Ent.updateEnemy(e, dt, this);
        FX.update(dt);
        return;
      }

      if (this.state === 'paused') {
        if (In.pressed('pause')) this.resume();
        return;
      }

      if (this.state === 'over') {
        if (In.pressed('jump') || In.pressed('confirm') || In.pressed('restart')) this.start();
        this.time += dt;
        FX.update(dt);
        return;
      }

      if (this.state === 'playing') {
        if (In.pressed('pause')) { this.pause(); return; }
        if (In.pressed('restart')) { this.start(); return; }
      }

      const scale = FX.timeScale;
      const sdt = dt * scale;
      this.time += sdt;

      const p = this.player;
      const playing = this.state === 'playing';

      if (playing) {
        Audio.setIntensity(this.boss ? 1 : U.clamp(this.dist / 2200, 0, 1));
        Audio.setCombat(!!this.boss && !this.boss.dead);
      }

      Ent.Player.update(p, sdt, this);

      // the Xəzri off the Caspian shoves you around once you leave the ground
      const wind = ICH.Theme.wind;
      if (playing && wind && !p.grounded && !p.rope) p.x += wind * sdt;

      /* ---- camera: follows both ways, but the street behind eventually closes */
      this.camX = U.lerp(this.camX, p.x - C.CAM_LEAD, 1 - Math.pow(0.0001, sdt));
      this.maxCamX = Math.max(this.maxCamX, this.camX);
      this.pushX = this.maxCamX - C.BACKTRACK;
      if (this.camX < this.pushX) this.camX = this.pushX;
      const camYTarget = U.clamp(p.y + p.h - (C.H - 140), -340, C.H - 500);
      this.camY = U.lerp(this.camY, camYTarget, 1 - Math.pow(0.0025, sdt));

      // never let the runner slip off the left edge
      const leftLimit = this.camX + 14;
      if (p.x < leftLimit) {
        p.x = leftLimit;
        if (p.vx < 0) p.vx = 0;
        this.pushWarn = Math.min(1, this.pushWarn + sdt * 3);
      } else {
        this.pushWarn = Math.max(0, this.pushWarn - sdt * 2.5);
      }

      if (playing) this.dist = Math.max(this.dist, (p.x - 120) / 42);

      Level.ensure(this.camX, U.clamp(this.dist / 3000 + Level.lap * 0.45, 0, 1));
      this.updateZone(sdt);

      /* ---- world entities */
      this.updateHazards(sdt);

      for (const e of Level.enemies) {
        if (e.dead) continue;
        Ent.updateEnemy(e, sdt, this);
        if (e.y > C.DEATH_Y) e.dead = true;
      }

      this.updateBoss(sdt);

      for (const pr of this.projectiles) Ent.updateProjectile(pr, sdt);
      for (const a of this.arrows) Ent.updateArrow(a, sdt);
      this.updateCrumble(sdt);
      this.updatePigeons(sdt);

      if (playing) {
        this.collidePickups();
        this.collideEnemies();
        this.collideHazards();
        this.collideProjectiles();
        this.collideJars();
        this.collideArrows();
        this.collideBoss();
      }

      /* ---- combo decay */
      if (this.comboT > 0) {
        this.comboT -= sdt;
        if (this.comboT <= 0 && this.combo > 1) {
          this.combo = 1;
        }
      }
      this.comboPop = Math.max(0, this.comboPop - sdt * 3);
      this.healthPop = Math.max(0, this.healthPop - sdt * 3);

      /* ---- distance score */
      if (playing) this.score += sdt * 8;

      /* ---- falling out of the world */
      if (p.y > C.DEATH_Y && !p.dead) {
        this.health--;
        this.healthPop = 1;
        FX.flash('rgba(200,40,46,0.5)', 0.45);
        Audio.play('hurt');
        this.combo = 1;
        if (this.health <= 0) this.die();
        else this.respawn();
      }

      /* ---- death sequence */
      if (this.state === 'dying') {
        this.dyingT += dt;
        if (this.dyingT > 1.5) this.gameOver();
      }

      FX.update(sdt);

      // cull
      for (let i = this.projectiles.length - 1; i >= 0; i--) {
        if (this.projectiles[i].dead || this.projectiles[i].x < this.camX - 200) this.projectiles.splice(i, 1);
      }
      for (let i = this.arrows.length - 1; i >= 0; i--) {
        const a = this.arrows[i];
        if (a.dead || a.x < this.camX - 200 || a.x > this.camX + C.W + 300) this.arrows.splice(i, 1);
      }
      for (let i = Level.enemies.length - 1; i >= 0; i--) if (Level.enemies[i].dead) Level.enemies.splice(i, 1);
      for (let i = Level.pickups.length - 1; i >= 0; i--) if (Level.pickups[i].dead) Level.pickups.splice(i, 1);
      for (let i = Level.jars.length - 1; i >= 0; i--) if (Level.jars[i].dead) Level.jars.splice(i, 1);
      for (let i = Level.hazards.length - 1; i >= 0; i--) if (Level.hazards[i].expired) Level.hazards.splice(i, 1);
    },

    /** Which district is on screen; drives the palette, music and the banner. */
    updateZone(dt) {
      const z = Level.zoneAt(this.camX + 420);
      if (z !== this.zone) {
        this.zone = z;
        ICH.Theme.setTarget(z);
        Audio.setMode(z.music);
        this.banner = { name: z.name, ru: z.ru, t: 0 };
      }
      ICH.Theme.update(dt);
      if (this.banner) {
        this.banner.t += dt;
        if (this.banner.t > (this.banner.boss ? 5 : 4)) this.banner = null;
      }
      // visible wind: grit streaking across the screen
      const wind = ICH.Theme.wind;
      if (wind && Math.random() < 0.35) {
        FX.spawn({
          x: this.camX + (wind > 0 ? -20 : C.W + 20), y: this.camY + U.rnd(40, C.H),
          vx: wind * U.rnd(5, 9), vy: U.rnd(-14, 26),
          life: U.rnd(0.8, 1.5), size: U.rnd(1.5, 3.2), g: 12, drag: 1,
          color: 'rgba(246,232,200,0.5)', kind: 'spark',
        });
      }
    },

    drawBanner(ctx) {
      const b = this.banner;
      if (!b) return;
      const k = b.t < 0.5 ? U.ease.outCubic(b.t / 0.5)
        : b.t > 3.4 ? 1 - (b.t - 3.4) / 0.6 : 1;
      const a = U.clamp(k, 0, 1);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(C.W / 2, 118 - (1 - a) * 14);
      ctx.textAlign = 'center';

      const w = 340;
      ctx.fillStyle = 'rgba(46,26,8,0.5)';
      Art.roundRect(ctx, -w / 2, -34, w, 62, 10);
      ctx.fill();
      ctx.strokeStyle = 'rgba(245,197,66,0.4)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = P.gold;
      buta(ctx, -w / 2 + 22, -3, 8, -0.4); ctx.fill();
      buta(ctx, w / 2 - 22, -3, 8, 0.4); ctx.fill();

      ctx.font = '700 22px "Trebuchet MS", system-ui, sans-serif';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(46,26,8,0.7)';
      ctx.strokeText(b.name, 0, -6);
      ctx.fillStyle = P.gold;
      ctx.fillText(b.name, 0, -6);
      ctx.font = '600 13px "Trebuchet MS", system-ui, sans-serif';
      ctx.fillStyle = 'rgba(251,238,203,0.8)';
      ctx.fillText(b.ru, 0, 15);
      ctx.restore();
      ctx.textAlign = 'left';
    },

    updateHazards(dt) {
      const p = this.player;
      for (const hz of Level.hazards) {
        switch (hz.type) {
          case 'brazier': {
            hz.timer -= dt;
            if (hz.timer <= 0) {
              hz.on = !hz.on;
              hz.timer = hz.on ? 1.9 : 1.3;
            }
            hz.flame = U.approach(hz.flame, hz.on ? 1 : 0, dt * 2.4);
            if (hz.flame > 0.5 && Math.random() < 0.5) {
              FX.spawn({
                x: hz.x + hz.w / 2 + U.rnd(-8, 8), y: hz.y + 2,
                vx: U.rnd(-16, 16), vy: U.rnd(-90, -40),
                life: U.rnd(0.35, 0.7), size: U.rnd(2, 4.5), g: -60, drag: 0.94,
                color: U.pick(['#ffb03a', '#ff7a2a', '#ffe6a0']),
              });
            }
            break;
          }
          case 'censer': {
            // free pendulum, kept alive by a touch of drive so it never stalls
            hz.omega += -(2100 / hz.len) * Math.sin(hz.angle) * dt;
            hz.omega *= Math.pow(0.9995, dt * 60);
            if (Math.abs(hz.omega) < 0.25 && Math.abs(hz.angle) < 0.1) hz.omega += 0.5;
            hz.angle += hz.omega * dt;
            break;
          }
          case 'faller': {
            if (hz.state === 'idle') {
              const px = p.x + p.w / 2;
              if (px > hz.x - 30 && px < hz.x + hz.w + 30 && p.y > hz.y) {
                hz.state = 'shake';
                hz.t = 0.45;
              }
            } else if (hz.state === 'shake') {
              hz.t -= dt;
              if (hz.t <= 0) { hz.state = 'fall'; hz.vy = 0; }
            } else if (hz.state === 'fall') {
              hz.vy = Math.min(hz.vy + 2400 * dt, 1400);
              hz.y += hz.vy * dt;
              if (hz.y + hz.h >= C.GROUND_Y) {
                hz.y = C.GROUND_Y - hz.h;
                hz.state = 'fallen';
                FX.shake(7, 0.3);
                Audio.play('slam');
                FX.burst(hz.x + hz.w / 2, hz.y + hz.h, 16, {
                  color: ['#d0ac72', '#a8854f'], speedMax: 240, kind: 'shard', sizeMax: 6,
                });
              }
            }
            break;
          }
          case 'pillar': {
            if (hz.warn > 0) {
              hz.warn -= dt;
              if (hz.warn <= 0) {
                hz.live = 0.85;
                Audio.play('slam');
                FX.shake(3, 0.18);
              }
            } else if (hz.live > 0) {
              hz.live -= dt;
              if (hz.live <= 0) hz.expired = true;
              for (let i = 0; i < 2; i++) {
                FX.spawn({
                  x: hz.x + U.rnd(0, hz.w), y: C.GROUND_Y - U.rnd(0, 30),
                  vx: U.rnd(-40, 40), vy: U.rnd(-320, -140),
                  life: U.rnd(0.4, 0.8), size: U.rnd(3, 8), g: -60, drag: 0.95,
                  color: U.pick(['#ff9d21', '#e0400f', '#fff0b0']),
                });
              }
            }
            break;
          }
          case 'steam': {
            if (hz.temp !== undefined) {
              hz.temp -= dt;
              if (hz.temp <= 0) hz.expired = true;
            }
            hz.timer -= dt;
            if (hz.timer <= 0) {
              hz.on = !hz.on;
              hz.timer = hz.on ? 1.1 : 1.6;
            }
            hz.power = U.approach(hz.power, hz.on ? 1 : 0, dt * 3);
            break;
          }
        }
      }
    },

    /** Arena trigger, the fight itself, and opening the gate afterwards. */
    updateBoss(dt) {
      const p = this.player;

      if (!this.boss) {
        for (const spec of Level.bosses) {
          if (spec.triggered || spec.done) continue;
          if (p.x + p.w / 2 < spec.arena.x0 + 150) continue;
          spec.triggered = true;
          Level.platforms.push(spec.gate);
          this.boss = Boss.create(spec);
          this.banner = { name: this.boss.name, ru: this.boss.ru, t: 0, boss: true };
          Audio.play('roar');
          Audio.setIntensity(1);
          FX.shake(8, 0.6);
          FX.flash('rgba(255,180,90,0.25)', 0.3);
          break;
        }
        return;
      }

      const b = this.boss;
      Boss.update(b, dt, this);

      if (b.dead && b.deadT > 1.4) {
        // the gate swings open and the road out of the district is clear
        const i = Level.platforms.indexOf(b.spec.gate);
        if (i >= 0) Level.platforms.splice(i, 1);
        b.spec.done = true;
        this.boss = null;
        FX.burst(b.spec.gate.x + 22, C.GROUND_Y - 120, 26, {
          color: ['#f7e2b3', '#d0ac72'], speedMax: 300, kind: 'shard', sizeMax: 7,
        });
        FX.text(b.spec.gate.x, C.GROUND_Y - 160, 'yol açıqdır!', '#fff0bd', 20);
        Audio.play('gate');
        Audio.play(b.final ? 'levelup' : 'fanfare');
        if (b.final) {
          this.health = C.MAX_HEALTH;
          this.ammo = C.MAX_AMMO;
          this.healthPop = 1;
          this.lapsDone++;
          this.banner = {
            name: 'DÖVRƏ ' + (this.lapsDone + 1),
            ru: 'Круг ' + (this.lapsDone + 1) + ' — город стал злее',
            t: 0, boss: true,
          };
          FX.flash('rgba(255,220,150,0.5)', 0.6);
        }
      }
    },

    /** Loose roof tiles: they hold for half a second, then drop away. */
    updateCrumble(dt) {
      const p = this.player;
      for (let i = Level.platforms.length - 1; i >= 0; i--) {
        const pl = Level.platforms[i];
        if (pl.kind !== 'crumble') continue;
        const standing = p.grounded && p.y + p.h >= pl.y - 2 && p.y + p.h <= pl.y + 10
          && p.x + p.w > pl.x && p.x < pl.x + pl.w;
        if (standing && pl.crumbleT < 0) pl.crumbleT = 0.55;
        if (pl.crumbleT >= 0) {
          pl.crumbleT -= dt;
          if (Math.random() < 0.4) {
            FX.spawn({
              x: pl.x + U.rnd(0, pl.w), y: pl.y + 16, vx: U.rnd(-20, 20), vy: U.rnd(10, 60),
              life: 0.5, size: U.rnd(2, 4), color: '#8e4622', kind: 'shard',
            });
          }
          if (pl.crumbleT <= 0) {
            FX.burst(pl.x + pl.w / 2, pl.y + 8, 14, {
              color: ['#c96a3c', '#8e4622'], speedMax: 200, kind: 'shard', sizeMax: 6, g: 1200,
            });
            Audio.play('break');
            Level.platforms.splice(i, 1);
          }
        }
      }
    },

    /** Pigeons scatter when you run through the flock. */
    updatePigeons(dt) {
      const p = this.player;
      const px = p.x + p.w / 2;
      for (const d of Level.decos) {
        if (d.type !== 'pigeons') continue;
        const near = Math.abs(px - d.x) < 70 && Math.abs(p.y + p.h - d.y) < 90;
        if (near && d.scared <= 0) {
          d.scared = 3;
          for (const b of d.birds) {
            b.fly = 1;
            b.vx = U.rnd(-10, 40) + (px < d.x ? 30 : -30);
            b.vy = U.rnd(-10, 0);
          }
          Audio.play('wings');
        }
        if (d.scared > 0) {
          d.scared -= dt;
          for (const b of d.birds) {
            b.vx += (b.vx > 0 ? 60 : -60) * dt;
            b.vy -= 120 * dt;
            if (d.scared < 1.4) b.fly = Math.max(0, b.fly - dt);
          }
        } else {
          for (const b of d.birds) {
            b.vx = U.approach(b.vx, 0, 40 * dt);
            b.vy = U.approach(b.vy, 0, 90 * dt);
            b.fly = 0;
          }
        }
      }
    },

    /* -------------------------------------------------------- collisions */
    collidePickups() {
      const p = this.player;
      const magnet = p.carpetT > 0;
      const pcx = p.x + p.w / 2;
      const pcy = p.y + p.h / 2;

      for (const it of Level.pickups) {
        if (it.dead) continue;
        const cx = it.x + it.w / 2;
        const cy = it.y + it.h / 2;

        if (magnet) {
          const d = U.dist(pcx, pcy, cx, cy);
          if (d < 190) {
            const s = (1 - d / 190) * 620;
            it.x += ((pcx - cx) / d) * s * 0.016;
            it.y += ((pcy - cy) / d) * s * 0.016;
          }
        }

        if (!U.rectHit(p.x, p.y, p.w, p.h, it.x, it.y, it.w, it.h)) continue;
        it.dead = true;

        switch (it.type) {
          case 'coin':
            this.coins++;
            this.addScore(10, cx, cy - 8, false);
            this.comboT = Math.max(this.comboT, 1.4);
            Audio.play('coin');
            FX.burst(cx, cy, 5, { color: ['#f5c542', '#fff0bd'], speedMax: 130, lifeMax: 0.35, sizeMax: 3, g: 500 });
            break;
          case 'gem':
            this.addScore(200, cx, cy - 10, '+' + 200 * this.combo, '#9beefc');
            Audio.play('gem');
            FX.burst(cx, cy, 16, { color: ['#48d2e8', '#c8f6ff'], speedMax: 240, kind: 'star', sizeMax: 5 });
            FX.flash('rgba(120,220,240,0.25)', 0.28);
            this.bumpCombo(cx, cy);
            break;
          case 'nar':
            this.ammo = Math.min(C.MAX_AMMO, this.ammo + 2);
            FX.text(cx, cy - 10, 'nar +2', '#ff9a94', 14);
            Audio.play('sweet');
            break;
          case 'tea':
            if (this.health < C.MAX_HEALTH) {
              this.health++;
              this.healthPop = 1;
              FX.text(cx, cy - 10, 'çay +1', '#ffd9a0', 15);
            } else {
              this.addScore(120, cx, cy - 10, '+' + 120 * this.combo, '#ffd9a0');
            }
            Audio.play('heal');
            FX.burst(cx, cy, 12, { color: ['#ffd9a0', '#fff'], speedMax: 180, lifeMax: 0.6 });
            break;
          case 'carpet':
            this.player.carpetT = 10;
            FX.text(cx, cy - 14, 'SEHRLİ XALÇA!', '#f5c542', 18);
            Audio.play('power');
            FX.flash('rgba(245,197,66,0.3)', 0.4);
            FX.burst(cx, cy, 22, { color: ['#a02b2e', '#e0a83c', '#1f6079'], speedMax: 280, kind: 'shard', sizeMax: 7 });
            break;
        }
      }
    },

    killEnemy(e, x, y, viaStomp) {
      e.dead = true;
      this.kills++;
      this.bumpCombo(x, y);
      this.addScore(e.score, x, y - 16, null, '#ffd06a');
      Audio.play('kill');
      FX.shake(viaStomp ? 3 : 5, 0.2);
      FX.burst(x, y, 16, {
        color: e.kind === 'crow' ? ['#2b2b36', '#5a5a6a', '#e0a23c']
          : e.kind === 'snake' ? ['#6fa84a', '#42702a']
            : ['#2f5d4a', '#d9d2c0', '#dfe7ef'],
        speedMax: 260, kind: 'shard', sizeMax: 6, lifeMax: 0.7,
      });
      FX.spawn({ x, y, life: 0.3, size: 8, g: 0, color: 'rgba(255,240,200,0.9)', kind: 'ring' });
    },

    damageEnemy(e, dmg, x, y, viaStomp) {
      e.hp -= dmg;
      if (e.hp <= 0) {
        this.killEnemy(e, x, y, viaStomp);
      } else {
        e.hurtT = 0.28;
        e.cool = Math.max(e.cool, 0.5);
        e.state = 'walk';
        Audio.play('kill');
        FX.burst(x, y, 8, { color: ['#fff0bd', '#f5c542'], speedMax: 180, kind: 'spark' });
      }
    },

    collideEnemies() {
      const p = this.player;
      const box = Ent.Player.slashBox(p);

      for (const e of Level.enemies) {
        if (e.dead) continue;
        const ex = e.x + e.w / 2;
        const ey = e.y + e.h / 2;

        // sword
        if (box && e._hitBy !== p.slashId && U.rectHit(box.x, box.y, box.w, box.h, e.x, e.y, e.w, e.h)) {
          e._hitBy = p.slashId;
          this.damageEnemy(e, 1, ex, ey, false);
          continue;
        }

        // stomp
        if (p.vy > 60 && p.prevBottom <= e.y + 12 && U.rectHit(p.x, p.y, p.w, p.h, e.x, e.y, e.w, e.h)) {
          p.vy = ICH.Input.held('jump') ? -640 : -470;
          p.jumps = 1;
          this.damageEnemy(e, Ent.stompDamage(e), ex, e.y, true);
          Audio.play('bounce');
          continue;
        }

        // guard's scimitar
        const ab = Ent.enemyAttackBox(e);
        if (ab && U.rectHit(p.x, p.y, p.w, p.h, ab.x, ab.y, ab.w, ab.h)) {
          this.hurt(1, ex);
          continue;
        }

        // body contact
        if (U.rectHit(p.x + 3, p.y + 3, p.w - 6, p.h - 6, e.x, e.y, e.w, e.h)) {
          this.hurt(1, ex);
        }
      }
    },

    collideHazards() {
      const p = this.player;
      const bx = p.x + 4, by = p.y + 4, bw = p.w - 8, bh = p.h - 4;
      for (const hz of Level.hazards) {
        switch (hz.type) {
          case 'spikes':
            if (U.rectHit(bx, by, bw, bh, hz.x, hz.y + 4, hz.w, hz.h - 4)) this.hurt(1, hz.x + hz.w / 2);
            break;
          case 'brazier': {
            if (hz.flame <= 0.45) break;
            const fh = 46 * hz.flame;
            if (U.rectHit(bx, by, bw, bh, hz.x + hz.w / 2 - 13, hz.y + 6 - fh, 26, fh + 10)) {
              this.hurt(1, hz.x + hz.w / 2);
            }
            break;
          }
          case 'censer': {
            const ex = hz.x + Math.sin(hz.angle) * hz.len;
            const ey = hz.y + Math.cos(hz.angle) * hz.len;
            if (U.rectHit(bx, by, bw, bh, ex - 13, ey - 4, 26, 22)) this.hurt(1, ex);
            break;
          }
          case 'faller':
            if (hz.state === 'fall' && U.rectHit(bx, by, bw, bh, hz.x, hz.y, hz.w, hz.h)) {
              this.hurt(1, hz.x + hz.w / 2);
            }
            break;
          case 'pillar':
            if (hz.live > 0 && U.rectHit(bx, by, bw, bh, hz.x + 6, C.GROUND_Y - hz.h, hz.w - 12, hz.h)) {
              this.hurt(1, hz.x + hz.w / 2);
            }
            break;
          case 'steam': {
            if (hz.power < 0.5) break;
            const jet = 150 * hz.power;
            if (U.rectHit(bx, by, bw, bh, hz.x, hz.y - jet, hz.w, jet)) {
              // not a hazard at all — the vent throws you up to the next ledge
              p.vy = Math.min(p.vy, -640);
              p.jumps = 1;
              p.grounded = false;
              if (Math.random() < 0.3) FX.text(p.x + p.w / 2, p.y - 8, 'buğ!', '#dff4f4', 12);
            }
            break;
          }
        }
      }
    },

    collideBoss() {
      const b = this.boss;
      if (!b || b.dead) return;
      const p = this.player;

      // your sabre
      const box = Ent.Player.slashBox(p);
      const hit = Boss.hitBox(b);
      if (hit && box && b.hitId !== p.slashId && U.rectHit(box.x, box.y, box.w, box.h, hit.x, hit.y, hit.w, hit.h)) {
        b.hitId = p.slashId;
        if (Boss.damage(b, 1, this, p.x + p.w / 2)) this.bumpCombo(b.x + b.w / 2, b.y);
      }

      // pomegranates hit harder, and are the only way to reach a flier
      if (hit) {
        for (const pr of this.projectiles) {
          if (pr.dead) continue;
          if (U.rectHit(pr.x - pr.r, pr.y - pr.r, pr.r * 2, pr.r * 2, hit.x, hit.y, hit.w, hit.h)) {
            pr.dead = true;
            Ent.splash(pr.x, pr.y);
            if (Boss.damage(b, 2, this, pr.x)) this.bumpCombo(b.x + b.w / 2, b.y);
          }
        }
      }

      // stomping the ones you can stomp
      if (hit && b.stompable && p.vy > 60 && p.prevBottom <= b.y + 18
        && U.rectHit(p.x, p.y, p.w, p.h, b.x, b.y, b.w, b.h)) {
        p.vy = ICH.Input.held('jump') ? -660 : -480;
        p.jumps = 1;
        Audio.play('bounce');
        Boss.damage(b, 1, this, p.x + p.w / 2);
        return;
      }

      // his attacks, then plain contact
      for (const ab of Boss.attackBoxes(b)) {
        if (U.rectHit(p.x + 3, p.y + 3, p.w - 6, p.h - 6, ab.x, ab.y, ab.w, ab.h)) {
          this.hurt(1, b.x + b.w / 2);
          return;
        }
      }
      if (b.state !== 'under' && U.rectHit(p.x + 5, p.y + 5, p.w - 10, p.h - 10, b.x + 6, b.y + 6, b.w - 12, b.h - 12)) {
        this.hurt(1, b.x + b.w / 2);
      }
    },

    collideArrows() {
      const p = this.player;
      for (const a of this.arrows) {
        if (a.dead) continue;
        if (U.rectHit(p.x + 3, p.y + 3, p.w - 6, p.h - 6, a.x - 5, a.y - 4, 12, 8)) {
          a.dead = true;
          this.hurt(1, a.x);
        }
        // a well-timed swing bats the arrow out of the air
        const box = Ent.Player.slashBox(p);
        if (box && U.rectHit(box.x, box.y, box.w, box.h, a.x - 6, a.y - 5, 14, 10)) {
          a.dead = true;
          this.addScore(25, a.x, a.y - 10, null, '#dfe7ef');
          Audio.play('kill');
          FX.burst(a.x, a.y, 8, { color: ['#eef4f9', '#c9b68d'], speedMax: 200, kind: 'spark' });
        }
      }
    },

    collideProjectiles() {
      for (const pr of this.projectiles) {
        if (pr.dead) continue;
        for (const e of Level.enemies) {
          if (e.dead) continue;
          if (U.rectHit(pr.x - pr.r, pr.y - pr.r, pr.r * 2, pr.r * 2, e.x, e.y, e.w, e.h)) {
            pr.dead = true;
            Ent.splash(pr.x, pr.y);
            this.damageEnemy(e, e.elite ? 2 : 99, e.x + e.w / 2, e.y + e.h / 2, false);
            break;
          }
        }
      }
    },

    collideJars() {
      const p = this.player;
      const box = Ent.Player.slashBox(p);
      for (const j of Level.jars) {
        if (j.dead) continue;
        const hitBySword = box && U.rectHit(box.x, box.y, box.w, box.h, j.x, j.y, j.w, j.h);
        let hitByShot = false;
        for (const pr of this.projectiles) {
          if (!pr.dead && U.rectHit(pr.x - 8, pr.y - 8, 16, 16, j.x, j.y, j.w, j.h)) {
            hitByShot = true; pr.dead = true; Ent.splash(pr.x, pr.y);
          }
        }
        const stomped = p.vy > 60 && U.rectHit(p.x, p.y, p.w, p.h, j.x, j.y, j.w, j.h);
        if (!hitBySword && !hitByShot && !stomped) continue;

        j.dead = true;
        if (stomped) { p.vy = -420; p.jumps = 1; }
        Audio.play('break');
        FX.shake(3, 0.16);
        FX.burst(j.x + j.w / 2, j.y + j.h / 2, 16, {
          color: ['#a86a3c', '#c98a52', '#7c4a24'], speedMax: 260, kind: 'shard', sizeMax: 7,
        });
        const n = U.rndInt(2, 4);
        for (let i = 0; i < n; i++) {
          Level.pickups.push(Ent.pickup('coin', j.x + j.w / 2 + U.rnd(-16, 16), j.y - U.rnd(6, 30)));
        }
        if (U.chance(0.22)) Level.pickups.push(Ent.pickup('nar', j.x + j.w / 2, j.y - 34));
      }
    },

    /* -------------------------------------------------------------- draw */
    draw() {
      const ctx = this.ctx;
      const cv = this.canvas;
      ctx.setTransform(cv.width / C.W, 0, 0, cv.height / C.H, 0, 0);
      ctx.imageSmoothingEnabled = true;

      const [shx, shy] = FX.shakeOffset();
      const camX = this.camX;
      const camY = this.camY;
      const t = this.time;

      Backdrop.draw(ctx, camX + shx * 0.4, camY, t);

      ctx.save();
      ctx.translate(-Math.round(camX) + shx, -Math.round(camY) + shy);

      // wall-mounted decor sits behind the masonry
      for (const d of Level.decos) {
        if (BEHIND[d.type]) Art.drawDeco(ctx, d, t);
      }

      // everything below street level is a dark void, so gaps read as gaps
      ctx.fillStyle = 'rgba(44,25,9,0.82)';
      ctx.fillRect(camX - 40, C.GROUND_Y + 10, C.W + 80, 700);

      for (const pl of Level.platforms) {
        if (pl.x + pl.w < camX - 60 || pl.x > camX + C.W + 60) continue;
        Art.drawPlatform(ctx, pl, t);
      }

      for (const d of Level.decos) {
        if (!BEHIND[d.type]) Art.drawDeco(ctx, d, t);
      }

      for (const hz of Level.hazards) {
        if (hz.x + hz.w < camX - 60 || hz.x > camX + C.W + 60) continue;
        switch (hz.type) {
          case 'spikes': Art.drawSpikes(ctx, hz, t); break;
          case 'pillar': Art.drawPillar(ctx, hz, t); break;
          case 'censer': Art.drawCenser(ctx, hz, t); break;
          case 'faller': Art.drawFaller(ctx, hz, t); break;
          case 'steam': Art.drawSteam(ctx, hz, t); break;
          default: Art.drawBrazier(ctx, hz, t);
        }
      }

      for (const j of Level.jars) if (!j.dead) Art.drawJar(ctx, j, t);
      for (const r of Level.ropes) Art.drawRope(ctx, r, t);
      for (const it of Level.pickups) if (!it.dead) Art.drawPickup(ctx, it, t);

      for (const e of Level.enemies) {
        if (e.dead) continue;
        if (e.x + e.w < camX - 80 || e.x > camX + C.W + 80) continue;
        switch (e.kind) {
          case 'guard': Art.drawGuard(ctx, e, t); break;
          case 'snake': Art.drawSnake(ctx, e, t); break;
          case 'dog': Art.drawDog(ctx, e, t); break;
          case 'scorpion': Art.drawScorpion(ctx, e, t); break;
          case 'archer': Art.drawArcher(ctx, e, t); break;
          case 'bat': Art.drawBat(ctx, e, t); break;
          case 'thug': Art.drawThug(ctx, e, t); break;
          case 'roller': Art.drawRoller(ctx, e, t); break;
          default: Art.drawCrow(ctx, e, t);
        }
      }

      if (this.boss) Boss.draw(ctx, this.boss, t);

      for (const pr of this.projectiles) Art.drawProjectile(ctx, pr);
      for (const a of this.arrows) Art.drawArrow(ctx, a);

      if (this.state !== 'title') Art.drawPlayer(ctx, this.player, t);

      FX.draw(ctx);
      ctx.restore();

      Backdrop.drawFront(ctx, camX, t);
      this.vignette(ctx);

      if (this.state === 'playing' || this.state === 'dying' || this.state === 'paused') {
        ICH.HUD.draw(ctx, this);
        this.drawBanner(ctx);
      }
      FX.drawOverlay(ctx);

      if (this.state === 'title') {
        ctx.fillStyle = 'rgba(40,24,8,0.22)';
        ctx.fillRect(0, 0, C.W, C.H);
      }
    },

    vignette(ctx) {
      if (!this._vig) {
        const g = ctx.createRadialGradient(C.W / 2, C.H / 2, C.H * 0.42, C.W / 2, C.H / 2, C.H * 0.95);
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(1, 'rgba(58,32,10,0.34)');
        this._vig = g;
      }
      ctx.fillStyle = this._vig;
      ctx.fillRect(0, 0, C.W, C.H);
    },

    /* -------------------------------------------------------------- loop */
    loop(ts) {
      requestAnimationFrame((n) => this.loop(n));
      let dt = (ts - this.last) / 1000;
      this.last = ts;
      if (!isFinite(dt) || dt < 0) dt = 0;
      dt = Math.min(dt, 1 / 30);

      this.update(dt);
      ICH.Input.endFrame();
      this.draw();
    },
  };

  ICH.Game = Game;
  window.addEventListener('DOMContentLoaded', () => Game.init());
})(window.ICH);
