/* İçərişəhər Runner — in-canvas HUD. */
(function (ICH) {
  'use strict';
  const U = ICH.U;
  const P = ICH.P;
  const C = ICH.C;
  const Art = ICH.Art;

  function narIcon(ctx, x, y, r, filled) {
    ctx.globalAlpha = filled ? 1 : 0.26;
    ctx.fillStyle = '#8c1c22';
    ctx.beginPath(); ctx.arc(x + 0.8, y + 0.8, r, 0, U.TAU); ctx.fill();
    ctx.fillStyle = filled ? '#d4303a' : '#5a4048';
    ctx.beginPath(); ctx.arc(x, y, r * 0.9, 0, U.TAU); ctx.fill();
    if (filled) {
      ctx.fillStyle = 'rgba(255,170,170,0.55)';
      ctx.beginPath(); ctx.arc(x - r * 0.32, y - r * 0.34, r * 0.26, 0, U.TAU); ctx.fill();
    }
    ctx.strokeStyle = '#6d4b12';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(x, y - r * 0.88); ctx.lineTo(x, y - r * 1.5);
    ctx.moveTo(x - r * 0.34, y - r * 1.5); ctx.lineTo(x, y - r * 1.05); ctx.lineTo(x + r * 0.34, y - r * 1.5);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function panel(ctx, x, y, w, h) {
    ctx.fillStyle = 'rgba(56,32,10,0.42)';
    Art.roundRect(ctx, x, y, w, h, 9);
    ctx.fill();
    ctx.strokeStyle = 'rgba(245,197,66,0.28)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  const HUD = {
    draw(ctx, G) {
      const t = G.time;
      ctx.textBaseline = 'alphabetic';

      // On a phone the canvas is physically small, so the whole HUD is drawn
      // magnified and laid out against the shrunken logical frame.
      const s = C.HUD;
      const W = C.W / s;
      const H = C.H / s;
      ctx.save();
      if (s !== 1) ctx.scale(s, s);

      /* ---------------------------------------------------- health + ammo */
      panel(ctx, 14, 12, 30 + C.MAX_HEALTH * 26, 38);
      for (let i = 0; i < C.MAX_HEALTH; i++) {
        const filled = i < G.health;
        const pop = G.healthPop > 0 && i === G.health - 1 ? 1 + G.healthPop * 0.5 : 1;
        narIcon(ctx, 36 + i * 26, 34, 8.5 * pop, filled);
      }

      panel(ctx, 14, 56, 78, 30);
      ctx.fillStyle = '#c8262e';
      ctx.beginPath(); ctx.arc(32, 71, 8, 0, U.TAU); ctx.fill();
      ctx.strokeStyle = '#6d4b12'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(32, 63); ctx.lineTo(32, 58); ctx.stroke();
      ctx.font = '700 16px "Trebuchet MS", system-ui, sans-serif';
      ctx.fillStyle = G.ammo > 0 ? P.ui : '#8d7f6a';
      ctx.fillText('×' + G.ammo, 46, 77);

      /* -----------------------------------------------------------------
         Score, and nothing else. Metres, kills and loot all feed into this
         one number, so showing them alongside it was showing the sum next to
         its own terms. What is worth a second line is the record being
         chased — and only once there is one. */
      const chase = G.best > 0;
      const beaten = chase && G.score > G.best;
      ctx.textAlign = 'right';
      panel(ctx, W - 178, 12, 164, chase ? 62 : 44);
      ctx.font = '700 28px "Trebuchet MS", system-ui, sans-serif';
      ctx.fillStyle = P.gold;
      ctx.fillText(String(Math.floor(G.score)).padStart(6, '0'), W - 26, 44);
      if (chase) {
        ctx.font = '600 12px "Trebuchet MS", system-ui, sans-serif';
        ctx.fillStyle = beaten ? P.gold : 'rgba(246,231,196,0.5)';
        ctx.fillText(beaten ? 'рекорд побит' : 'рекорд ' + G.best, W - 26, 63);
      }
      ctx.textAlign = 'left';

      /* ---------------------------------------------------------- combo */
      if (G.combo > 1) {
        const a = U.clamp(G.comboT / 0.6, 0, 1);
        const scale = 1 + Math.max(0, G.comboPop) * 0.4;
        ctx.save();
        ctx.translate(W / 2, 44);
        ctx.scale(scale, scale);
        ctx.globalAlpha = 0.35 + 0.65 * a;
        ctx.textAlign = 'center';
        ctx.font = '800 30px "Trebuchet MS", system-ui, sans-serif';
        ctx.lineWidth = 5;
        ctx.strokeStyle = 'rgba(52,28,8,0.8)';
        ctx.strokeText('×' + G.combo, 0, 0);
        const g = ctx.createLinearGradient(0, -22, 0, 6);
        g.addColorStop(0, '#fff0bd');
        g.addColorStop(1, '#f0a02a');
        ctx.fillStyle = g;
        ctx.fillText('×' + G.combo, 0, 0);
        ctx.font = '600 11px "Trebuchet MS", system-ui, sans-serif';
        ctx.fillStyle = 'rgba(246,231,196,0.75)';
        ctx.fillText('KOMBO', 0, 14);
        ctx.restore();
        ctx.textAlign = 'left';
        // draining bar
        ctx.fillStyle = 'rgba(52,28,8,0.5)';
        ctx.fillRect(W / 2 - 46, 52, 92, 4);
        ctx.fillStyle = P.gold;
        ctx.fillRect(W / 2 - 46, 52, 92 * U.clamp(G.comboT / C.COMBO_TIME, 0, 1), 4);
      }

      /* ------------------------------------------------------- boss bar */
      if (G.boss && !G.boss.dead && G.boss.state !== 'intro') {
        const b = G.boss;
        const w = b.final ? 560 : 420;
        const x = W / 2 - w / 2;
        // on a phone the bottom belongs to the thumbs, so the bar moves up top
        const y = C.touch ? 104 : H - 76;
        panel(ctx, x - 10, y - 22, w + 20, 40);
        ctx.font = '700 13px "Trebuchet MS", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = P.gold;
        ctx.fillText(b.name, W / 2, y - 8);
        if (b.final) {
          ctx.font = '600 10px "Trebuchet MS", system-ui, sans-serif';
          ctx.fillStyle = 'rgba(251,238,203,0.7)';
          ctx.fillText('SON DÖYÜŞ · ФИНАЛЬНЫЙ БОЙ · ' + b.phase + '/' + b.phases, W / 2, y + 26);
        }
        ctx.textAlign = 'left';

        ctx.fillStyle = 'rgba(30,16,4,0.7)';
        Art.roundRect(ctx, x, y, w, 11, 5);
        ctx.fill();
        const k = U.clamp(b.hp / b.maxHp, 0, 1);
        const g = ctx.createLinearGradient(x, 0, x + w, 0);
        g.addColorStop(0, b.phase > 1 ? '#e0400f' : '#c0272d');
        g.addColorStop(1, b.phase > 1 ? '#ff9d21' : '#f0b52a');
        ctx.fillStyle = g;
        Art.roundRect(ctx, x, y, Math.max(4, w * k), 11, 5);
        ctx.fill();
        if (b.core) {
          // the open core: hits land double right now
          ctx.strokeStyle = '#fff6d8';
          ctx.lineWidth = 2;
          Art.roundRect(ctx, x - 3, y - 3, w + 6, 17, 7);
          ctx.stroke();
        }
        // segment ticks so you can read how many hits are left
        ctx.strokeStyle = 'rgba(30,16,4,0.55)';
        ctx.lineWidth = 1;
        for (let i = 1; i < b.maxHp; i++) {
          const sx = x + (w * i) / b.maxHp;
          ctx.beginPath(); ctx.moveTo(sx, y + 1); ctx.lineTo(sx, y + 10); ctx.stroke();
        }
        if (b.hurtT > 0) {
          ctx.globalAlpha = b.hurtT * 2;
          ctx.fillStyle = '#fff';
          Art.roundRect(ctx, x, y, Math.max(4, w * k), 11, 5);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }

      /* -------------------------------------------------------- power-up */
      if (G.player && G.player.carpetT > 0) {
        const w = 180;
        const x = W / 2 - w / 2;
        const py = H - 46 - (C.touch ? 26 : 0);
        panel(ctx, x - 8, py, w + 16, 30);
        ctx.fillStyle = 'rgba(52,28,8,0.5)';
        ctx.fillRect(x, py + 12, w, 8);
        const k = U.clamp(G.player.carpetT / 10, 0, 1);
        const g = ctx.createLinearGradient(x, 0, x + w, 0);
        g.addColorStop(0, P.carpetA);
        g.addColorStop(0.5, P.carpetC);
        g.addColorStop(1, P.carpetB);
        ctx.fillStyle = g;
        ctx.fillRect(x, py + 12, w * k, 8);
        ctx.font = '600 11px "Trebuchet MS", system-ui, sans-serif';
        ctx.fillStyle = P.ui;
        ctx.textAlign = 'center';
        ctx.fillText('SEHRLİ XALÇA — ковёр-самолёт', W / 2, py + 8);
        ctx.textAlign = 'left';
      }

      /* --------------------------------------------------- speed warning */
      if (G.pushWarn > 0) {
        ctx.globalAlpha = U.clamp(G.pushWarn, 0, 1) * 0.9;
        const g = ctx.createLinearGradient(0, 0, 110, 0);
        g.addColorStop(0, 'rgba(200,38,46,0.6)');
        g.addColorStop(1, 'rgba(200,38,46,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 110, H);
        ctx.globalAlpha = 1;
      }

      if (G.mutedFlash > 0) {
        ctx.globalAlpha = U.clamp(G.mutedFlash, 0, 1);
        ctx.textAlign = 'center';
        ctx.font = '600 14px "Trebuchet MS", system-ui, sans-serif';
        ctx.fillStyle = P.ui;
        ctx.fillText(ICH.Audio.muted ? 'звук выключен (M)' : 'звук включён (M)', W / 2, H - 62);
        ctx.textAlign = 'left';
        ctx.globalAlpha = 1;
      }
    
      ctx.restore();
    },
  };

  ICH.HUD = HUD;
})(window.ICH);
