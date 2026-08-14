/* İçərişəhər Runner — parallax backdrop of the Old City + endless level builder. */
(function (ICH) {
  'use strict';
  const U = ICH.U;
  const P = ICH.P;
  const C = ICH.C;
  const Art = ICH.Art;

  /* ==================================================================== */
  /*  BACKDROP                                                            */
  /* ==================================================================== */
  /* Layers are generated per cell from a stable hash, so scrolling forever
     never drifts and nothing has to be kept in memory. */

  /** Screen y of the waterline. Anchored to the bottom so the skyline keeps
      its distance from the street whatever the viewport aspect is. */
  const horizon = () => C.H - 240;

  const Backdrop = {
    layers: [
      { id: 0, par: 0.10, cellW: 520, color: P.layerSea, baseOff: 0 },
      { id: 1, par: 0.22, cellW: 430, color: P.layerFar, baseOff: 22 },
      { id: 2, par: 0.40, cellW: 360, color: P.layerMid, baseOff: 62 },
      { id: 3, par: 0.66, cellW: 310, color: P.layerNear, baseOff: 128 },
    ],
    cache: [new Map(), new Map(), new Map(), new Map(), new Map()],
    _sky: null,
    _skyKey: '',

    reset() {
      this.cache.forEach((m) => m.clear());
    },

    cell(layer, i) {
      const m = this.cache[layer];
      let c = m.get(i);
      if (c === undefined) {
        c = this.gen(layer, i);
        m.set(i, c);
        if (m.size > 260) {
          // drop the oldest half; they regenerate identically if we scroll back
          let n = 0;
          for (const k of m.keys()) { m.delete(k); if (++n > 120) break; }
        }
      }
      return c;
    },

    // The far layer cycles through the real landmarks of the Old City so the
    // place is recognisable rather than "generic oriental town".
    LANDMARKS: ['maiden', 'palace', 'gate', 'sinigqala'],
    // Across the bay: the modern Baku skyline everyone knows from photos.
    SKYLINE: ['flames', 'heydar', 'carpet', 'tvtower'],

    gen(layer, i) {
      const r = U.rng(U.hash(layer * 977 + 13, i));

      if (layer === 0) {
        const mod = ((i % 3) + 3) % 3;
        return {
          skyline: mod === 0 ? this.SKYLINE[((i / 3) | 0) & 3] : null,
          sx: r.f(60, 300),
          boats: r.i(0, 2),
          bx: [r.f(40, 400), r.f(40, 400), r.f(40, 400)],
        };
      }

      if (layer === 1) {
        if (i % 2 === 0) {
          return { type: this.LANDMARKS[(((i / 2) | 0) % 4 + 4) % 4], x: r.f(70, 190) };
        }
        const n = r.i(3, 5);
        const boxes = [];
        let bx = r.f(0, 40);
        for (let k = 0; k < n; k++) {
          const w = r.f(52, 110);
          boxes.push({ x: bx, w, h: r.f(72, 168), dome: r.chance(0.34), crenel: r.chance(0.4) });
          bx += w + r.f(4, 30);
        }
        return { type: 'blocks', boxes };
      }

      if (layer === 2) {
        const t = r.f();
        if (t < 0.3) return { type: 'minaret', x: r.f(60, 250), h: r.f(158, 228) };
        if (t < 0.52) return { type: 'palace', x: r.f(20, 130), w: r.f(160, 230), h: r.f(112, 162) };
        const n = r.i(3, 5);
        const boxes = [];
        let bx = r.f(-10, 30);
        for (let k = 0; k < n; k++) {
          const w = r.f(58, 108);
          boxes.push({ x: bx, w, h: r.f(78, 148), dome: r.chance(0.26), lights: r.i(2, 6) });
          bx += w + r.f(8, 28);
        }
        return { type: 'houses', boxes };
      }

      // near facades — kept lower than the layers behind so the skyline reads
      const n = r.i(2, 4);
      const houses = [];
      let hx = r.f(-20, 20);
      for (let k = 0; k < n; k++) {
        const w = r.f(88, 148);
        houses.push({
          x: hx, w, h: r.f(126, 188),
          bay: r.chance(0.5), bayY: r.f(0.56, 0.84), balcony: r.chance(0.4),
          arches: r.i(2, 3), lit: [r.chance(0.5), r.chance(0.4), r.chance(0.35), r.chance(0.3)],
          laundry: r.chance(0.35), roofBox: r.chance(0.4), crenel: r.chance(0.34),
        });
        hx += w + r.f(6, 26);
      }
      return { houses };
    },

    /* ------------------------------------------------------------- sky */
    drawSky(ctx, time) {
      const T = ICH.Theme;
      const g = ctx.createLinearGradient(0, 0, 0, C.H);
      g.addColorStop(0, U.rgbCss(T.sky[0]));
      g.addColorStop(0.3, U.rgbCss(T.sky[1]));
      g.addColorStop(0.48, U.rgbCss(T.sky[2]));
      g.addColorStop(0.56, U.rgbCss(T.sky[3]));
      g.addColorStop(1, U.rgbaCss(T.sky[3], 1));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, C.W, C.H);

      const open = 1 - T.interior;
      if (open > 0.02) {
        // low afternoon sun washing the limestone
        const sx = C.W * 0.74, sy = horizon() - 96;
        const gg = ctx.createRadialGradient(sx, sy, 6, sx, sy, 210);
        gg.addColorStop(0, U.rgbaCss(T.sun, 0.95 * open));
        gg.addColorStop(0.24, U.rgbaCss(T.sun, 0.4 * open));
        gg.addColorStop(1, U.rgbaCss(T.sun, 0));
        ctx.fillStyle = gg;
        ctx.fillRect(sx - 230, sy - 230, 460, 460);
        ctx.globalAlpha = open;
        ctx.fillStyle = T.sunCss;
        ctx.beginPath();
        ctx.arc(sx, sy, 26, 0, U.TAU);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      if (T.interior > 0.02) this.drawVault(ctx, time, T.interior);
    },

    /** Interior zones get a vaulted ceiling with skylights instead of sky. */
    drawVault(ctx, time, k) {
      const T = ICH.Theme;
      ctx.save();
      ctx.globalAlpha = k;
      ctx.fillStyle = U.rgbaCss(T.layers[3], 0.9);
      ctx.beginPath();
      ctx.moveTo(-20, -10);
      ctx.lineTo(C.W + 20, -10);
      ctx.lineTo(C.W + 20, 150);
      for (let x = C.W; x >= -60; x -= 160) {
        ctx.quadraticCurveTo(x - 40, 70, x - 80, 150);
        ctx.lineTo(x - 160, 150);
      }
      ctx.closePath();
      ctx.fill();
      // pierced star skylights, the signature of a hamam dome
      for (let i = 0; i < 7; i++) {
        const x = 70 + i * 132;
        const y = 52 + Math.sin(i * 2.1) * 16;
        const r = 9 + (i % 3) * 2;
        ctx.fillStyle = 'rgba(255,246,214,' + (0.5 + 0.12 * Math.sin(time * 1.5 + i)) + ')';
        ctx.beginPath();
        for (let s = 0; s < 8; s++) {
          const a = (s / 8) * U.TAU;
          ctx.lineTo(Math.cos(a) * r + x, Math.sin(a) * r + y);
          ctx.lineTo(Math.cos(a + U.TAU / 16) * r * 0.42 + x, Math.sin(a + U.TAU / 16) * r * 0.42 + y);
        }
        ctx.closePath();
        ctx.fill();
        // shaft of light falling into the steam
        const sg = ctx.createLinearGradient(x, y, x + 26, y + 260);
        sg.addColorStop(0, 'rgba(255,246,214,0.18)');
        sg.addColorStop(1, 'rgba(255,246,214,0)');
        ctx.fillStyle = sg;
        ctx.beginPath();
        ctx.moveTo(x - r, y);
        ctx.lineTo(x + r, y);
        ctx.lineTo(x + 46, y + 260);
        ctx.lineTo(x + 6, y + 260);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    },

    drawClouds(ctx, camX, time) {
      const open = 1 - ICH.Theme.interior;
      if (open < 0.02) return;
      const ox = camX * 0.04 + time * 5;
      ctx.fillStyle = 'rgba(255,252,244,' + (0.42 * open).toFixed(3) + ')';
      for (let i = -1; i < 6; i++) {
        const idx = Math.floor(ox / 400) + i;
        const r = U.rng(U.hash(555, idx));
        const x = idx * 400 + r.f(0, 300) - ox;
        const y = r.f(40, 190);
        const w = r.f(120, 260);
        ctx.beginPath();
        ctx.ellipse(x, y, w * 0.5, r.f(10, 20), 0, 0, U.TAU);
        ctx.ellipse(x + w * 0.22, y - 8, w * 0.3, r.f(9, 16), 0, 0, U.TAU);
        ctx.fill();
      }
    },

    drawSea(ctx, camX, time) {
      const T = ICH.Theme;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - T.interior * 0.85);
      const HORIZON = horizon();
      ctx.fillStyle = T.seaCss;
      ctx.fillRect(0, HORIZON, C.W, C.H - HORIZON);
      // sun road on the water
      ctx.globalAlpha = 0.55;
      for (let i = 0; i < 26; i++) {
        const y = HORIZON + 2 + i * 3.4;
        const w = 20 + i * 9 + Math.sin(time * 1.6 + i * 0.7) * 12;
        ctx.fillStyle = i % 2 ? 'rgba(255,246,214,0.4)' : 'rgba(255,255,240,0.26)';
        ctx.fillRect(C.W * 0.74 - w / 2, y, w, 2);
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(235,248,252,0.3)';
      const ox = camX * 0.1;
      for (let i = 0; i < 40; i++) {
        const r = U.rng(U.hash(31, i));
        const x = (r.f(0, 1) * 1400 - ox * 0.4) % 1200;
        ctx.fillRect(x < 0 ? x + 1200 : x, HORIZON + 6 + r.f(0, 60), r.f(8, 26), 1.4);
      }
      ctx.fillStyle = 'rgba(255,250,232,0.5)';
      ctx.fillRect(0, HORIZON - 1, C.W, 2);
      ctx.restore();
    },

    /* ------------------------------------------------------------ layers */
    draw(ctx, camX, camY, time) {
      this.drawSky(ctx, time);
      this.drawClouds(ctx, camX, time);
      this.drawSea(ctx, camX, time);

      for (const L of this.layers) {
        const ox = camX * L.par;
        const oy = camY * L.par * 0.55;
        const i0 = Math.floor(ox / L.cellW) - 1;
        const i1 = Math.floor((ox + C.W) / L.cellW) + 1;
        for (let i = i0; i <= i1; i++) {
          const sx = i * L.cellW - ox;
          ctx.save();
          ctx.translate(sx, -oy);
          this.drawCell(ctx, L, this.cell(L.id, i), time, i, horizon() + L.baseOff);
          ctx.restore();
        }
      }

      // shadow pooling in the street canyon, so the sandy playfield pops out
      const top = C.H - 350;
      const g = ctx.createLinearGradient(0, top, 0, C.H);
      g.addColorStop(0, 'rgba(74,44,16,0)');
      g.addColorStop(1, 'rgba(58,32,10,' + ICH.Theme.canyon.toFixed(3) + ')');
      ctx.fillStyle = g;
      ctx.fillRect(0, top, C.W, C.H - top);
    },

    drawCell(ctx, L, cell, time, i, base) {
      L.color = ICH.Theme.layerCss[L.id];
      ctx.fillStyle = L.color;

      if (L.id === 0) {
        if (cell.skyline) this._skyline(ctx, cell.skyline, cell.sx, base);
        ctx.fillStyle = 'rgba(255,240,210,0.25)';
        for (let b = 0; b < cell.boats; b++) {
          const x = cell.bx[b];
          const y = base + 14 + b * 9;
          ctx.fillRect(x, y, 11, 2);
          ctx.fillRect(x + 5, y - 5, 1.4, 5);
        }
        return;
      }

      if (L.id === 1) {
        switch (cell.type) {
          case 'maiden': this._maidenTower(ctx, cell.x, base, L.color); break;
          case 'palace': this._shirvanshahs(ctx, cell.x, base, L.color); break;
          case 'gate': this._doubleGate(ctx, cell.x, base, L.color); break;
          case 'sinigqala': this._sinigqala(ctx, cell.x, base, L.color); break;
          default: this._boxes(ctx, cell.boxes, base, L.color, false);
        }
        return;
      }

      if (L.id === 2) {
        if (cell.type === 'minaret') this._minaret(ctx, cell.x, base, cell.h, L.color);
        else if (cell.type === 'palace') this._palace(ctx, cell.x, base, cell.w, cell.h, L.color);
        else this._boxes(ctx, cell.boxes, base, L.color, true);
        return;
      }

      this._facades(ctx, cell.houses, base, L.color, time);
    },

    _boxes(ctx, boxes, base, color, lights) {
      ctx.fillStyle = color;
      for (const b of boxes) {
        ctx.fillRect(b.x, base - b.h, b.w, b.h + 200);
        if (b.dome) {
          ctx.beginPath();
          ctx.ellipse(b.x + b.w / 2, base - b.h, b.w * 0.34, b.w * 0.3, 0, Math.PI, U.TAU);
          ctx.fill();
          ctx.fillRect(b.x + b.w / 2 - 1.5, base - b.h - b.w * 0.3 - 9, 3, 10);
        }
        if (b.crenel) {
          for (let cx = b.x + 2; cx < b.x + b.w - 4; cx += 12) ctx.fillRect(cx, base - b.h - 7, 7, 8);
        }
      }
      if (lights) {
        ctx.fillStyle = 'rgba(56,34,12,0.34)';
        for (const b of boxes) {
          for (let k = 0; k < (b.lights || 0); k++) {
            const r = U.rng(U.hash(b.x | 0, k));
            ctx.fillRect(b.x + r.f(6, b.w - 12), base - b.h + r.f(14, b.h - 14), 4, 5);
          }
        }
      }
    },

    /** Small gold caption under a landmark — turns scenery into a postcard. */
    _label(ctx, x, y, text) {
      // no postcard captions once you are indoors
      const vis = 1 - ICH.Theme.interior;
      if (vis < 0.15) return;
      // keep captions clear of the HUD strip along the top of the screen
      const cy = Math.max(y, 122);
      ctx.save();
      ctx.globalAlpha = vis;
      ctx.font = '600 11px "Trebuchet MS", system-ui, sans-serif';
      ctx.textAlign = 'center';
      const w = ctx.measureText(text).width;
      ctx.fillStyle = 'rgba(255,248,228,0.3)';
      ctx.fillRect(x - w / 2 - 5, cy - 10, w + 10, 14);
      ctx.fillStyle = 'rgba(104,70,26,0.72)';
      ctx.fillText(text, x, cy);
      ctx.restore();
      ctx.textAlign = 'left';
    },

    /* ---- Qız Qalası: cylinder + the massive buttress, banded upper third */
    _maidenTower(ctx, x, base, color) {
      const w = 92, h = 188;
      const top = base - h;
      ctx.fillStyle = color;

      // buttress on the east side, stopping short of the crown
      const buY = base - h * 0.82;
      ctx.fillRect(x + w - 8, buY, 36, h * 0.82 + 220);
      ctx.beginPath();
      ctx.moveTo(x + w - 8, buY);
      ctx.lineTo(x + w + 28, buY + 18);
      ctx.lineTo(x + w + 28, buY + 34);
      ctx.lineTo(x + w - 8, buY + 16);
      ctx.closePath();
      ctx.fill();

      // main drum, shaded so it reads as a cylinder and not a box
      ctx.fillRect(x, top, w, h + 220);
      ctx.fillStyle = 'rgba(255,235,200,0.10)';
      ctx.fillRect(x + w * 0.16, top, w * 0.26, h + 220);
      ctx.fillStyle = 'rgba(0,0,0,0.20)';
      ctx.fillRect(x + w * 0.76, top, w * 0.24, h + 220);

      // the tower's signature: protruding courses over the upper third
      ctx.fillStyle = 'rgba(255,255,255,0.085)';
      for (let y = top + 20; y < top + h * 0.40; y += 17) ctx.fillRect(x - 3, y, w + 6, 8);
      ctx.fillStyle = 'rgba(0,0,0,0.13)';
      for (let y = top + h * 0.45; y < base; y += 27) ctx.fillRect(x, y, w, 3);
      // the seam where the smooth lower shaft meets the banded upper section
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fillRect(x, top + h * 0.41, w, 5);

      // crown of merlons
      ctx.fillStyle = color;
      ctx.fillRect(x - 6, top - 7, w + 12, 11);
      for (let cx = x - 6; cx < x + w + 6; cx += 15) ctx.fillRect(cx, top - 17, 10, 12);

      // flagpole with the flag
      ctx.fillRect(x + w / 2 - 1, top - 46, 2.4, 30);
      ctx.fillStyle = 'rgba(210,80,70,0.45)';
      ctx.fillRect(x + w / 2 + 1, top - 46, 17, 9);

      // slit windows up the shaft
      ctx.fillStyle = 'rgba(48,28,10,0.42)';
      [0.7, 0.5, 0.3, 0.13].forEach((k) => ctx.fillRect(x + w * 0.44, base - h * k, 6, 13));

      this._label(ctx, x + w / 2 + 8, top - 56, 'QIZ QALASI');
    },

    /* ---- Şirvanşahlar Sarayı: palace block, Divankhana rotunda, mausoleum */
    _shirvanshahs(ctx, x, base, color) {
      ctx.fillStyle = color;
      const pw = 126, ph = 104;

      // main palace mass with a stepped upper storey
      ctx.fillRect(x, base - ph, pw, ph + 220);
      ctx.fillRect(x + 14, base - ph - 24, pw - 54, 26);
      ctx.fillRect(x + 10, base - ph - 30, pw - 46, 8);

      // the tall carved portal
      ctx.fillStyle = 'rgba(46,26,8,0.42)';
      Art.archPath(ctx, x + pw * 0.36, base - ph * 0.8, 32, ph * 0.8);
      ctx.fill();
      ctx.fillStyle = color;
      ctx.fillRect(x + pw * 0.36 - 8, base - ph * 0.88, 48, 10);
      ctx.fillStyle = 'rgba(48,28,10,0.34)';
      for (let k = 0; k < 3; k++) ctx.fillRect(x + 14 + k * 16, base - ph * 0.5, 6, 11);

      // Divankhana — the octagonal pavilion with its stone dome and arcade
      const dx = x + pw + 34, dr = 32;
      ctx.fillStyle = color;
      ctx.fillRect(dx - dr, base - 60, dr * 2, 60 + 220);
      ctx.beginPath();
      ctx.ellipse(dx, base - 58, dr * 0.92, dr * 0.8, 0, Math.PI, U.TAU);
      ctx.fill();
      ctx.fillRect(dx - 2, base - 58 - dr * 0.8 - 11, 4, 12);
      ctx.fillStyle = 'rgba(46,26,8,0.4)';
      for (let k = -1; k <= 1; k++) {
        Art.archPath(ctx, dx + k * 21 - 7.5, base - 42, 15, 42);
        ctx.fill();
      }

      // Dervish mausoleum — octagonal drum under a faceted pyramid
      const mx = dx + dr + 40;
      ctx.fillStyle = color;
      ctx.fillRect(mx - 22, base - 52, 44, 52 + 220);
      ctx.beginPath();
      ctx.moveTo(mx - 26, base - 52);
      ctx.lineTo(mx, base - 88);
      ctx.lineTo(mx + 26, base - 52);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.beginPath();
      ctx.moveTo(mx, base - 88); ctx.lineTo(mx + 26, base - 52); ctx.lineTo(mx + 8, base - 52);
      ctx.closePath();
      ctx.fill();

      // palace mosque minaret
      const nx = mx + 40;
      ctx.fillStyle = color;
      ctx.fillRect(nx, base - 130, 15, 130 + 220);
      ctx.fillRect(nx - 5, base - 86, 25, 6);
      ctx.beginPath();
      ctx.moveTo(nx - 4, base - 130);
      ctx.lineTo(nx + 7.5, base - 156);
      ctx.lineTo(nx + 19, base - 130);
      ctx.closePath();
      ctx.fill();

      this._label(ctx, x + pw * 0.6 + 40, base - ph - 48, 'ŞIRVANŞAHLAR SARAYI');
    },

    /* ---- Qoşa Qala Qapısı: the twin-arch gate in the city wall */
    _doubleGate(ctx, x, base, color) {
      const wallH = 92;
      const w = 250;
      ctx.fillStyle = color;
      ctx.fillRect(x, base - wallH, w, wallH + 220);

      // machicolation band + merlons
      ctx.fillRect(x - 4, base - wallH - 8, w + 8, 10);
      for (let cx = x - 4; cx < x + w + 4; cx += 16) ctx.fillRect(cx, base - wallH - 19, 10, 13);

      // round bastion towers flanking the gate
      [x + 6, x + w - 50].forEach((tx) => {
        ctx.fillStyle = color;
        ctx.fillRect(tx, base - wallH - 26, 44, wallH + 26 + 220);
        ctx.beginPath();
        ctx.ellipse(tx + 22, base - wallH - 26, 22, 9, 0, Math.PI, U.TAU);
        ctx.fill();
        for (let cx = tx - 2; cx < tx + 44; cx += 15) ctx.fillRect(cx, base - wallH - 40, 9, 14);
        ctx.fillStyle = 'rgba(46,26,8,0.3)';
        ctx.fillRect(tx + 19, base - wallH + 14, 6, 16);
      });

      // the two openings: a big cart arch and a small pedestrian one
      ctx.fillStyle = 'rgba(40,22,6,0.5)';
      Art.archPath(ctx, x + 78, base - 74, 58, 74);
      ctx.fill();
      Art.archPath(ctx, x + 150, base - 54, 38, 54);
      ctx.fill();

      this._label(ctx, x + w / 2, base - wallH - 52, 'QOŞA QALA QAPISI');
    },

    /* ---- Sınıqqala: the squat minaret of the Muhammad mosque, 1078 */
    _sinigqala(ctx, x, base, color) {
      ctx.fillStyle = color;
      // low mosque block
      ctx.fillRect(x, base - 62, 108, 62 + 220);
      ctx.fillStyle = 'rgba(46,26,8,0.35)';
      Art.archPath(ctx, x + 34, base - 44, 26, 44);
      ctx.fill();
      ctx.fillStyle = color;
      // the stubby cylindrical minaret
      const mx = x + 108;
      ctx.fillRect(mx, base - 128, 26, 128 + 220);
      ctx.fillRect(mx - 5, base - 96, 36, 7);
      ctx.fillRect(mx - 2, base - 104, 30, 9);
      ctx.beginPath();
      ctx.ellipse(mx + 13, base - 128, 15, 11, 0, Math.PI, U.TAU);
      ctx.fill();
      ctx.fillRect(mx + 11.5, base - 150, 3, 12);
      ctx.fillStyle = 'rgba(48,28,10,0.38)';
      ctx.fillRect(mx + 9, base - 92, 8, 10);

      this._label(ctx, x + 70, base - 168, 'SINIQQALA');
    },

    /* ---- across the bay: the modern skyline of Baku, small and hazy */
    _skyline(ctx, kind, x, base) {
      ctx.save();
      ctx.fillStyle = 'rgba(96,126,158,0.5)';
      if (kind === 'flames') {
        for (let i = 0; i < 3; i++) {
          const bx = x + i * 44;
          const h = 122 - i * 16;
          ctx.beginPath();
          ctx.moveTo(bx, base);
          ctx.quadraticCurveTo(bx + 3, base - h * 0.62, bx + 16, base - h);
          ctx.quadraticCurveTo(bx + 29, base - h * 0.56, bx + 33, base);
          ctx.closePath();
          ctx.fill();
        }
        this._label(ctx, x + 50, base - 132, 'ALOV QÜLLƏLƏRI');
      } else if (kind === 'heydar') {
        // Heydar Aliyev Center — one continuous white wave
        ctx.beginPath();
        ctx.moveTo(x, base);
        ctx.bezierCurveTo(x + 10, base - 66, x + 74, base - 78, x + 108, base - 26);
        ctx.bezierCurveTo(x + 122, base - 8, x + 130, base - 3, x + 140, base);
        ctx.closePath();
        ctx.fill();
        this._label(ctx, x + 70, base - 90, 'HEYDƏR ƏLIYEV MƏRKƏZI');
      } else if (kind === 'carpet') {
        // Carpet Museum — a rolled-up rug
        ctx.fillRect(x, base - 30, 84, 30);
        ctx.beginPath();
        ctx.arc(x + 84, base - 30, 30, Math.PI * 1.5, Math.PI * 0.55);
        ctx.lineTo(x + 84, base);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = 'rgba(20,30,48,0.45)';
        ctx.beginPath();
        ctx.arc(x + 88, base - 30, 13, 0, U.TAU);
        ctx.fill();
        this._label(ctx, x + 58, base - 68, 'XALÇA MUZEYI');
      } else {
        // Baku TV Tower
        ctx.beginPath();
        ctx.moveTo(x + 4, base);
        ctx.lineTo(x + 14, base - 92);
        ctx.lineTo(x + 24, base - 92);
        ctx.lineTo(x + 34, base);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(x + 19, base - 100, 17, 9, 0, 0, U.TAU);
        ctx.fill();
        ctx.fillRect(x + 17, base - 158, 4, 58);
        this._label(ctx, x + 19, base - 172, 'TELEQÜLLƏ');
      }
      ctx.restore();
    },

    _minaret(ctx, x, base, h, color) {
      ctx.fillStyle = color;
      ctx.fillRect(x, base - h, 17, h + 200);
      ctx.fillRect(x - 6, base - h * 0.62, 29, 7); // muezzin balcony
      ctx.fillRect(x - 3, base - h * 0.62 - 8, 23, 9);
      ctx.beginPath();
      ctx.moveTo(x - 4, base - h);
      ctx.lineTo(x + 8.5, base - h - 30);
      ctx.lineTo(x + 21, base - h);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(x + 7.5, base - h - 40, 2.4, 11);
      ctx.fillStyle = 'rgba(48,28,10,0.42)';
      ctx.fillRect(x + 6, base - h * 0.58, 5, 9);
    },

    _palace(ctx, x, base, w, h, color) {
      // Shirvanshahs' Palace: portal, dome, stepped mass
      ctx.fillStyle = color;
      ctx.fillRect(x, base - h, w, h + 200);
      ctx.fillRect(x + w * 0.1, base - h - 26, w * 0.8, 28);
      ctx.beginPath();
      ctx.ellipse(x + w * 0.5, base - h - 24, w * 0.26, w * 0.22, 0, Math.PI, U.TAU);
      ctx.fill();
      ctx.fillRect(x + w * 0.5 - 2, base - h - 24 - w * 0.22 - 12, 4, 13);
      // deep portal (pishtaq)
      ctx.fillStyle = 'rgba(46,26,8,0.42)';
      Art.archPath(ctx, x + w * 0.38, base - h * 0.72, w * 0.24, h * 0.72);
      ctx.fill();
      ctx.fillStyle = 'rgba(48,28,10,0.38)';
      for (let k = 0; k < 4; k++) ctx.fillRect(x + 12 + k * (w - 30) / 4, base - h * 0.45, 6, 10);
    },

    _facades(ctx, houses, base, color, time) {
      for (const hs of houses) {
        ctx.fillStyle = color;
        ctx.fillRect(hs.x, base - hs.h, hs.w, hs.h + 240);
        // parapet — crenellated on the stretches that read as the qala wall
        ctx.fillRect(hs.x - 4, base - hs.h - 8, hs.w + 8, 10);
        if (hs.crenel) {
          for (let cx = hs.x - 4; cx < hs.x + hs.w + 4; cx += 15) {
            ctx.fillRect(cx, base - hs.h - 19, 9, 13);
          }
        } else if (hs.roofBox) {
          ctx.fillRect(hs.x + hs.w * 0.2, base - hs.h - 30, hs.w * 0.3, 24);
        }

        // arched windows, some lit
        const aw = hs.w / (hs.arches + 1);
        for (let k = 0; k < hs.arches; k++) {
          const ax = hs.x + aw * (k + 0.5) - 11;
          const ay = base - hs.h + 34;
          ctx.fillStyle = hs.lit[k] ? 'rgba(58,36,14,0.5)' : 'rgba(38,22,8,0.4)';
          Art.archPath(ctx, ax, ay, 22, 30);
          ctx.fill();
        }

        // şüşəbənd — the glazed Baku bay window
        if (hs.bay) {
          // şüşəbənd — the glazed timber bay window, with its şəbəkə lattice
          const by = base - hs.h * hs.bayY;
          const bw = hs.w * 0.6;
          const bx = hs.x + (hs.w - bw) / 2;
          ctx.fillStyle = '#6a4a22';
          ctx.fillRect(bx - 3, by - 3, bw + 6, 40);
          ctx.fillStyle = hs.lit[3] ? 'rgba(232,244,248,0.5)' : 'rgba(150,178,190,0.42)';
          ctx.fillRect(bx, by, bw, 34);
          ctx.strokeStyle = '#6a4a22';
          ctx.lineWidth = 1.1;
          ctx.save();
          ctx.beginPath();
          ctx.rect(bx, by, bw, 34);
          ctx.clip();
          for (let gx = bx - 34; gx < bx + bw + 34; gx += 15) {
            ctx.beginPath();
            ctx.moveTo(gx, by - 3); ctx.lineTo(gx + 37, by + 37);
            ctx.moveTo(gx + 37, by - 3); ctx.lineTo(gx, by + 37);
            ctx.stroke();
          }
          ctx.restore();
          ctx.fillStyle = '#6a4a22';
          ctx.fillRect(bx - 5, by - 5, bw + 10, 4);
          ctx.fillRect(bx - 5, by + 33, bw + 10, 5);
          ctx.fillStyle = color;
          ctx.fillRect(bx - 6, by + 38, bw + 12, 4);
        }

        if (hs.balcony) {
          const by = base - hs.h * 0.3;
          ctx.fillStyle = color;
          ctx.fillRect(hs.x + hs.w * 0.15, by, hs.w * 0.5, 5);
          for (let gx = 0; gx < hs.w * 0.5; gx += 7) ctx.fillRect(hs.x + hs.w * 0.15 + gx, by - 12, 2, 12);
          ctx.fillRect(hs.x + hs.w * 0.15, by - 14, hs.w * 0.5, 3);
        }

        if (hs.laundry) {
          ctx.strokeStyle = 'rgba(46,26,8,0.4)';
          ctx.lineWidth = 1.2;
          const ly = base - hs.h + 16;
          ctx.beginPath();
          ctx.moveTo(hs.x + 4, ly);
          ctx.quadraticCurveTo(hs.x + hs.w / 2, ly + 8, hs.x + hs.w - 4, ly);
          ctx.stroke();
          const cols = ['rgba(226,214,190,0.5)', 'rgba(180,90,80,0.45)', 'rgba(120,150,170,0.45)'];
          for (let k = 0; k < 4; k++) {
            const t = (k + 1) / 5;
            const lx = hs.x + 4 + (hs.w - 8) * t;
            const yy = ly + Math.sin(Math.PI * t) * 8;
            ctx.fillStyle = cols[k % 3];
            const sway = Math.sin(time * 1.7 + lx * 0.05) * 1.6;
            ctx.save();
            ctx.translate(lx, yy);
            ctx.transform(1, 0, sway / 18, 1, 0, 0);
            ctx.fillRect(-5, 0, 10, 18);
            ctx.restore();
          }
        }
      }
    },

    /** Foreground silhouettes drawn over gameplay for depth. Kept sparse and
        thin on purpose — the playfield must never be hard to read. */
    drawFront(ctx, camX, time) {
      const par = 1.34;
      const cellW = 1100;
      const ox = camX * par;
      const i0 = Math.floor(ox / cellW) - 1;
      const i1 = Math.floor((ox + C.W) / cellW) + 1;
      for (let i = i0; i <= i1; i++) {
        const r = U.rng(U.hash(909, i));
        if (!r.chance(0.62)) continue;
        const sx = i * cellW - ox + r.f(0, 500);
        ctx.fillStyle = ICH.Theme.frontCss;
        if (r.chance(0.45)) {
          // a city gate you run through — slim piers, generous opening
          ctx.beginPath();
          ctx.moveTo(sx - 26, C.H);
          ctx.lineTo(sx - 26, 0);
          ctx.lineTo(sx + 286, 0);
          ctx.lineTo(sx + 286, C.H);
          ctx.lineTo(sx + 260, C.H);
          ctx.lineTo(sx + 260, 150);
          ctx.quadraticCurveTo(sx + 260, 34, sx + 130, 18);
          ctx.quadraticCurveTo(sx, 34, sx, 150);
          ctx.lineTo(sx, C.H);
          ctx.closePath();
          ctx.fill();
          // machicolation corbels under the lintel — the gate reads as fortified
          for (let cx = sx - 20; cx < sx + 282; cx += 24) {
            ctx.beginPath();
            ctx.moveTo(cx, 0);
            ctx.lineTo(cx + 13, 0);
            ctx.lineTo(cx + 9, 14);
            ctx.lineTo(cx + 4, 14);
            ctx.closePath();
            ctx.fill();
          }
        } else {
          // hanging vines / wires
          ctx.strokeStyle = ICH.Theme.frontCss;
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(sx - 40, 0);
          ctx.quadraticCurveTo(sx + 60, 46 + Math.sin(time * 0.8 + i) * 4, sx + 180, 0);
          ctx.stroke();
          for (let k = 0; k < 6; k++) {
            const t = (k + 1) / 7;
            const lx = sx - 40 + 220 * t;
            const ly = Math.sin(Math.PI * t) * 40;
            ctx.beginPath();
            ctx.ellipse(lx, ly + 12, 7, 13, Math.sin(time + k) * 0.1, 0, U.TAU);
            ctx.fill();
          }
        }
      }
    },
  };

  /* ==================================================================== */
  /*  LEVEL                                                               */
  /* ==================================================================== */

  function makeBlocks(w, h, rng) {
    const blocks = [];
    const bh = 15;
    const maxY = Math.min(h, 72);
    let row = 0;
    for (let y = 8; y < maxY; y += bh, row++) {
      const off = row % 2 ? 15 : 0;
      for (let x = -off; x < w; x += 30) {
        const c = rng.chance(0.22) ? P.stoneLite : rng.chance(0.5) ? P.stone : P.stoneMid;
        blocks.push({ x: x + 2, y: y + 2, w: 26, h: bh - 4, c });
      }
    }
    return blocks;
  }

  const Level = {
    platforms: [],
    hazards: [],
    ropes: [],
    decos: [],
    jars: [],
    enemies: [],
    pickups: [],
    bosses: [],
    nextX: 0,
    chunkIndex: 0,
    zoneIndex: 0,
    chunksLeft: 0,
    marks: [],

    reset() {
      this.platforms.length = 0;
      this.hazards.length = 0;
      this.ropes.length = 0;
      this.decos.length = 0;
      this.jars.length = 0;
      this.enemies.length = 0;
      this.pickups.length = 0;
      this.bosses.length = 0;
      this.nextX = -400;
      this.chunkIndex = 0;
      this.zoneIndex = 0;
      this.chunksLeft = 6;
      this.lap = 0;
      this.after = null;
      this.marks = [{ x: -400, zone: ICH.Zones[0] }];
      ICH.Theme.reset(ICH.Zones[0]);
      // a generous opening street so the first seconds are never unfair
      const r0 = U.rng(1);
      this.ground(-400, 1500, r0);
      this.dressGround(-380, 1460, r0, 0);
      this.coinLine(320, C.GROUND_Y - 46, 5);
      this.coinArc(560, C.GROUND_Y - 60, 760, C.GROUND_Y - 60, 5, 70);
      this.pickups.push(ICH.Ent.pickup('nar', 880, C.GROUND_Y - 44));
      this.jars.push({ x: 620, y: C.GROUND_Y - 30, w: 24, h: 30, dead: false });
      this.enemies.push(ICH.Ent.enemy('snake', 980, C.GROUND_Y - 22));
      this.nextX = 1100;
    },

    /* ------------------------------------------------------------- zones */
    zone() { return ICH.Zones[this.zoneIndex]; },

    /** Which district covers this world x. */
    zoneAt(x) {
      let z = this.marks.length ? this.marks[0].zone : ICH.Zones[0];
      for (const m of this.marks) {
        if (m.x <= x) z = m.zone; else break;
      }
      return z;
    },

    /** Record where a district starts. Trimmed here and nowhere else, so no
        caller can grow the list without bound. */
    mark(x, zone) {
      this.marks.push({ x, zone });
      while (this.marks.length > 24) this.marks.shift();
    },

    advanceZone(x, rng) {
      this.zoneIndex = (this.zoneIndex + 1) % ICH.Zones.length;
      this.chunksLeft = rng.i(4, 7);
      this.mark(x, ICH.Zones[this.zoneIndex]);
    },

    /* ------------------------------------------------------- primitives */
    ground(x, w, rng, kind) {
      const h = 260;
      const tufts = [];
      for (let t = rng.f(20, 90); t < w - 10; t += rng.f(90, 260)) tufts.push(t);
      this.platforms.push({
        x, y: C.GROUND_Y, w, h, kind: kind || this.zone().ground, oneWay: false,
        blocks: makeBlocks(w, h, rng), tufts,
      });
    },

    block(x, y, w, h, kind, oneWay, rng) {
      const solid = kind === 'stone' || kind === 'tile' || kind === undefined;
      // A solid slab hanging just above the street would trap the runner, who
      // is 56px tall — lift anything that leaves less than a body of headroom.
      if (!oneWay && y + h < C.GROUND_Y && y + h > C.GROUND_Y - 64) {
        y = C.GROUND_Y - 64 - h;
      }
      this.platforms.push({
        x, y, w, h, kind: kind || 'stone', oneWay: !!oneWay,
        blocks: solid ? makeBlocks(w, h, rng) : [],
      });
    },

    /** A tile that gives way half a second after you land on it. */
    crumble(x, y, w, rng) {
      this.platforms.push({
        x, y, w, h: 18, kind: 'crumble', oneWay: true, blocks: [],
        crumbleT: -1, shake: 0,
      });
    },

    coin(x, y) { this.pickups.push(ICH.Ent.pickup('coin', x, y)); },

    coinLine(x, y, n, dx) {
      for (let i = 0; i < n; i++) this.coin(x + i * (dx || 34), y);
    },

    coinArc(x0, y0, x1, y1, n, lift) {
      for (let i = 0; i < n; i++) {
        const t = n === 1 ? 0.5 : i / (n - 1);
        const x = U.lerp(x0, x1, t);
        const y = U.lerp(y0, y1, t) - Math.sin(Math.PI * t) * (lift || 80);
        this.coin(x, y);
      }
    },

    bonus(x, y, rng, d) {
      const t = rng.f();
      if (t < 0.24) this.pickups.push(ICH.Ent.pickup('nar', x, y));
      else if (t < 0.42) this.pickups.push(ICH.Ent.pickup('gem', x, y));
      else if (t < 0.54) this.pickups.push(ICH.Ent.pickup('tea', x, y));
      else if (t < 0.62) this.pickups.push(ICH.Ent.pickup('carpet', x, y));
      else if (t < 0.76) this.pickups.push(ICH.Ent.pickup('paxlava', x, y));
      else if (t < 0.84) this.pickups.push(ICH.Ent.pickup('zefer', x, y));
      else this.coinLine(x - 34, y, 3);
    },

    // Real street names of İçərişəhər — the signs alone place you in Baku.
    STREETS: ['Böyük Qala küç.', 'Kiçik Qala küç.', 'Qüllə küç.', 'Mirzə Mənsur küç.',
      'Əsəf Zeynallı küç.', 'Qala meydanı', 'Zərgərpalan küç.'],

    /** Place one piece of street furniture of the given kind. */
    prop(type, dx, rng) {
      const gy = C.GROUND_Y;
      switch (type) {
        case 'stall': this.decos.push({ type: 'stall', x: dx, y: gy - 36, w: rng.i(50, 84) }); break;
        case 'lamp': this.decos.push({ type: 'lamp', x: dx, y: gy - 96 }); break;
        case 'plant': this.decos.push({ type: 'plant', x: dx, y: gy }); break;
        case 'palm': this.decos.push({ type: 'palm', x: dx, y: gy, h: rng.f(70, 120) }); break;
        case 'cat': this.decos.push({ type: 'cat', x: dx, y: gy }); break;
        case 'chay': this.decos.push({ type: 'chay', x: dx, y: gy }); break;
        case 'door': this.decos.push({ type: 'door', x: dx, y: gy - 62, w: 34, h: 62 }); break;
        case 'tandir': this.decos.push({ type: 'tandir', x: dx, y: gy }); break;
        case 'loom': this.decos.push({ type: 'loom', x: dx, y: gy }); break;
        case 'copper': this.decos.push({ type: 'copper', x: dx, y: gy - 108 }); break;
        case 'bread': this.decos.push({ type: 'bread', x: dx, y: gy }); break;
        case 'well': this.decos.push({ type: 'well', x: dx, y: gy }); break;
        case 'nerd': this.decos.push({ type: 'nerd', x: dx, y: gy }); break;
        case 'boat': this.decos.push({ type: 'boat', x: dx, y: gy }); break;
        case 'net': this.decos.push({ type: 'net', x: dx, y: gy }); break;
        case 'dish': this.decos.push({ type: 'dish', x: dx, y: gy }); break;
        case 'chimney': this.decos.push({ type: 'chimney', x: dx, y: gy }); break;
        case 'drip': this.decos.push({ type: 'drip', x: dx, y: gy - 190, phase: rng.f(0, 6) }); break;
        case 'jarpile': this.decos.push({ type: 'jarpile', x: dx, y: gy }); break;
        case 'pigeons':
          this.decos.push({
            type: 'pigeons', x: dx, y: gy, n: rng.i(3, 5),
            birds: Array.from({ length: 5 }, () => ({ dx: rng.f(-24, 24), dy: rng.f(-6, 0), t: rng.f(0, 6), fly: 0, vx: 0, vy: 0 })),
            scared: 0,
          });
          break;
        case 'rug':
          this.decos.push({
            type: 'rug', x: dx, y: gy - 150, w: rng.f(30, 44), h: rng.f(50, 86),
            c1: rng.pick([P.carpetA, '#7d1f4f', '#2b4f7d']), c2: rng.pick([P.carpetB, P.carpetA, '#3d6b3a']), c3: P.carpetC,
          });
          break;
        case 'plaque': {
          const text = rng.pick(this.STREETS);
          this.decos.push({ type: 'plaque', x: dx, y: gy - 152, w: 10 + text.length * 4.3, text });
          break;
        }
      }
    },

    dressGround(x, w, rng, d) {
      const gy = C.GROUND_Y;
      const table = this.zone().props;
      let dx = x + 30;
      while (dx < x + w - 40) {
        if (rng.chance(0.82)) this.prop(U.weighted(table, rng.next), dx, rng);
        dx += rng.f(105, 215);
      }
      if (rng.chance(0.55)) {
        const jx = x + rng.f(60, Math.max(70, w - 80));
        this.jars.push({ x: jx, y: gy - 30, w: 24, h: 30, dead: false });
      }
    },

    /** Drop one of this zone's hazards near x. */
    hazard(x, rng, d) {
      const gy = C.GROUND_Y;
      switch (U.weighted(this.zone().hazards, rng.next)) {
        case 'brazier':
          this.hazards.push({ type: 'brazier', x, y: gy - 42, w: 34, h: 42, flame: 1, timer: rng.f(0, 3), on: true });
          break;
        case 'spikes':
          this.hazards.push({ type: 'spikes', x, y: gy - 20, w: rng.i(3, 5) * 14, h: 20 });
          break;
        case 'censer':
          this.hazards.push({
            type: 'censer', x, y: gy - 250, len: rng.f(110, 165),
            angle: rng.f(-0.9, 0.9), omega: rng.f(-0.5, 0.5) || 0.4, w: 26, h: 26,
          });
          break;
        case 'roller':
          this.enemies.push(ICH.Ent.enemy('roller', x + 260, gy - 26, { dir: -1 }));
          break;
        case 'crumble':
          break; // placed by the rooftop template itself
        case 'faller':
          this.hazards.push({
            type: 'faller', x, y: gy - 210, w: 40, h: 34,
            state: 'idle', t: 0, vy: 0, homeY: gy - 210,
          });
          break;
        case 'steam':
          this.hazards.push({ type: 'steam', x, y: gy - 8, w: 34, h: 12, timer: rng.f(0, 2), on: false, power: 0 });
          break;
      }
    },

    /* -------------------------------------------------------- templates */
    ensure(camX, difficulty) {
      let guard = 0;
      while (this.nextX < camX + C.W * 2 && guard++ < 12) this.addChunk(difficulty);
      this.prune(camX - 900);
    },

    addChunk(d) {
      const rng = U.rng(U.hash(4242, this.chunkIndex++));
      const x = this.nextX;

      if (this.after === 'boss') {
        this.after = null;
        if (this.zoneIndex === ICH.Zones.length - 1) {
          // five districts down: the road opens onto the fire yard
          this.after = 'final';
          this.mark(x, ICH.FinalZone);
          this.nextX = x + this.tFinalArena(x, d, rng);
          return;
        }
        this.advanceZone(x, rng);
      } else if (this.after === 'final') {
        this.after = null;
        this.lap++;
        this.advanceZone(x, rng);
      } else if (this.chunksLeft-- <= 0) {
        // every district signs off with its own boss
        this.after = 'boss';
        this.nextX = x + this.tBossArena(x, d, rng);
        return;
      }

      const TPL = {
        street: this.tStreet, gap: this.tGap, stairs: this.tStairs,
        rooftops: this.tRooftops, ropes: this.tRopes, bazaar: this.tBazaar,
        wall: this.tWall, arcade: this.tArcade,
      };
      const name = this.chunkIndex < 3 ? 'street' : U.weighted(this.zone().templates, rng.next);
      this.nextX = x + TPL[name].call(this, x, d, rng);
    },

    /** Place an enemy standing on surfaceY; kind omitted → this district's mix.
        Fliers are lifted off the surface automatically. */
    spawnEnemy(kind, x, surfaceY, rng, opts) {
      const table = this.zone().enemies;
      if (!kind) kind = U.weighted(table, rng ? rng.next : undefined);
      if (opts && opts.flying && !ICH.Ent.isFlyer(kind)) {
        const f = table.find((e) => ICH.Ent.isFlyer(e[0]));
        kind = f ? f[0] : 'crow';
      }
      this.enemies.push(ICH.Ent.enemyOn(kind, x, surfaceY, opts));
    },

    tStreet(x, d, rng) {
      const w = rng.f(440, 700);
      const gy = C.GROUND_Y;
      this.ground(x, w, rng);
      this.dressGround(x, w, rng, d);
      const n = 1 + (d > 0.3 ? 1 : 0) + (rng.chance(d) ? 1 : 0);
      for (let i = 0; i < n; i++) {
        this.spawnEnemy(null, x + rng.f(120, w - 90), gy, rng, { elite: d > 0.5 && rng.chance(0.25) });
      }
      if (d > 0.12 && rng.chance(0.6)) this.hazard(x + rng.f(150, w - 140), rng, d);
      this.coinLine(x + rng.f(80, 160), gy - 46, rng.i(4, 7));
      if (rng.chance(0.6)) this.bonus(x + w * 0.7, gy - 60, rng, d);
      return w;
    },

    tGap(x, d, rng) {
      const gy = C.GROUND_Y;
      const pad = 190;
      const gapW = 130 + d * 130 + rng.f(0, 60);
      const w = pad * 2 + gapW;
      this.ground(x, pad, rng);
      this.ground(x + pad + gapW, pad, rng);
      this.dressGround(x, pad, rng, d);
      if (gapW > 230) {
        const bw = 96;
        this.block(x + pad + (gapW - bw) / 2, gy - 86, bw, 20, 'stone', false, rng);
        this.coin(x + pad + gapW / 2, gy - 120);
      }
      this.coinArc(x + pad - 20, gy - 50, x + pad + gapW + 20, gy - 50, 7, 90);
      if (rng.chance(0.55)) this.spawnEnemy(null, x + pad + gapW * 0.5, gy - 150, rng, { amp: 40, flying: true });
      if (rng.chance(0.4)) this.bonus(x + pad + gapW / 2, gy - 150, rng, d);
      return w;
    },

    tStairs(x, d, rng) {
      const gy = C.GROUND_Y;
      const steps = rng.i(3, 4);
      const sw = 112;
      const rise = 84;
      let cx = x + 150;
      this.ground(x, 150, rng);
      for (let i = 0; i < steps; i++) {
        const y = gy - (i + 1) * rise;
        this.block(cx, y, sw, 18, 'stone', false, rng);
        this.coinLine(cx + 22, y - 34, 2, 36);
        if (rng.chance(0.4)) this.spawnEnemy(null, cx + sw / 2, y, rng, { patrol: [cx, cx + sw] });
        cx += sw + rng.f(26, 54);
      }
      const topY = gy - steps * rise;
      const plateauW = rng.f(170, 250);
      this.block(cx, topY, plateauW, 20, 'stone', false, rng);
      this.pickups.push(ICH.Ent.pickup(rng.chance(0.5) ? 'gem' : 'carpet', cx + plateauW / 2, topY - 40));
      if (rng.chance(0.6)) this.spawnEnemy(null, cx + plateauW / 2, topY - 90, rng, { amp: 34, flying: true });
      cx += plateauW + 60;
      this.ground(cx, 200, rng);
      this.dressGround(cx, 200, rng, d);
      this.coinArc(cx - 50, topY - 20, cx + 120, gy - 60, 6, 40);
      return cx + 200 - x;
    },

    tRooftops(x, d, rng) {
      const gy = C.GROUND_Y;
      const n = rng.i(3, 5);
      let cx = x + 150;
      const w0 = 150;
      this.ground(x, 4000, rng); // street continues underneath the whole run
      this.dressGround(x, 300, rng, d);
      const heights = [gy - 96, gy - 168, gy - 132, gy - 200, gy - 150];
      for (let i = 0; i < n; i++) {
        const rw = rng.f(110, 165);
        const ry = heights[(i + rng.i(0, 4)) % heights.length];
        if (rng.chance(0.3) && i > 0) {
          // a stretch of loose tiles instead of a solid roof
          for (let t = 0; t < 3; t++) this.crumble(cx + t * 46, ry, 42, rng);
        } else {
          this.block(cx, ry, rw, 30, 'roof', true, rng);
        }
        this.coinLine(cx + 24, ry - 32, rng.i(2, 3), 32);
        if (rng.chance(0.4 + d * 0.3)) this.spawnEnemy(null, cx + rw / 2, ry - 70, rng, { amp: 30, flying: true });
        if (rng.chance(0.34)) this.spawnEnemy(null, cx + rw / 2, ry, rng, { patrol: [cx + 6, cx + rw - 6] });
        if (rng.chance(0.35)) {
          this.decos.push({
            type: 'rug', x: cx + rng.f(10, rw - 40), y: ry + 30, w: 30, h: rng.f(40, 70),
            c1: P.carpetA, c2: P.carpetB, c3: P.carpetC,
          });
        }
        cx += rw + rng.f(70, 100 + d * 50);
      }
      const total = Math.max(cx + 200 - x, w0 + 200);
      this.dressGround(x + 320, total - 360, rng, d);
      if (rng.chance(0.7)) this.bonus(x + total * 0.5, gy - 46, rng, d);
      if (rng.chance(0.6)) this.hazard(x + total * 0.35, rng, d);
      // trim the oversized ground to the chunk length
      const g = this.platforms.find((p) => p.kind === 'ground' && p.x === x);
      if (g) { g.w = total; g.blocks = makeBlocks(total, g.h, U.rng(U.hash(7, x | 0))); }
      return total;
    },

    tRopes(x, d, rng) {
      const gy = C.GROUND_Y;
      const pad = 180;
      const nRopes = rng.i(2, 3);
      const span = nRopes * 175 + 60;
      const w = pad * 2 + span;
      this.ground(x, pad, rng);
      this.ground(x + pad + span, pad, rng);
      this.dressGround(x, pad, rng, d);
      this.dressGround(x + pad + span, pad, rng, d);
      for (let i = 0; i < nRopes; i++) {
        const rx = x + pad + 90 + i * 175;
        const len = rng.f(112, 150);
        this.ropes.push({ x: rx, y: gy - 300, len, angle: 0, omega: 0, holder: null, w: 26 });
        this.coinArc(rx - 70, gy - 190, rx + 70, gy - 190, 5, 26);
      }
      this.coin(x + pad + span * 0.5, gy - 300 + 20);
      if (rng.chance(0.7)) this.spawnEnemy(null, x + pad + span * 0.5, gy - 250, rng, { amp: 50, flying: true });
      if (rng.chance(0.5)) this.bonus(x + pad + span - 40, gy - 210, rng, d);
      return w;
    },

    tBazaar(x, d, rng) {
      const gy = C.GROUND_Y;
      const w = rng.f(520, 760);
      this.ground(x, w, rng);
      this.dressGround(x, w, rng, d);
      // awnings you can run along
      let cx = x + 90;
      while (cx < x + w - 150) {
        const aw = rng.f(120, 190);
        const ay = gy - rng.f(96, 130);
        this.block(cx, ay, aw, 22, 'awning', true, rng);
        this.coinLine(cx + 20, ay - 30, Math.floor(aw / 34), 34);
        this.decos.push({ type: 'stall', x: cx + 10, y: gy - 36, w: Math.min(aw - 20, 90) });
        if (rng.chance(0.45)) {
          this.decos.push({
            type: 'rug', x: cx + aw - 40, y: ay + 22, w: 34, h: rng.f(46, 78),
            c1: rng.pick([P.carpetA, '#7d1f4f', '#2b4f7d']), c2: rng.pick([P.carpetB, P.carpetA, '#3d6b3a']), c3: P.carpetC,
          });
        }
        cx += aw + rng.f(60, 110);
      }
      const n = 2 + (d > 0.35 ? 1 : 0);
      for (let i = 0; i < n; i++) {
        this.spawnEnemy(null, x + rng.f(120, w - 100), gy, rng, { elite: d > 0.55 && rng.chance(0.3) });
      }
      if (rng.chance(0.6)) this.hazard(x + rng.f(140, w - 200), rng, d);
      this.jars.push({ x: x + rng.f(100, w - 120), y: gy - 30, w: 24, h: 30, dead: false });
      if (rng.chance(0.8)) this.bonus(x + w * 0.55, gy - 60, rng, d);
      return w;
    },

    tWall(x, d, rng) {
      const gy = C.GROUND_Y;
      const w = 620;
      this.ground(x, w, rng);
      this.dressGround(x, 180, rng, d);
      const wx = x + 300;
      const wallH = 234;
      this.block(wx, gy - wallH, 54, wallH + 10, 'stone', false, rng);
      // A solid flight of steps up to the rampart. Deliberately solid rather
      // than floating ledges: nothing overhangs the street, so the runner can
      // never end up boxed in under a slab with the wall in front.
      const stepW = 84;
      for (let i = 0; i < 3; i++) {
        const top = gy - 78 * (i + 1);
        this.block(wx - 252 + i * stepW, top, stepW, gy - top + 10, 'stone', false, rng);
        this.coinLine(wx - 226 + i * stepW, top - 34, 2, 34);
      }
      this.coinLine(wx + 70, gy - wallH - 34, 3, 34);
      this.decos.push({ type: 'merlons', x: wx - 4, y: gy - wallH, w: 62 });
      this.spawnEnemy(null, wx + 27, gy - wallH, rng, { patrol: [wx, wx + 54], elite: d > 0.5 });
      if (rng.chance(0.6)) this.spawnEnemy(null, wx + 160, gy - wallH - 40, rng, { amp: 44, flying: true });
      this.hazards.push({ type: 'spikes', x: wx + 70, y: gy - 20, w: 56, h: 20 });
      this.pickups.push(ICH.Ent.pickup(rng.chance(0.55) ? 'nar' : 'tea', wx + 24, gy - wallH - 40));
      this.dressGround(x + 380, 200, rng, d);
      return w;
    },

    /** Walled yard at the end of a district: the gate stays shut until the
        boss is down. Deliberately flat and clear — no pits, no clutter. */
    tBossArena(x, d, rng) {
      const gy = C.GROUND_Y;
      const w = 1000;
      this.ground(x, w, rng);
      this.dressGround(x + 20, 200, rng, d);

      // the barred gate at the far end, held back until the fight is over
      const gate = {
        x: x + w - 56, y: gy - 250, w: 46, h: 260, kind: 'stone', oneWay: false,
        blocks: makeBlocks(46, 260, U.rng(U.hash(31, x | 0))), gate: true,
      };
      this.decos.push({ type: 'gatearch', x: x + w - 92, y: gy, w: 120, h: 262 });
      this.decos.push({ type: 'merlons', x: x + w - 62, y: gy - 250, w: 58 });

      // torches down both sides so the yard reads as an arena
      for (let tx = x + 120; tx < x + w - 120; tx += 190) {
        this.decos.push({ type: 'lamp', x: tx, y: gy - 150 });
      }

      this.bosses.push({
        id: this.zone().boss, zone: this.zone(),
        arena: { x0: x, x1: x + w - 56 },
        gate, triggered: false, done: false, x, w,
      });

      // stock up before the doors close
      this.pickups.push(ICH.Ent.pickup('tea', x + 150, gy - 60));
      this.pickups.push(ICH.Ent.pickup('nar', x + 210, gy - 60));
      this.pickups.push(ICH.Ent.pickup('nar', x + 260, gy - 60));
      return w;
    },

    /** The fire yard. Wider than a district arena, lit by pits, and the only
        place the run ever really stops. */
    tFinalArena(x, d, rng) {
      const gy = C.GROUND_Y;
      const w = 1320;
      this.ground(x, w, rng, 'ground');

      const gate = {
        x: x + w - 56, y: gy - 270, w: 46, h: 280, kind: 'stone', oneWay: false,
        blocks: makeBlocks(46, 280, U.rng(U.hash(77, x | 0))), gate: true,
      };
      this.decos.push({ type: 'gatearch', x: x + w - 92, y: gy, w: 120, h: 282 });
      this.decos.push({ type: 'merlons', x: x + w - 62, y: gy - 270, w: 58 });
      for (let fx = x + 150; fx < x + w - 150; fx += 210) {
        this.decos.push({ type: 'firepit', x: fx, y: gy, phase: rng.f(0, 6) });
      }

      this.bosses.push({
        id: 'alovsahi', zone: ICH.FinalZone, final: true,
        arena: { x0: x, x1: x + w - 56 },
        gate, triggered: false, done: false, x, w,
      });

      this.pickups.push(ICH.Ent.pickup('tea', x + 140, gy - 60));
      this.pickups.push(ICH.Ent.pickup('tea', x + 190, gy - 60));
      this.pickups.push(ICH.Ent.pickup('nar', x + 250, gy - 60));
      this.pickups.push(ICH.Ent.pickup('nar', x + 300, gy - 60));
      this.pickups.push(ICH.Ent.pickup('carpet', x + 380, gy - 70));
      return w;
    },

    /** Caravanserai gallery: two tiers of arched walkway around a courtyard. */
    tArcade(x, d, rng) {
      const gy = C.GROUND_Y;
      const w = rng.f(600, 820);
      this.ground(x, w, rng);
      this.dressGround(x, w, rng, d);

      const tier1 = gy - 104;
      const tier2 = gy - 206;
      const bay = rng.f(120, 150);
      let cx = x + 60;
      while (cx + bay < x + w - 50) {
        // columns carrying the galleries
        this.decos.push({ type: 'column', x: cx, y: gy, h: 104 });
        this.block(cx, tier1, bay, 20, 'wood', true, rng);
        if (rng.chance(0.72)) {
          this.decos.push({ type: 'column', x: cx, y: tier1, h: 102 });
          this.block(cx, tier2, bay, 20, 'wood', true, rng);
          this.coinLine(cx + 26, tier2 - 32, Math.max(2, Math.floor(bay / 40)), 38);
        }
        this.coinLine(cx + 26, tier1 - 32, Math.max(2, Math.floor(bay / 40)), 38);
        if (rng.chance(0.45)) {
          this.decos.push({
            type: 'rug', x: cx + bay - 44, y: tier1 + 20, w: 34, h: rng.f(44, 70),
            c1: rng.pick([P.carpetA, '#7d1f4f', '#2b4f7d']), c2: rng.pick([P.carpetB, '#3d6b3a']), c3: P.carpetC,
          });
        }
        if (rng.chance(0.5)) this.spawnEnemy(null, cx + bay / 2, tier1, rng, { patrol: [cx + 8, cx + bay - 8] });
        cx += bay + rng.f(10, 40);
      }

      const n = 2 + (d > 0.4 ? 1 : 0);
      for (let i = 0; i < n; i++) this.spawnEnemy(null, x + rng.f(90, w - 90), gy, rng, { elite: d > 0.5 && rng.chance(0.25) });
      this.hazard(x + rng.f(140, w - 180), rng, d);
      this.jars.push({ x: x + rng.f(90, w - 110), y: gy - 30, w: 24, h: 30, dead: false });
      this.pickups.push(ICH.Ent.pickup(rng.chance(0.5) ? 'zefer' : 'gem', x + w * 0.5, tier2 - 44));
      if (rng.chance(0.8)) this.bonus(x + w * 0.75, gy - 60, rng, d);
      return w;
    },

    /* ------------------------------------------------------------ prune */
    prune(minX) {
      const cull = (arr) => {
        for (let i = arr.length - 1; i >= 0; i--) {
          const o = arr[i];
          if (o.x + (o.w || 40) < minX) arr.splice(i, 1);
        }
      };
      cull(this.platforms);
      cull(this.hazards);
      cull(this.decos);
      cull(this.jars);
      cull(this.pickups);
      cull(this.enemies);
      for (let i = this.bosses.length - 1; i >= 0; i--) {
        if (this.bosses[i].done && this.bosses[i].arena.x1 < minX) this.bosses.splice(i, 1);
      }
      for (let i = this.ropes.length - 1; i >= 0; i--) {
        if (this.ropes[i].x + 60 < minX && !this.ropes[i].holder) this.ropes.splice(i, 1);
      }
    },

    /* ------------------------------------------------------------- query */
    solidsNear(x, w) {
      const out = [];
      for (const p of this.platforms) {
        if (p.x < x + w && p.x + p.w > x) out.push(p);
      }
      return out;
    },
  };

  ICH.Backdrop = Backdrop;
  ICH.Level = Level;
})(window.ICH);
