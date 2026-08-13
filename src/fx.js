/* İçərişəhər Runner — particles, floating score text, camera shake, flashes. */
(function (ICH) {
  'use strict';
  const U = ICH.U;

  const POOL = 900;

  const FX = {
    parts: [],
    texts: [],
    shakeMag: 0,
    shakeT: 0,
    flashA: 0,
    flashColor: '#fff',
    timeScale: 1,
    _slowT: 0,

    init() {
      this.parts = new Array(POOL);
      for (let i = 0; i < POOL; i++) {
        this.parts[i] = { alive: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 3, g: 0, drag: 1, color: '#fff', kind: 'dot', rot: 0, vrot: 0 };
      }
      this._head = 0;
      this.texts.length = 0;
    },

    reset() {
      for (const p of this.parts) p.alive = false;
      this.texts.length = 0;
      this.shakeMag = 0;
      this.shakeT = 0;
      this.flashA = 0;
      this.timeScale = 1;
      this._slowT = 0;
    },

    _get() {
      for (let i = 0; i < POOL; i++) {
        const p = this.parts[(this._head + i) % POOL];
        if (!p.alive) { this._head = (this._head + i + 1) % POOL; return p; }
      }
      return this.parts[(this._head = (this._head + 1) % POOL)];
    },

    spawn(o) {
      const p = this._get();
      p.alive = true;
      p.x = o.x; p.y = o.y;
      p.vx = o.vx || 0; p.vy = o.vy || 0;
      p.max = p.life = o.life || 0.5;
      p.size = o.size || 3;
      p.g = o.g === undefined ? 900 : o.g;
      p.drag = o.drag === undefined ? 0.86 : o.drag;
      p.color = o.color || '#fff';
      p.kind = o.kind || 'dot';
      p.rot = o.rot || 0;
      p.vrot = o.vrot || 0;
      p.fade = o.fade === undefined ? true : o.fade;
      return p;
    },

    burst(x, y, n, o) {
      o = o || {};
      for (let i = 0; i < n; i++) {
        const a = o.angle === undefined ? U.rnd(U.TAU) : o.angle + U.rnd(-o.spread || -0.6, o.spread || 0.6);
        const s = U.rnd(o.speedMin || 60, o.speedMax || 260);
        this.spawn({
          x: x + U.rnd(-4, 4), y: y + U.rnd(-4, 4),
          vx: Math.cos(a) * s, vy: Math.sin(a) * s - (o.lift || 0),
          life: U.rnd(o.lifeMin || 0.25, o.lifeMax || 0.65),
          size: U.rnd(o.sizeMin || 2, o.sizeMax || 5),
          g: o.g, drag: o.drag, kind: o.kind,
          color: Array.isArray(o.color) ? U.pick(o.color) : o.color,
          vrot: U.rnd(-8, 8),
        });
      }
    },

    dust(x, y, dir) {
      this.spawn({
        x, y, vx: U.rnd(-30, 30) - dir * 45, vy: U.rnd(-45, -8),
        life: U.rnd(0.25, 0.5), size: U.rnd(3, 7), g: 120, drag: 0.9,
        color: 'rgba(224,205,168,0.75)', kind: 'puff',
      });
    },

    text(x, y, str, color, size) {
      this.texts.push({ x, y, str, color: color || ICH.P.gold, size: size || 16, life: 0.95, max: 0.95, vy: -46 });
      if (this.texts.length > 40) this.texts.shift();
    },

    shake(mag, time) {
      this.shakeMag = Math.max(this.shakeMag, mag);
      this.shakeT = Math.max(this.shakeT, time || 0.28);
    },

    flash(color, a) {
      this.flashColor = color || '#fff';
      this.flashA = Math.max(this.flashA, a === undefined ? 0.5 : a);
    },

    slowmo(dur, scale) {
      this._slowT = dur;
      this.timeScale = scale || 0.35;
    },

    update(dt) {
      if (this._slowT > 0) {
        this._slowT -= dt;
        if (this._slowT <= 0) this.timeScale = 1;
      }

      for (const p of this.parts) {
        if (!p.alive) continue;
        p.life -= dt;
        if (p.life <= 0) { p.alive = false; continue; }
        p.vy += p.g * dt;
        const d = Math.pow(p.drag, dt * 60);
        p.vx *= d; p.vy *= d;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vrot * dt;
      }

      for (let i = this.texts.length - 1; i >= 0; i--) {
        const t = this.texts[i];
        t.life -= dt;
        t.y += t.vy * dt;
        t.vy *= Math.pow(0.9, dt * 60);
        if (t.life <= 0) this.texts.splice(i, 1);
      }

      if (this.shakeT > 0) {
        this.shakeT -= dt;
        if (this.shakeT <= 0) this.shakeMag = 0;
      }
      if (this.flashA > 0) this.flashA = Math.max(0, this.flashA - dt * 2.6);
    },

    shakeOffset() {
      if (this.shakeT <= 0) return [0, 0];
      const m = this.shakeMag * Math.min(1, this.shakeT * 4);
      return [U.rnd(-m, m), U.rnd(-m, m)];
    },

    /** Draw particles in world space (camera transform already applied). */
    draw(ctx) {
      for (const p of this.parts) {
        if (!p.alive) continue;
        const a = p.fade ? U.clamp(p.life / p.max, 0, 1) : 1;
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        if (p.kind === 'dot') {
          ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
        } else if (p.kind === 'puff') {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (1.6 - a * 0.6), 0, U.TAU);
          ctx.fill();
        } else if (p.kind === 'spark') {
          ctx.strokeStyle = p.color;
          ctx.lineWidth = Math.max(1, p.size * 0.55);
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.vx * 0.022, p.y - p.vy * 0.022);
          ctx.stroke();
        } else if (p.kind === 'shard') {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.7);
          ctx.restore();
        } else if (p.kind === 'ring') {
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 2.5 * a;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (1 + (1 - a) * 4), 0, U.TAU);
          ctx.stroke();
        } else if (p.kind === 'star') {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          const s = p.size;
          ctx.beginPath();
          for (let i = 0; i < 4; i++) {
            const ang = (i * U.TAU) / 4;
            ctx.lineTo(Math.cos(ang) * s, Math.sin(ang) * s);
            ctx.lineTo(Math.cos(ang + U.TAU / 8) * s * 0.32, Math.sin(ang + U.TAU / 8) * s * 0.32);
          }
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
      }
      ctx.globalAlpha = 1;

      ctx.textAlign = 'center';
      for (const t of this.texts) {
        const a = U.clamp(t.life / t.max, 0, 1);
        ctx.globalAlpha = a;
        ctx.font = `700 ${t.size}px "Trebuchet MS", system-ui, sans-serif`;
        ctx.lineWidth = 3.5;
        ctx.strokeStyle = 'rgba(52,28,8,0.85)';
        ctx.strokeText(t.str, t.x, t.y);
        ctx.fillStyle = t.color;
        ctx.fillText(t.str, t.x, t.y);
      }
      ctx.globalAlpha = 1;
      ctx.textAlign = 'left';
    },

    drawOverlay(ctx) {
      if (this.flashA > 0) {
        ctx.globalAlpha = U.clamp(this.flashA, 0, 1);
        ctx.fillStyle = this.flashColor;
        ctx.fillRect(0, 0, ICH.C.W, ICH.C.H);
        ctx.globalAlpha = 1;
      }
    },
  };

  ICH.FX = FX;
})(window.ICH);
