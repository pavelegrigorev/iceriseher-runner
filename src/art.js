/* İçərişəhər Runner — all drawing of gameplay-layer objects.
   Everything is vector/procedural: no image assets, crisp at any resolution. */
(function (ICH) {
  'use strict';
  const U = ICH.U;
  const P = ICH.P;
  const C = ICH.C;

  /** Limb segment. Angle 0 = straight down, positive = towards +x. */
  function seg(ctx, x, y, ang, len, w, color) {
    const ex = x + Math.sin(ang) * len;
    const ey = y + Math.cos(ang) * len;
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    return [ex, ey];
  }

  function roundRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  /** Pointed "keel" arch — the shape that reads as Icherisheher at a glance. */
  function archPath(ctx, x, y, w, h) {
    const hw = w / 2;
    ctx.beginPath();
    ctx.moveTo(x, y + h);
    ctx.lineTo(x, y + h * 0.42);
    ctx.quadraticCurveTo(x, y + h * 0.08, x + hw * 0.62, y + h * 0.06);
    ctx.quadraticCurveTo(x + hw, y, x + hw, y - h * 0.06);
    ctx.quadraticCurveTo(x + hw, y, x + w - hw * 0.62, y + h * 0.06);
    ctx.quadraticCurveTo(x + w, y + h * 0.08, x + w, y + h * 0.42);
    ctx.lineTo(x + w, y + h);
    ctx.closePath();
  }

  /** Çarıq — the traditional shoe with the curled-up toe. */
  function bootShape(ctx, x, y, color, s) {
    s = s || 1;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x - 3.6 * s, y - 3.8 * s);
    ctx.lineTo(x + 2.2 * s, y - 3.8 * s);
    ctx.quadraticCurveTo(x + 8.6 * s, y - 3.2 * s, x + 7.4 * s, y + 0.6 * s);
    ctx.quadraticCurveTo(x + 6.2 * s, y + 2.6 * s, x + 2 * s, y + 2.6 * s);
    ctx.lineTo(x - 3.6 * s, y + 2.6 * s);
    ctx.closePath();
    ctx.fill();
  }

  /** Buta (paisley) — used as ornament on carpets and UI. */
  function buta(ctx, x, y, s, rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot || 0);
    ctx.beginPath();
    ctx.moveTo(0, -s);
    ctx.bezierCurveTo(s * 0.85, -s * 0.55, s * 0.75, s * 0.5, 0, s);
    ctx.bezierCurveTo(-s * 0.8, s * 0.5, -s * 0.8, -s * 0.5, 0, -s);
    ctx.closePath();
    ctx.restore();
  }

  const Art = {
    seg, roundRect, archPath, buta, bootShape,

    /* ---------------------------------------------------------- platforms */
    drawPlatform(ctx, pl, time) {
      switch (pl.kind) {
        case 'ground': this._stone(ctx, pl, true); break;
        case 'stone': this._stone(ctx, pl, false); break;
        case 'roof': this._roof(ctx, pl); break;
        case 'awning': this._awning(ctx, pl, time); break;
        case 'wood': this._wood(ctx, pl); break;
        case 'tile': this._stone(ctx, pl, true); this._glaze(ctx, pl); break;
        case 'roofdeck': this._stone(ctx, pl, true); this._deck(ctx, pl); break;
        case 'quay': this._stone(ctx, pl, true); this._quay(ctx, pl, time); break;
        case 'crumble': this._crumble(ctx, pl, time); break;
        default: this._stone(ctx, pl, false);
      }
    },

    /** Glazed turquoise band along a hamam floor. */
    _glaze(ctx, pl) {
      const { x, y, w } = pl;
      ctx.save();
      ctx.beginPath(); ctx.rect(x, y, w, 26); ctx.clip();
      ctx.fillStyle = '#1d6e75';
      ctx.fillRect(x, y, w, 26);
      ctx.fillStyle = '#2b9099';
      for (let tx = x - 20; tx < x + w + 20; tx += 26) {
        ctx.save();
        ctx.translate(tx + 13, y + 13);
        ctx.rotate(Math.PI / 4);
        ctx.fillRect(-8, -8, 16, 16);
        ctx.restore();
      }
      ctx.fillStyle = 'rgba(230,250,250,0.35)';
      ctx.fillRect(x, y, w, 3);
      ctx.restore();
      ctx.fillStyle = 'rgba(20,50,50,0.4)';
      ctx.fillRect(x, y + 26, w, 4);
    },

    /** Rooftop terrace: tiled edge and stub parapets. */
    _deck(ctx, pl) {
      const { x, y, w } = pl;
      ctx.fillStyle = P.roof;
      ctx.fillRect(x, y - 4, w, 6);
      ctx.fillStyle = P.roofDark;
      for (let tx = x + 2; tx < x + w - 4; tx += 12) {
        ctx.beginPath();
        ctx.arc(tx + 5, y + 2, 4.6, 0, Math.PI);
        ctx.fill();
      }
      ctx.fillStyle = P.stoneMid;
      for (let px = x + 40; px < x + w - 30; px += 150) ctx.fillRect(px, y - 20, 16, 22);
    },

    /** Sea-front quay: bollards, mooring rope and a wet lower course. */
    _quay(ctx, pl, time) {
      const { x, y, w, h } = pl;
      ctx.fillStyle = 'rgba(40,80,96,0.28)';
      ctx.fillRect(x, y + 46, w, h - 46);
      ctx.strokeStyle = '#6b4a24';
      ctx.lineWidth = 2.4;
      let prev = null;
      for (let bx = x + 60; bx < x + w - 40; bx += 170) {
        ctx.fillStyle = P.stoneDark;
        ctx.fillRect(bx - 6, y - 14, 12, 16);
        ctx.fillStyle = P.stoneMid;
        ctx.beginPath();
        ctx.ellipse(bx, y - 14, 8, 4, 0, 0, U.TAU);
        ctx.fill();
        if (prev !== null) {
          ctx.beginPath();
          ctx.moveTo(prev, y - 14);
          ctx.quadraticCurveTo((prev + bx) / 2, y + 6 + Math.sin(time + bx) * 2, bx, y - 14);
          ctx.stroke();
        }
        prev = bx;
      }
    },

    /** Loose roof tiles that give way once you stand on them. */
    _crumble(ctx, pl, time) {
      const k = pl.crumbleT >= 0 ? U.clamp(1 - pl.crumbleT / 0.55, 0, 1) : 0;
      const sh = k > 0 ? Math.sin(time * 46) * k * 2.2 : 0;
      ctx.save();
      ctx.translate(pl.x + sh, pl.y);
      ctx.fillStyle = P.roofDark;
      ctx.fillRect(0, 6, pl.w, 12);
      ctx.fillStyle = k > 0 ? '#b2653f' : P.roof;
      ctx.fillRect(0, 0, pl.w, 8);
      ctx.fillStyle = P.roofDark;
      for (let tx = 2; tx < pl.w - 4; tx += 11) {
        ctx.beginPath();
        ctx.arc(tx + 4, 8, 4.4, 0, Math.PI);
        ctx.fill();
      }
      if (k > 0) {
        ctx.strokeStyle = 'rgba(50,20,8,' + (0.4 + k * 0.5) + ')';
        ctx.lineWidth = 1.6;
        for (let c = 0; c < 3; c++) {
          const cx0 = 8 + c * (pl.w / 3);
          ctx.beginPath();
          ctx.moveTo(cx0, 0);
          ctx.lineTo(cx0 + 5 * k, 7);
          ctx.lineTo(cx0 - 3 * k, 14);
          ctx.stroke();
        }
      }
      ctx.restore();
    },

    _stone(ctx, pl, isGround) {
      const { x, y, w, h } = pl;
      ctx.fillStyle = P.stoneDark;
      ctx.fillRect(x, y, w, h);

      // masonry courses, generated once and cached on the platform
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.clip();
      for (const b of pl.blocks) {
        ctx.fillStyle = b.c;
        ctx.fillRect(x + b.x, y + b.y, b.w, b.h);
      }
      ctx.restore();

      // top cap + lip
      ctx.fillStyle = P.stoneLite;
      ctx.fillRect(x, y, w, 5);
      ctx.fillStyle = P.stone;
      ctx.fillRect(x, y + 5, w, 4);
      ctx.fillStyle = 'rgba(60,44,26,0.35)';
      ctx.fillRect(x, y + 9, w, 3);

      if (isGround) {
        // depth: the street darkens as it drops away from the light
        if (!pl._grad) {
          const g = ctx.createLinearGradient(0, 0, 0, 120);
          g.addColorStop(0, 'rgba(46,30,16,0)');
          g.addColorStop(0.45, 'rgba(40,25,12,0.42)');
          g.addColorStop(1, 'rgba(22,13,6,0.85)');
          pl._grad = g;
        }
        ctx.save();
        ctx.translate(x, y + 14);
        ctx.fillStyle = pl._grad;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
        // weeds pushing through the joints
        ctx.strokeStyle = 'rgba(74,104,58,0.8)';
        ctx.lineWidth = 1.6;
        ctx.lineCap = 'round';
        for (const t of pl.tufts) {
          for (let b = -1; b <= 1; b++) {
            ctx.beginPath();
            ctx.moveTo(x + t, y);
            ctx.quadraticCurveTo(x + t + b * 2, y - 5, x + t + b * 4.5, y - 8.5);
            ctx.stroke();
          }
        }
      }

      if (!isGround) {
        // corbel brackets under a floating block
        ctx.fillStyle = P.stoneDark;
        for (let bx = x + 8; bx < x + w - 10; bx += 34) {
          ctx.beginPath();
          ctx.moveTo(bx, y + h);
          ctx.lineTo(bx + 14, y + h);
          ctx.lineTo(bx + 9, y + h + 7);
          ctx.lineTo(bx + 5, y + h + 7);
          ctx.closePath();
          ctx.fill();
        }
        ctx.strokeStyle = P.stoneEdge;
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
      } else {
        // cobbled street edge
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        for (let cx = x; cx < x + w; cx += 18) ctx.fillRect(cx + 6, y + 14, 2, 6);
      }
    },

    _roof(ctx, pl) {
      const { x, y, w, h } = pl;
      ctx.fillStyle = P.roofDark;
      ctx.fillRect(x, y + 8, w, h - 8);
      ctx.fillStyle = P.roof;
      ctx.fillRect(x, y, w, 9);
      // clay tile scallops
      ctx.fillStyle = P.roofDark;
      for (let tx = x + 3; tx < x + w - 3; tx += 11) {
        ctx.beginPath();
        ctx.arc(tx + 4, y + 9, 4.5, 0, Math.PI);
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,225,180,0.35)';
      ctx.fillRect(x, y, w, 2.5);
      ctx.fillStyle = P.stoneDark;
      ctx.fillRect(x + 2, y + 16, w - 4, Math.max(0, h - 18));
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      for (let sx = x + 10; sx < x + w - 6; sx += 26) ctx.fillRect(sx, y + 18, 2, Math.max(0, h - 22));
    },

    _awning(ctx, pl, time) {
      const { x, y, w, h } = pl;
      const wave = Math.sin(time * 2 + x * 0.02) * 2;
      ctx.fillStyle = P.carpetA;
      ctx.fillRect(x, y, w, 7);
      // stripes
      for (let sx = x; sx < x + w; sx += 22) {
        ctx.fillStyle = P.carpetC;
        ctx.fillRect(sx, y, 11, 7);
      }
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(x, y + 7, w, 3);
      // scalloped fringe
      ctx.fillStyle = P.carpetA;
      for (let fx = x; fx < x + w - 6; fx += 12) {
        ctx.beginPath();
        ctx.arc(fx + 6, y + 10 + wave * 0.3, 6, 0, Math.PI);
        ctx.fill();
      }
      // poles
      ctx.strokeStyle = P.woodDark;
      ctx.lineWidth = 3;
      [x + 4, x + w - 4].forEach((px) => {
        ctx.beginPath();
        ctx.moveTo(px, y + 8);
        ctx.lineTo(px, y + h);
        ctx.stroke();
      });
    },

    _wood(ctx, pl) {
      const { x, y, w, h } = pl;
      ctx.fillStyle = P.woodDark;
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = P.wood;
      ctx.fillRect(x, y, w, Math.max(4, h - 4));
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 1.5;
      for (let px = x + 16; px < x + w; px += 30) {
        ctx.beginPath();
        ctx.moveTo(px, y);
        ctx.lineTo(px, y + h);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(255,230,190,0.25)';
      ctx.fillRect(x, y, w, 2);
    },

    /* ------------------------------------------------------------- hazards */
    drawSpikes(ctx, hz, time) {
      const { x, y, w } = hz;
      // iron spikes driven into a weathered timber beam
      ctx.fillStyle = 'rgba(40,24,10,0.35)';
      ctx.fillRect(x - 2, y + 19, w + 4, 4);
      ctx.fillStyle = P.woodDark;
      ctx.fillRect(x, y + 13, w, 8);
      ctx.fillStyle = P.wood;
      ctx.fillRect(x, y + 13, w, 3);
      for (let sx = x + 2; sx < x + w - 2; sx += 14) {
        ctx.beginPath();
        ctx.moveTo(sx, y + 15);
        ctx.lineTo(sx + 7, y - 2);
        ctx.lineTo(sx + 14, y + 15);
        ctx.closePath();
        ctx.fillStyle = '#c3c9cf';
        ctx.fill();
        ctx.fillStyle = '#6e7883';
        ctx.beginPath();
        ctx.moveTo(sx + 7, y - 2);
        ctx.lineTo(sx + 14, y + 15);
        ctx.lineTo(sx + 8.5, y + 15);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.beginPath();
        ctx.moveTo(sx + 7, y - 2);
        ctx.lineTo(sx + 4.6, y + 6);
        ctx.lineTo(sx + 6.2, y + 6);
        ctx.closePath();
        ctx.fill();
      }
    },

    drawBrazier(ctx, hz, time) {
      const { x, y, w } = hz;
      const cx = x + w / 2;
      // stone bowl on a stem
      ctx.fillStyle = P.stoneDark;
      ctx.fillRect(cx - 5, y + 10, 10, 26);
      ctx.fillStyle = P.stoneMid;
      ctx.fillRect(cx - 16, y + 34, 32, 8);
      ctx.fillStyle = P.stone;
      ctx.beginPath();
      ctx.moveTo(cx - 17, y + 4);
      ctx.lineTo(cx + 17, y + 4);
      ctx.lineTo(cx + 11, y + 16);
      ctx.lineTo(cx - 11, y + 16);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = P.stoneEdge;
      ctx.fillRect(cx - 18, y + 2, 36, 4);

      const f = hz.flame; // 0..1 flame strength
      if (f > 0.01) {
        const hgt = 42 * f;
        for (let i = 0; i < 3; i++) {
          const t = time * (6 + i * 2.4) + i * 2;
          const wob = Math.sin(t) * 4 * f;
          const s = 1 - i * 0.26;
          ctx.fillStyle = [P.fireDeep, P.fire, P.fireHot][i];
          ctx.beginPath();
          ctx.moveTo(cx - 11 * s, y + 6);
          ctx.quadraticCurveTo(cx - 13 * s + wob, y + 6 - hgt * 0.55 * s, cx + wob * 0.6, y + 6 - hgt * s);
          ctx.quadraticCurveTo(cx + 13 * s + wob, y + 6 - hgt * 0.55 * s, cx + 11 * s, y + 6);
          ctx.closePath();
          ctx.fill();
        }
      }
    },

    /** Brass censer swinging on its chain across the alley. */
    drawCenser(ctx, hz, time) {
      const ex = hz.x + Math.sin(hz.angle) * hz.len;
      const ey = hz.y + Math.cos(hz.angle) * hz.len;
      ctx.strokeStyle = P.woodDark;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(hz.x - 34, hz.y - 3);
      ctx.lineTo(hz.x + 34, hz.y - 3);
      ctx.stroke();
      ctx.strokeStyle = '#8d7a4a';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(hz.x, hz.y);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      ctx.save();
      ctx.translate(ex, ey);
      ctx.rotate(hz.angle);
      ctx.fillStyle = P.goldDark;
      ctx.beginPath();
      ctx.moveTo(-13, 0); ctx.lineTo(13, 0); ctx.lineTo(9, 15); ctx.lineTo(-9, 15);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = P.gold;
      ctx.fillRect(-14, -3, 28, 4);
      ctx.fillStyle = P.fireDeep;
      ctx.beginPath(); ctx.ellipse(0, 2, 9, 3.4, 0, 0, U.TAU); ctx.fill();
      ctx.fillStyle = P.fire;
      const f = 8 + Math.sin(time * 9) * 3;
      ctx.beginPath();
      ctx.moveTo(-6, 1);
      ctx.quadraticCurveTo(0, -f, 6, 1);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = 'rgba(240,225,200,0.16)';
      for (let i = 0; i < 3; i++) {
        const t = (time * 0.6 + i * 0.33) % 1;
        ctx.beginPath();
        ctx.arc(ex + Math.sin(time + i) * 8, ey - 10 - t * 46, 5 + t * 9, 0, U.TAU);
        ctx.fill();
      }
    },

    /** Stone block wedged overhead — it lets go when you walk beneath it. */
    drawFaller(ctx, hz, time) {
      const shake = hz.state === 'shake' ? Math.sin(time * 60) * 2.4 : 0;
      const { x, y, w, h } = hz;
      if (hz.state !== 'fallen') {
        ctx.fillStyle = P.woodDark;
        ctx.fillRect(x - 4, hz.homeY - 8, w + 8, 6);
      }
      ctx.save();
      ctx.translate(x + shake, y);
      ctx.fillStyle = P.stoneDark;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = P.stoneMid;
      ctx.fillRect(2, 2, w - 4, h - 6);
      ctx.fillStyle = P.stoneLite;
      ctx.fillRect(2, 2, w - 4, 4);
      ctx.strokeStyle = P.stoneEdge;
      ctx.lineWidth = 1.6;
      ctx.strokeRect(1, 1, w - 2, h - 2);
      ctx.beginPath();
      ctx.moveTo(w * 0.3, 4); ctx.lineTo(w * 0.42, h - 4);
      ctx.stroke();
      ctx.restore();
    },

    /** Column of fire out of the paving: a warning ring, then the burn. */
    drawPillar(ctx, hz, time) {
      const cx = hz.x + hz.w / 2;
      const gy = ICH.C.GROUND_Y;
      if (hz.warn > 0) {
        const k = 1 - hz.warn / 0.75;
        ctx.save();
        ctx.globalAlpha = 0.4 + 0.5 * Math.abs(Math.sin(time * 22));
        ctx.strokeStyle = '#ff9d21';
        ctx.lineWidth = 2 + k * 2;
        ctx.beginPath();
        ctx.ellipse(cx, gy - 3, hz.w * 0.6, 7, 0, 0, U.TAU);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,157,33,' + (0.25 + k * 0.4).toFixed(2) + ')';
        ctx.beginPath();
        ctx.ellipse(cx, gy - 3, hz.w * 0.45 * k, 5 * k, 0, 0, U.TAU);
        ctx.fill();
        ctx.restore();
        return;
      }
      if (hz.live <= 0) return;
      const grow = U.clamp((0.85 - hz.live) * 8, 0, 1);
      const h = hz.h * grow;
      ctx.save();
      const g = ctx.createLinearGradient(0, gy, 0, gy - h);
      g.addColorStop(0, '#fff0b0');
      g.addColorStop(0.4, '#ff9d21');
      g.addColorStop(1, 'rgba(224,64,15,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(cx - hz.w / 2, gy);
      ctx.quadraticCurveTo(cx - hz.w / 2 + Math.sin(time * 12) * 6, gy - h * 0.6, cx - 5, gy - h);
      ctx.lineTo(cx + 5, gy - h);
      ctx.quadraticCurveTo(cx + hz.w / 2 + Math.sin(time * 12 + 2) * 6, gy - h * 0.6, cx + hz.w / 2, gy);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,246,216,0.85)';
      ctx.beginPath();
      ctx.moveTo(cx - 8, gy);
      ctx.quadraticCurveTo(cx + Math.sin(time * 16) * 5, gy - h * 0.55, cx, gy - h * 0.75);
      ctx.quadraticCurveTo(cx + 4, gy - h * 0.4, cx + 8, gy);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    },

    /** Hamam steam vent — it will not hurt you, it will launch you. */
    drawSteam(ctx, hz, time) {
      const { x, y, w } = hz;
      ctx.fillStyle = P.steelDark;
      ctx.fillRect(x, y, w, 8);
      ctx.fillStyle = '#4a5a5c';
      for (let gx = x + 3; gx < x + w - 3; gx += 7) ctx.fillRect(gx, y + 1, 4, 6);
      ctx.fillStyle = P.stoneEdge;
      ctx.fillRect(x - 3, y - 3, w + 6, 4);
      if (hz.power > 0.05) {
        const hgt = 150 * hz.power;
        for (let i = 0; i < 6; i++) {
          const t = ((time * 1.4 + i * 0.17) % 1);
          const yy = y - t * hgt;
          ctx.globalAlpha = (1 - t) * 0.5 * hz.power;
          ctx.fillStyle = '#eef8f8';
          ctx.beginPath();
          ctx.arc(x + w / 2 + Math.sin(time * 3 + i * 2) * 10 * t, yy, 7 + t * 18, 0, U.TAU);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
    },

    drawJar(ctx, j, time) {
      const { x, y, w, h } = j;
      const cx = x + w / 2;
      const bob = Math.sin(time * 2 + x) * 0.6;
      ctx.save();
      ctx.translate(cx, y + h + bob);
      ctx.fillStyle = '#a86a3c';
      ctx.beginPath();
      ctx.moveTo(-w * 0.24, 0);
      ctx.quadraticCurveTo(-w * 0.62, -h * 0.45, -w * 0.34, -h * 0.82);
      ctx.lineTo(-w * 0.2, -h);
      ctx.lineTo(w * 0.2, -h);
      ctx.quadraticCurveTo(w * 0.62, -h * 0.45, w * 0.24, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#c98a52';
      ctx.beginPath();
      ctx.ellipse(-w * 0.1, -h * 0.55, w * 0.16, h * 0.24, -0.3, 0, U.TAU);
      ctx.fill();
      ctx.fillStyle = P.carpetB;
      ctx.fillRect(-w * 0.3, -h * 0.62, w * 0.6, 4);
      ctx.fillStyle = '#7c4a24';
      ctx.fillRect(-w * 0.22, -h - 3, w * 0.44, 5);
      ctx.restore();
    },

    /* ------------------------------------------------------------ pickups */
    drawPickup(ctx, p, time) {
      const bob = Math.sin(time * 3.2 + p.phase) * 3.5;
      const cx = p.x + p.w / 2;
      const cy = p.y + p.h / 2 + bob;
      ctx.save();
      ctx.translate(cx, cy);

      if (p.type === 'coin') {
        const sq = Math.cos(time * 4 + p.phase);
        ctx.save();
        ctx.scale(Math.max(0.16, Math.abs(sq)), 1);
        ctx.fillStyle = P.goldDark;
        ctx.beginPath(); ctx.arc(0, 0, 9, 0, U.TAU); ctx.fill();
        ctx.fillStyle = P.gold;
        ctx.beginPath(); ctx.arc(0, 0, 7.4, 0, U.TAU); ctx.fill();
        ctx.fillStyle = P.goldDark;
        ctx.beginPath(); ctx.arc(0, 0, 3.4, 0, U.TAU); ctx.fill();
        ctx.restore();
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fillRect(-1.5, -6, 2, 3);
      } else if (p.type === 'gem') {
        ctx.rotate(Math.sin(time * 1.7 + p.phase) * 0.22);
        ctx.fillStyle = '#1c6f86';
        ctx.beginPath();
        ctx.moveTo(0, -11); ctx.lineTo(9, -2); ctx.lineTo(0, 12); ctx.lineTo(-9, -2);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = P.gem;
        ctx.beginPath();
        ctx.moveTo(0, -11); ctx.lineTo(9, -2); ctx.lineTo(0, 3); ctx.lineTo(-9, -2);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.beginPath(); ctx.moveTo(-3, -8); ctx.lineTo(0, -10); ctx.lineTo(-1, -3); ctx.closePath(); ctx.fill();
      } else if (p.type === 'nar') {
        // pomegranate — throwable ammo
        ctx.fillStyle = '#8c1c22';
        ctx.beginPath(); ctx.arc(0, 1, 9.5, 0, U.TAU); ctx.fill();
        ctx.fillStyle = '#c8262e';
        ctx.beginPath(); ctx.arc(-1, 0, 8.2, 0, U.TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,150,150,0.5)';
        ctx.beginPath(); ctx.arc(-3.4, -3.4, 2.6, 0, U.TAU); ctx.fill();
        ctx.strokeStyle = '#6d4b12';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -8); ctx.lineTo(0, -12);
        ctx.moveTo(-3, -12); ctx.lineTo(0, -9); ctx.lineTo(3, -12);
        ctx.stroke();
      } else if (p.type === 'tea') {
        // armudu glass — heals
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        ctx.beginPath();
        ctx.moveTo(-6, -10);
        ctx.quadraticCurveTo(-9, -2, -4, 3);
        ctx.quadraticCurveTo(-7, 8, -4, 11);
        ctx.lineTo(4, 11);
        ctx.quadraticCurveTo(7, 8, 4, 3);
        ctx.quadraticCurveTo(9, -2, 6, -10);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#b5541c';
        ctx.beginPath();
        ctx.moveTo(-5, -6);
        ctx.quadraticCurveTo(-8, -1, -3.4, 2.6);
        ctx.quadraticCurveTo(-6, 7, -3.4, 9.6);
        ctx.lineTo(3.4, 9.6);
        ctx.quadraticCurveTo(6, 7, 3.4, 2.6);
        ctx.quadraticCurveTo(8, -1, 5, -6);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = P.gold;
        ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(-6.5, -10); ctx.lineTo(6.5, -10); ctx.stroke();
        ctx.fillStyle = P.gold;
        ctx.fillRect(-6, 11, 12, 2.5);
      } else if (p.type === 'carpet') {
        ctx.rotate(Math.sin(time * 2 + p.phase) * 0.18);
        ctx.fillStyle = P.carpetA;
        ctx.fillRect(-13, -8, 26, 16);
        ctx.fillStyle = P.carpetB;
        ctx.fillRect(-10, -5, 20, 10);
        ctx.fillStyle = P.carpetC;
        buta(ctx, 0, 0, 4.5, 0);
        ctx.fill();
        ctx.strokeStyle = P.carpetC;
        ctx.lineWidth = 1.2;
        ctx.strokeRect(-13, -8, 26, 16);
        ctx.fillStyle = P.carpetC;
        for (let fx = -13; fx <= 12; fx += 4) { ctx.fillRect(fx, 8, 1.6, 3.5); ctx.fillRect(fx, -11.5, 1.6, 3.5); }
      } else if (p.type === 'paxlava') {
        // a diamond of Baku baklava, walnuts and all
        ctx.rotate(Math.PI / 4);
        ctx.fillStyle = '#a5651f';
        ctx.fillRect(-8.5, -8.5, 17, 17);
        ctx.fillStyle = '#e0a63a';
        ctx.fillRect(-7, -7, 14, 14);
        ctx.fillStyle = '#f6d489';
        ctx.fillRect(-7, -7, 14, 4);
        ctx.fillStyle = '#6b4416';
        ctx.beginPath(); ctx.arc(0, 0, 3, 0, U.TAU); ctx.fill();
        ctx.fillStyle = '#c98a3f';
        ctx.beginPath(); ctx.arc(-0.7, -0.7, 2.1, 0, U.TAU); ctx.fill();
      } else if (p.type === 'zefer') {
        // saffron threads in a twist of paper — the priciest thing on the row
        ctx.rotate(Math.sin(time * 1.6 + p.phase) * 0.16);
        ctx.fillStyle = '#f3ead2';
        ctx.beginPath();
        ctx.moveTo(-9, 8); ctx.lineTo(9, 8); ctx.lineTo(6, -6); ctx.lineTo(-6, -6);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#ddd0b0';
        ctx.fillRect(-9, 6, 18, 3);
        ctx.strokeStyle = '#e2540f';
        ctx.lineWidth = 1.5;
        ctx.lineCap = 'round';
        for (let i = -2; i <= 2; i++) {
          ctx.beginPath();
          ctx.moveTo(i * 2.6, -4);
          ctx.quadraticCurveTo(i * 3.4 + 1, -9, i * 3 - 1, -12);
          ctx.stroke();
        }
        ctx.fillStyle = P.gold;
        ctx.fillRect(-7, 2, 14, 2);
      }

      ctx.restore();

      // sparkle halo for the rarer pickups
      if (p.type === 'gem' || p.type === 'carpet' || p.type === 'tea' || p.type === 'zefer') {
        const a = 0.18 + 0.12 * Math.sin(time * 4 + p.phase);
        ctx.globalAlpha = a;
        ctx.fillStyle = p.type === 'gem' ? P.gem : p.type === 'tea' ? '#ffd9a0'
          : p.type === 'zefer' ? '#ff7a2a' : P.carpetC;
        ctx.beginPath(); ctx.arc(cx, cy, 17, 0, U.TAU); ctx.fill();
        ctx.globalAlpha = 1;
      }
    },

    /* ------------------------------------------------------------ enemies */
    drawGuard(ctx, e, time) {
      const cx = e.x + e.w / 2;
      const by = e.y + e.h;
      const face = e.dir;
      const phase = e.animT * 8;
      const walk = e.state === 'walk' ? 1 : 0;
      ctx.save();
      ctx.translate(cx, by);
      ctx.scale(face, 1);
      if (e.hurtT > 0) ctx.globalAlpha = 0.45 + 0.55 * Math.abs(Math.sin(e.hurtT * 40));

      const hipY = -22;
      const shY = -40;
      const robe = e.elite ? '#4a2f6b' : P.guardRobe;
      const robeD = e.elite ? '#31204a' : P.guardRobeDark;

      // back leg
      let [kx, ky] = seg(ctx, 0, hipY, -0.5 - Math.sin(phase) * 0.5 * walk, 12, 8, robeD);
      seg(ctx, kx, ky, -0.2 + Math.max(0, Math.sin(phase)) * 0.5 * walk, 12, 7, robeD);
      // front leg
      [kx, ky] = seg(ctx, 0, hipY, 0.5 + Math.sin(phase + Math.PI) * 0.5 * walk, 12, 8, robe);
      seg(ctx, kx, ky, 0.15 + Math.max(0, Math.sin(phase + Math.PI)) * 0.5 * walk, 12, 7, robe);

      // robe body
      ctx.fillStyle = robe;
      ctx.beginPath();
      ctx.moveTo(-9, shY);
      ctx.lineTo(9, shY);
      ctx.lineTo(13, hipY + 6);
      ctx.lineTo(-13, hipY + 6);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = robeD;
      ctx.fillRect(-13, hipY - 1, 26, 5);
      ctx.fillStyle = P.gold;
      ctx.fillRect(-13, hipY - 1, 26, 2);

      // head + turban
      ctx.fillStyle = P.skin;
      ctx.beginPath(); ctx.arc(2, shY - 9, 8, 0, U.TAU); ctx.fill();
      ctx.fillStyle = P.ink;
      ctx.beginPath(); ctx.arc(5, shY - 10, 1.4, 0, U.TAU); ctx.fill();
      ctx.fillStyle = '#3a2a20';
      ctx.beginPath();
      ctx.ellipse(1, shY - 4, 8, 5, 0, 0, Math.PI);
      ctx.fill();
      ctx.fillStyle = e.elite ? '#e7d9a4' : P.guardCloth;
      ctx.beginPath();
      ctx.ellipse(1, shY - 15, 11, 7.5, 0, 0, U.TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.beginPath();
      ctx.ellipse(1, shY - 13, 11, 3.2, 0, 0, Math.PI);
      ctx.fill();
      if (e.elite) {
        ctx.fillStyle = P.gold;
        ctx.beginPath(); ctx.arc(9, shY - 18, 3, 0, U.TAU); ctx.fill();
      }

      // sword arm — winds up then swings
      let armA = -0.9 + Math.sin(phase) * 0.35 * walk;
      if (e.state === 'wind') armA = -2.1 - e.attackT * 0.6;
      if (e.state === 'swing') armA = 1.4 - e.attackT * 3.2;
      const [ex, ey] = seg(ctx, 4, shY + 2, armA, 11, 7, P.skin);
      const [hx, hy] = seg(ctx, ex, ey, armA + 0.5, 9, 6, P.skin);
      // scimitar
      ctx.save();
      ctx.translate(hx, hy);
      ctx.rotate(armA + 1.0);
      ctx.fillStyle = P.goldDark;
      ctx.fillRect(-3, -4, 6, 9);
      ctx.strokeStyle = P.steel;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, 3);
      ctx.quadraticCurveTo(11, 8, 24, -2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(2, 2);
      ctx.quadraticCurveTo(11, 6, 22, -2);
      ctx.stroke();
      ctx.restore();

      ctx.restore();
      ctx.globalAlpha = 1;
    },

    drawSnake(ctx, e, time) {
      const cx = e.x + e.w / 2;
      const by = e.y + e.h;
      ctx.save();
      ctx.translate(cx, by);
      ctx.scale(e.dir, 1);
      if (e.hurtT > 0) ctx.globalAlpha = 0.5;
      ctx.strokeStyle = P.snakeDark;
      ctx.lineWidth = 11;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i <= 8; i++) {
        const t = i / 8;
        const x = -20 + t * 40;
        const y = -6 + Math.sin(time * 11 - t * 5) * 4 * (1 - t * 0.4);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.strokeStyle = P.snake;
      ctx.lineWidth = 7;
      ctx.stroke();
      // head
      const hy = -6 + Math.sin(time * 11 - 5) * 2.4;
      ctx.fillStyle = P.snake;
      ctx.beginPath();
      ctx.ellipse(22, hy - 3, 9, 6, -0.25, 0, U.TAU);
      ctx.fill();
      ctx.fillStyle = '#f5e35a';
      ctx.beginPath(); ctx.arc(25, hy - 5, 1.9, 0, U.TAU); ctx.fill();
      ctx.strokeStyle = '#e33';
      ctx.lineWidth = 1.4;
      const tongue = (Math.sin(time * 7) > 0.5) ? 8 : 3;
      ctx.beginPath();
      ctx.moveTo(30, hy - 1); ctx.lineTo(30 + tongue, hy);
      ctx.stroke();
      ctx.restore();
      ctx.globalAlpha = 1;
    },

    drawCrow(ctx, e, time) {
      const cx = e.x + e.w / 2;
      const cy = e.y + e.h / 2;
      const flap = Math.sin(time * 14 + e.phase);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(e.dir, 1);
      if (e.hurtT > 0) ctx.globalAlpha = 0.5;
      // wings behind
      ctx.fillStyle = '#1c1c25';
      ctx.beginPath();
      ctx.moveTo(-2, -2);
      ctx.quadraticCurveTo(-20, -8 - flap * 12, -26, 2 - flap * 6);
      ctx.quadraticCurveTo(-14, 2, -2, 4);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-2, -2);
      ctx.quadraticCurveTo(16, -8 - flap * 12, 22, 2 - flap * 6);
      ctx.quadraticCurveTo(12, 2, -2, 4);
      ctx.closePath();
      ctx.fill();
      // body
      ctx.fillStyle = P.crow;
      ctx.beginPath();
      ctx.ellipse(0, 0, 12, 8, 0.12, 0, U.TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(10, -4, 6, 0, U.TAU);
      ctx.fill();
      ctx.fillStyle = P.crowBeak;
      ctx.beginPath();
      ctx.moveTo(15, -5); ctx.lineTo(24, -3); ctx.lineTo(15, -1);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#f2d24a';
      ctx.beginPath(); ctx.arc(12, -6, 1.7, 0, U.TAU); ctx.fill();
      ctx.restore();
      ctx.globalAlpha = 1;
    },

    /* ---- küçə iti: a lean Old City street dog, all ribs and intent */
    drawDog(ctx, e, time) {
      const cx = e.x + e.w / 2;
      const by = e.y + e.h;
      const run = e.state === 'charge' ? 16 : 8;
      const ph = e.animT * run;
      ctx.save();
      ctx.translate(cx, by);
      ctx.scale(e.dir, 1);
      if (e.hurtT > 0) ctx.globalAlpha = 0.5;
      const body = e.elite ? '#4a3a30' : '#9a6b3c';
      const dark = e.elite ? '#31241d' : '#6d4623';
      // legs
      for (let i = 0; i < 2; i++) {
        const off = i * Math.PI;
        seg(ctx, -12, -14, Math.sin(ph + off) * 0.85, 8, 4, dark);
        seg(ctx, 12, -14, Math.sin(ph + off + 1.2) * 0.85, 8, 4, dark);
      }
      for (let i = 0; i < 2; i++) {
        const off = i * Math.PI + 0.6;
        seg(ctx, -10, -14, Math.sin(ph + off) * 0.9, 9, 4.6, body);
        seg(ctx, 13, -14, Math.sin(ph + off + 1.2) * 0.9, 9, 4.6, body);
      }
      // barrel body
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.ellipse(0, -20, 16, 9, 0, 0, U.TAU);
      ctx.fill();
      ctx.fillStyle = dark;
      ctx.beginPath();
      ctx.ellipse(-2, -16, 13, 5, 0, 0, Math.PI);
      ctx.fill();
      // tail
      ctx.strokeStyle = body;
      ctx.lineWidth = 3.4;
      ctx.beginPath();
      ctx.moveTo(-15, -22);
      ctx.quadraticCurveTo(-25, -26 + Math.sin(time * 9) * 5, -22, -34 + Math.sin(time * 9) * 4);
      ctx.stroke();
      // head
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.ellipse(17, -26, 8, 7, 0, 0, U.TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(22, -25); ctx.lineTo(31, -23); ctx.lineTo(22, -20);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = dark;
      ctx.beginPath();
      ctx.moveTo(13, -32); ctx.lineTo(15, -40); ctx.lineTo(20, -31);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#f5e35a';
      ctx.beginPath(); ctx.arc(21, -28, 1.7, 0, U.TAU); ctx.fill();
      if (e.state === 'charge') {
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.moveTo(24, -22); ctx.lineTo(27, -18); ctx.lineTo(29, -22);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
      ctx.globalAlpha = 1;
    },

    /* ---- əqrəb: scorpion out of the warm stones */
    drawScorpion(ctx, e, time) {
      const cx = e.x + e.w / 2;
      const by = e.y + e.h;
      const ph = e.animT * 6;
      ctx.save();
      ctx.translate(cx, by);
      ctx.scale(e.dir, 1);
      if (e.hurtT > 0) ctx.globalAlpha = 0.5;
      ctx.strokeStyle = '#5b3212';
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      for (let i = -1; i <= 1; i++) {
        const a = Math.sin(ph + i) * 0.4;
        ctx.beginPath();
        ctx.moveTo(i * 6, -6);
        ctx.lineTo(i * 6 - 7, -1 + a * 3);
        ctx.moveTo(i * 6, -6);
        ctx.lineTo(i * 6 + 7, -1 - a * 3);
        ctx.stroke();
      }
      ctx.fillStyle = '#8a4a17';
      ctx.beginPath();
      ctx.ellipse(0, -9, 12, 6, 0, 0, U.TAU);
      ctx.fill();
      ctx.fillStyle = '#5b3212';
      ctx.beginPath();
      ctx.ellipse(2, -11, 9, 3.4, 0, 0, U.TAU);
      ctx.fill();
      // pincers
      ctx.strokeStyle = '#8a4a17';
      ctx.lineWidth = 3;
      [-1, 1].forEach((s) => {
        ctx.beginPath();
        ctx.moveTo(9, -10 + s * 3);
        ctx.quadraticCurveTo(18, -11 + s * 5, 21, -13 + s * 2);
        ctx.stroke();
      });
      // stinger tail arcing overhead
      ctx.strokeStyle = '#8a4a17';
      ctx.lineWidth = 3.4;
      ctx.beginPath();
      ctx.moveTo(-10, -10);
      ctx.quadraticCurveTo(-22, -16, -16, -26 + Math.sin(time * 4) * 2);
      ctx.stroke();
      ctx.fillStyle = '#2f1a08';
      ctx.beginPath();
      ctx.moveTo(-16, -26); ctx.lineTo(-9, -30); ctx.lineTo(-15, -22);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.globalAlpha = 1;
    },

    /* ---- oxçu: archer on the wall */
    drawArcher(ctx, e, time) {
      const cx = e.x + e.w / 2;
      const by = e.y + e.h;
      ctx.save();
      ctx.translate(cx, by);
      ctx.scale(e.dir, 1);
      if (e.hurtT > 0) ctx.globalAlpha = 0.5;
      const hipY = -24, shY = -42;
      const draw = e.state === 'draw' ? U.clamp(1 - e.attackT / 0.62, 0, 1) : 0;

      seg(ctx, 0, hipY, -0.36, 12, 7, '#5b4a2f');
      seg(ctx, 0, hipY, 0.36, 12, 7, '#6d5a38');
      seg(ctx, -1, hipY + 11, -0.2, 12, 6, '#5b4a2f');
      seg(ctx, 1, hipY + 11, 0.2, 12, 6, '#6d5a38');

      ctx.fillStyle = '#7a3f2a';
      ctx.beginPath();
      ctx.moveTo(-9, shY); ctx.lineTo(9, shY); ctx.lineTo(12, hipY + 4); ctx.lineTo(-12, hipY + 4);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#4d2718';
      ctx.fillRect(-12, hipY - 1, 24, 4);
      // quiver
      ctx.fillStyle = '#4a3a22';
      ctx.fillRect(-14, shY + 2, 7, 18);
      ctx.strokeStyle = '#e8dcc0';
      ctx.lineWidth = 1.4;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(-11 + i * 2, shY + 2);
        ctx.lineTo(-13 + i * 2, shY - 7);
        ctx.stroke();
      }
      // head + wrapped scarf
      ctx.fillStyle = P.skin;
      ctx.beginPath(); ctx.arc(2, shY - 9, 7.6, 0, U.TAU); ctx.fill();
      ctx.fillStyle = P.ink;
      ctx.beginPath(); ctx.arc(5.4, shY - 10, 1.4, 0, U.TAU); ctx.fill();
      ctx.fillStyle = '#c9b68d';
      ctx.beginPath();
      ctx.ellipse(1, shY - 15, 9.4, 5.6, 0, 0, U.TAU);
      ctx.fill();
      ctx.fillRect(-8, shY - 12, 8, 12);

      // bow, drawn back as he aims
      ctx.save();
      ctx.translate(12, shY + 2);
      ctx.strokeStyle = '#7a5a2a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 17, -1.25, 1.25);
      ctx.stroke();
      ctx.strokeStyle = '#efe6cc';
      ctx.lineWidth = 1.2;
      const pull = 4 + draw * 11;
      ctx.beginPath();
      ctx.moveTo(Math.cos(-1.25) * 17, Math.sin(-1.25) * 17);
      ctx.lineTo(-pull, 0);
      ctx.lineTo(Math.cos(1.25) * 17, Math.sin(1.25) * 17);
      ctx.stroke();
      if (draw > 0) {
        ctx.strokeStyle = '#cbb68f';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-pull, 0); ctx.lineTo(20, 0);
        ctx.stroke();
      }
      ctx.restore();
      seg(ctx, 2, shY + 2, 1.25 - draw * 0.5, 12, 5.6, P.skin);
      ctx.restore();
      ctx.globalAlpha = 1;
    },

    /* ---- yarasa: bat, asleep on the vault until you disturb it */
    drawBat(ctx, e, time) {
      const cx = e.x + e.w / 2;
      const cy = e.y + e.h / 2;
      const hanging = e.state === 'hang';
      ctx.save();
      ctx.translate(cx, cy);
      if (hanging) ctx.rotate(Math.PI);
      else ctx.scale(e.dir, 1);
      if (e.hurtT > 0) ctx.globalAlpha = 0.5;
      const flap = hanging ? 0.15 : Math.sin(time * 16 + e.phase);
      ctx.fillStyle = '#3b2b3a';
      [-1, 1].forEach((s) => {
        ctx.beginPath();
        ctx.moveTo(0, -2);
        ctx.quadraticCurveTo(s * 16, -10 - flap * 10, s * 24, 2 - flap * 5);
        ctx.quadraticCurveTo(s * 17, 1, s * 12, 6);
        ctx.quadraticCurveTo(s * 8, 1, 0, 5);
        ctx.closePath();
        ctx.fill();
      });
      ctx.fillStyle = '#57404f';
      ctx.beginPath();
      ctx.ellipse(0, 0, 6.5, 8, 0, 0, U.TAU);
      ctx.fill();
      ctx.beginPath(); ctx.arc(0, -7, 5, 0, U.TAU); ctx.fill();
      ctx.fillStyle = '#3b2b3a';
      [-1, 1].forEach((s) => {
        ctx.beginPath();
        ctx.moveTo(s * 1.5, -11); ctx.lineTo(s * 5.5, -17); ctx.lineTo(s * 5.5, -9);
        ctx.closePath();
        ctx.fill();
      });
      ctx.fillStyle = hanging ? '#8d7a86' : '#ffcf4a';
      ctx.beginPath(); ctx.arc(-2, -7.5, 1.4, 0, U.TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(2, -7.5, 1.4, 0, U.TAU); ctx.fill();
      ctx.restore();
      ctx.globalAlpha = 1;
    },

    /* ---- pəhləvan: the bazaar strongman with a club */
    drawThug(ctx, e, time) {
      const cx = e.x + e.w / 2;
      const by = e.y + e.h;
      const ph = e.animT * 6;
      ctx.save();
      ctx.translate(cx, by);
      ctx.scale(e.dir, 1);
      if (e.hurtT > 0) ctx.globalAlpha = 0.45 + 0.55 * Math.abs(Math.sin(e.hurtT * 40));
      const hipY = -27, shY = -48;
      const walk = e.state === 'walk' ? 1 : 0;

      seg(ctx, -3, hipY, -0.4 - Math.sin(ph) * 0.4 * walk, 14, 10, '#4a3b26');
      seg(ctx, 3, hipY, 0.4 + Math.sin(ph) * 0.4 * walk, 14, 10, '#5c4a30');
      seg(ctx, -4, hipY + 13, -0.15, 13, 9, '#4a3b26');
      seg(ctx, 4, hipY + 13, 0.15, 13, 9, '#5c4a30');

      // bare barrel chest with a sash
      ctx.fillStyle = P.skin;
      ctx.beginPath();
      ctx.moveTo(-14, shY); ctx.lineTo(14, shY); ctx.lineTo(11, hipY + 4); ctx.lineTo(-11, hipY + 4);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = P.skinDark;
      ctx.beginPath(); ctx.ellipse(-5, shY + 9, 6, 5, 0, 0, U.TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(6, shY + 9, 6, 5, 0, 0, U.TAU); ctx.fill();
      ctx.fillStyle = P.carpetA;
      ctx.beginPath();
      ctx.moveTo(-14, shY + 2); ctx.lineTo(-7, shY + 1); ctx.lineTo(12, hipY); ctx.lineTo(6, hipY + 3);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#3f3222';
      ctx.fillRect(-12, hipY - 3, 24, 7);
      ctx.fillStyle = P.gold;
      ctx.fillRect(-4, hipY - 3, 8, 7);

      // head, shaved with a topknot
      ctx.fillStyle = P.skin;
      ctx.beginPath(); ctx.arc(2, shY - 9, 8.4, 0, U.TAU); ctx.fill();
      ctx.fillStyle = P.hat;
      ctx.beginPath(); ctx.ellipse(1, shY - 14, 8.6, 4, 0, Math.PI, U.TAU); ctx.fill();
      ctx.fillRect(-2, shY - 22, 4, 8);
      ctx.fillStyle = P.ink;
      ctx.beginPath(); ctx.arc(6, shY - 10, 1.5, 0, U.TAU); ctx.fill();
      ctx.strokeStyle = P.hat;
      ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.moveTo(1, shY - 4); ctx.lineTo(10, shY - 3); ctx.stroke();

      // club: overhead on the wind-up, into the ground on the slam
      let arm = -0.7;
      if (e.state === 'wind') arm = -2.5 - (0.5 - e.attackT);
      else if (e.state === 'slam') arm = 1.3;
      const el = seg(ctx, 6, shY + 4, arm, 13, 9, P.skin);
      const hd = seg(ctx, el[0], el[1], arm + 0.3, 11, 8, P.skin);
      ctx.save();
      ctx.translate(hd[0], hd[1]);
      ctx.rotate(arm + 0.4);
      ctx.fillStyle = P.woodDark;
      ctx.fillRect(-3.5, -6, 7, 22);
      ctx.fillStyle = P.wood;
      ctx.beginPath();
      ctx.ellipse(0, 22, 9, 11, 0, 0, U.TAU);
      ctx.fill();
      ctx.fillStyle = '#3f2a14';
      for (let i = 0; i < 4; i++) {
        const a = i * 1.6;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * 5, 22 + Math.sin(a) * 6, 1.8, 0, U.TAU);
        ctx.fill();
      }
      ctx.restore();
      ctx.restore();
      ctx.globalAlpha = 1;
    },

    /* ---- a big jar shoved down the street */
    drawRoller(ctx, e, time) {
      const cx = e.x + e.w / 2;
      const cy = e.y + e.h / 2;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(e.spin);
      if (e.hurtT > 0) ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#8d5626';
      ctx.beginPath(); ctx.arc(0, 0, 18, 0, U.TAU); ctx.fill();
      ctx.fillStyle = '#a86a3c';
      ctx.beginPath(); ctx.arc(-1.5, -1.5, 16, 0, U.TAU); ctx.fill();
      ctx.strokeStyle = '#6b3f1a';
      ctx.lineWidth = 2.4;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(0, 0, 16, i * 2.1, i * 2.1 + 1.1);
        ctx.stroke();
      }
      ctx.fillStyle = P.carpetB;
      ctx.fillRect(-16, -3, 32, 5);
      ctx.fillStyle = 'rgba(255,220,180,0.35)';
      ctx.beginPath(); ctx.ellipse(-6, -7, 4.5, 3, -0.4, 0, U.TAU); ctx.fill();
      ctx.restore();
      ctx.globalAlpha = 1;
    },

    drawArrow(ctx, a) {
      if (a.kind && a.kind !== 'arrow') return this._hostile(ctx, a);
      ctx.save();
      ctx.translate(a.x, a.y);
      ctx.rotate(a.rot);
      ctx.strokeStyle = '#7a5a2a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-16, 0); ctx.lineTo(8, 0);
      ctx.stroke();
      ctx.fillStyle = P.steelDark;
      ctx.beginPath();
      ctx.moveTo(8, 0); ctx.lineTo(0, -3.2); ctx.lineTo(0, 3.2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#e8dcc0';
      ctx.beginPath();
      ctx.moveTo(-16, 0); ctx.lineTo(-11, -3.4); ctx.lineTo(-9, 0); ctx.lineTo(-11, 3.4);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    },

    /* ------------------------------------------------------------ player */
    drawPlayer(ctx, p, time) {
      const cx = p.x + p.w / 2;
      const by = p.y + p.h;

      // contact shadow keeps him planted on the street
      if (p.grounded && !p.dead) {
        ctx.globalAlpha = 0.28;
        ctx.fillStyle = '#2a1c0e';
        ctx.beginPath();
        ctx.ellipse(cx, by + 2, 15, 4, 0, 0, U.TAU);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      ctx.save();
      ctx.translate(cx, by);

      // carpet power-up: the rug flies under his feet
      if (p.carpetT > 0) {
        const w = 46 + Math.sin(time * 5) * 2;
        ctx.save();
        ctx.translate(0, 6 + Math.sin(time * 6) * 1.5);
        ctx.rotate(Math.sin(time * 3) * 0.06);
        ctx.fillStyle = P.carpetA;
        ctx.fillRect(-w / 2, -4, w, 9);
        ctx.fillStyle = P.carpetB;
        ctx.fillRect(-w / 2 + 4, -2, w - 8, 5);
        ctx.fillStyle = P.carpetC;
        for (let i = -1; i <= 1; i++) { buta(ctx, i * 12, 0.5, 2.6, 0); ctx.fill(); }
        ctx.fillStyle = P.carpetC;
        for (let fx = -w / 2; fx < w / 2; fx += 5) { ctx.fillRect(fx, 5, 2, 4); ctx.fillRect(fx, -8, 2, 4); }
        ctx.restore();
      }

      // somersault on the second jump, tumble on death
      if (p.dead) ctx.rotate(-p.facing * p.deadT * 7);
      else if (p.flipT > 0) {
        const k = 1 - p.flipT / 0.44;
        ctx.translate(0, -26);
        ctx.rotate(p.facing * U.ease.inOutSine(k) * U.TAU);
        ctx.translate(0, 26);
      }

      // the skeleton below is authored for a 50px figure; the hitbox is 56.
      // squash and stretch rides on top of that scale.
      const face = Math.abs(p.faceVis) < 0.22 ? Math.sign(p.faceVis || 1) * 0.22 : p.faceVis;
      ctx.scale(face * 1.13 * p.sx, 1.13 * p.sy);
      if (p.invulT > 0 && Math.floor(p.invulT * 22) % 2 === 0) ctx.globalAlpha = 0.35;

      const hipY = -22;
      const shY = -39;
      const st = p.state;
      const phase = p.animT * (7.5 + Math.abs(p.vx) * 0.016);
      const grounded = p.grounded;
      const sliding = st === 'slide';

      const landK = p.landT > 0 ? p.landT / (0.16 + p.landPow * 0.12) : 0;
      const turnK = p.turnT > 0 ? p.turnT / 0.22 : 0;

      let lean = U.clamp(p.vx * 0.00042, -0.2, 0.2) * p.facing;
      if (sliding) lean = 0.55;
      if (st === 'rope') lean = U.clamp(p.ropeOmega * 0.6, -0.5, 0.5) * p.facing;
      if (turnK > 0) lean -= turnK * 0.34;             // heels dug in against the skid
      if (p.hurtT > 0) lean -= p.hurtT * 0.9;          // knocked onto his back foot
      if (p.slashT > 0) {
        // shoulders swing through the cut
        const k = 1 - p.slashT / p.slashDur;
        lean += Math.sin(Math.PI * U.clamp(k * 1.15, 0, 1)) * 0.2;
      }

      ctx.rotate(lean);

      const skin = P.skin;
      let thighF, kneeF, thighB, kneeB, armF, elbowF, armB, elbowB;

      if (sliding) {
        thighF = 1.45; kneeF = 0.5; thighB = 1.0; kneeB = 1.5;
        armF = -1.6; elbowF = 0.3; armB = 0.9; elbowB = 0.4;
      } else if (st === 'rope') {
        thighF = 0.35 + Math.sin(time * 5) * 0.2; kneeF = 0.7; thighB = -0.3; kneeB = 0.5;
        armF = -2.9; elbowF = 0.05; armB = -2.7; elbowB = 0.05;
      } else if (p.hurtT > 0) {
        // arms up, legs thrown forward
        thighF = 0.9; kneeF = 0.8; thighB = 0.2; kneeB = 1.1;
        armF = -2.6; elbowF = 0.6; armB = -2.2; elbowB = 0.7;
      } else if (!grounded) {
        const rising = p.vy < 0;
        const glide = p.carpetT > 0 && !rising;
        if (glide) {
          // riding the carpet: arms out, knees loose
          thighF = 0.5; kneeF = 0.5; thighB = -0.35; kneeB = 0.7;
          armF = -2.4; elbowF = 0.1; armB = 2.4; elbowB = 0.1;
        } else {
          const t = U.clamp(p.airT * 3, 0, 1);
          thighF = rising ? 0.85 + t * 0.25 : 0.35; kneeF = rising ? 1.15 : 0.5;
          thighB = rising ? -0.5 : -0.75; kneeB = rising ? 0.6 : 1.1;
          armF = rising ? -2.1 : -1.4; elbowF = 0.3;
          armB = rising ? 1.7 : 1.2; elbowB = 0.3;
        }
      } else if (turnK > 0) {
        // skid: front foot planted forward, back leg trailing
        thighF = 1.0; kneeF = 0.15; thighB = -0.7; kneeB = 0.9;
        armF = -1.5; elbowF = 0.5; armB = 1.5; elbowB = 0.5;
      } else if (Math.abs(p.vx) > 22) {
        const s = Math.sin(phase), c = Math.sin(phase + Math.PI);
        const spd = U.clamp(Math.abs(p.vx) / C.RUN_SPEED, 0.4, 1.1);
        thighF = s * 0.95 * spd; kneeF = Math.max(0, -s) * 1.25;
        thighB = c * 0.95 * spd; kneeB = Math.max(0, -c) * 1.25;
        // the elbow lags a fraction behind the shoulder — cheap follow-through
        const lag = Math.sin(phase - 0.5);
        armF = -s * 0.9 * spd; elbowF = 0.35 + Math.max(0, lag) * 0.6;
        armB = -c * 0.9 * spd; elbowB = 0.35 + Math.max(0, -lag) * 0.6;
      } else {
        const idle = Math.sin(time * 2.4) * 0.06;
        thighF = 0.26 + idle; kneeF = 0.05; thighB = -0.36 - idle; kneeB = 0.24;
        armF = -0.22 + idle; elbowF = 0.3; armB = 0.28 - idle; elbowB = 0.3;
        // he gets restless if you leave him standing
        if (p.fidgetT > 0) {
          const f = 1 - p.fidgetT;
          if (p.fidget === 'cap') { armF = -2.5 + Math.sin(f * Math.PI) * 0.4; elbowF = 1.5; }
          else if (p.fidget === 'sword') { armB = 0.9; elbowB = 1.3; }
          else if (p.fidget === 'stretch') {
            const k = Math.sin(f * Math.PI);
            armF = -0.22 - k * 2.6; armB = 0.28 + k * 1.4; elbowF = 0.3 - k * 0.25;
          }
        }
      }

      // landing crouch, folded on top of whatever pose is running
      if (landK > 0) {
        const k = landK * p.landPow;
        thighF += k * 0.5; kneeF += k * 0.9;
        thighB -= k * 0.5; kneeB += k * 0.9;
        armF -= k * 0.5; armB += k * 0.5;
      }

      const bodyBob = grounded && Math.abs(p.vx) > 22 ? Math.abs(Math.sin(phase)) * 2 : 0;
      const yOff = sliding ? 12 : -bodyBob + landK * p.landPow * 7;

      ctx.save();
      ctx.translate(0, yOff);

      // ---- back limbs (dimmer and thinner, so the legs never merge)
      let e1 = seg(ctx, -1, hipY, thighB, 11, 7, P.pantsDark);
      let f1 = seg(ctx, e1[0], e1[1], thighB + kneeB, 11, 6, P.pantsDark);
      bootShape(ctx, f1[0], f1[1], '#452510', 0.9);

      let a1 = seg(ctx, -2.5, shY + 3, armB, 9, 5.6, P.vestDark);
      seg(ctx, a1[0], a1[1], armB + elbowB, 8.5, 4.8, P.skinDark);

      // ---- scabbard tucked into the sash, tilted back
      if (p.slashT <= 0) {
        ctx.save();
        ctx.translate(-3.5, hipY - 4);
        ctx.rotate(0.55);
        ctx.fillStyle = '#4a3a22';
        ctx.fillRect(-2.2, 0, 4.4, 21);
        ctx.fillStyle = P.goldDark;
        ctx.fillRect(-2.8, 2, 5.6, 2.4);
        ctx.fillRect(-2.8, 18, 5.6, 3);
        ctx.fillStyle = P.gold;
        ctx.fillRect(-3.6, -2, 7.2, 2.2);
        ctx.fillStyle = '#7a5a2a';
        ctx.fillRect(-1.5, -7.5, 3, 6);
        ctx.restore();
      }

      // ---- torso: cream shirt under an embroidered turquoise waistcoat
      ctx.fillStyle = P.shirt;
      ctx.beginPath();
      ctx.moveTo(-7, shY - 1);
      ctx.lineTo(7, shY - 1);
      ctx.lineTo(6.4, hipY + 2);
      ctx.lineTo(-6.4, hipY + 2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = P.vest;
      ctx.beginPath();
      ctx.moveTo(-7.4, shY - 1.5);
      ctx.lineTo(-1.8, shY - 1.5);
      ctx.lineTo(-3, hipY + 1);
      ctx.lineTo(-7, hipY + 1);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(7.4, shY - 1.5);
      ctx.lineTo(1.8, shY - 1.5);
      ctx.lineTo(3, hipY + 1);
      ctx.lineTo(7, hipY + 1);
      ctx.closePath();
      ctx.fill();
      // gold braid down the vest edges
      ctx.strokeStyle = P.vestTrim;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(-1.9, shY - 1); ctx.lineTo(-3, hipY + 1);
      ctx.moveTo(1.9, shY - 1); ctx.lineTo(3, hipY + 1);
      ctx.stroke();
      // a buta stitched on the chest
      ctx.fillStyle = P.vestTrim;
      buta(ctx, 5, shY + 7, 2.3, 0.25);
      ctx.fill();
      ctx.fillStyle = P.vestDark;
      ctx.fillRect(-7.4, shY - 2.5, 14.8, 2.4);
      // crimson sash with a gold stripe
      ctx.fillStyle = P.sash;
      ctx.fillRect(-7, hipY - 3, 14, 6);
      ctx.fillStyle = P.vestTrim;
      ctx.fillRect(-7, hipY - 0.6, 14, 1.2);
      ctx.fillStyle = P.sashDark;
      ctx.fillRect(-7, hipY + 2, 14, 2);
      // knotted sash tail, trailing a beat behind the body
      const sx2 = p.sashX * p.facing;
      const sy2 = p.sashY;
      ctx.fillStyle = P.sash;
      ctx.beginPath();
      ctx.moveTo(6.5, hipY - 1);
      ctx.quadraticCurveTo(10.5 + sx2 * 0.6, hipY + 4 + sy2 * 0.4, 8.5 + sx2, hipY + 10 + sy2);
      ctx.lineTo(5 + sx2, hipY + 9 + sy2);
      ctx.quadraticCurveTo(7 + sx2 * 0.5, hipY + 3 + sy2 * 0.3, 4.5, hipY - 1);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = P.sashDark;
      ctx.beginPath();
      ctx.moveTo(5 + sx2, hipY + 9 + sy2);
      ctx.lineTo(8.5 + sx2, hipY + 10 + sy2);
      ctx.lineTo(6.8 + sx2 * 1.3, hipY + 14 + sy2 * 1.3);
      ctx.closePath();
      ctx.fill();

      // ---- head (kept small: the figure should read ~4.5 heads tall)
      // it lags the torso by a hair, and swivels when he looks around
      const headLag = U.clamp(-p.vx * 0.004, -1.6, 1.6) * p.facing;
      const lookX = p.fidgetT > 0 && p.fidget === 'look' ? Math.sin((1 - p.fidgetT) * 7) * 2.6 : 0;
      const headY = shY - 8.5 + (grounded && Math.abs(p.vx) > 22 ? Math.sin(phase * 2) * 0.7 : 0);
      const hx = 0.4 + headLag + lookX;
      ctx.fillStyle = P.skinDark;
      ctx.fillRect(-2.1, shY - 6, 4.4, 7);
      ctx.beginPath(); ctx.arc(hx - 5, headY + 1.2, 2.2, 0, U.TAU); ctx.fill();
      // face
      ctx.fillStyle = skin;
      ctx.beginPath(); ctx.arc(hx, headY, 6.9, 0, U.TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(hx + 1, headY + 3.4, 5.6, 4.2, 0, 0, Math.PI); ctx.fill();
      // nose
      ctx.beginPath();
      ctx.moveTo(hx + 5.8, headY - 0.6); ctx.lineTo(hx + 8.5, headY + 1.9); ctx.lineTo(hx + 5.7, headY + 2.4);
      ctx.closePath();
      ctx.fill();
      // eye — squeezes shut on a blink, wide when he is hurt
      const wide = p.hurtT > 0 ? 1.5 : 1;
      const lid = p.blink > 0 ? 0.12 : 1;
      ctx.fillStyle = '#fdf6ea';
      ctx.beginPath();
      ctx.ellipse(hx + 3.7, headY - 0.3, 1.8 * wide, 2.1 * wide * lid, 0, 0, U.TAU);
      ctx.fill();
      ctx.fillStyle = P.ink;
      ctx.beginPath();
      ctx.ellipse(hx + 4.4, headY - 0.1, 1.25 * wide, 1.75 * wide * lid, 0, 0, U.TAU);
      ctx.fill();
      if (p.blink > 0) {
        ctx.strokeStyle = P.skinDark;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(hx + 1.9, headY - 0.3); ctx.lineTo(hx + 6, headY - 0.3);
        ctx.stroke();
      }
      // brow — climbs when he takes a hit
      ctx.strokeStyle = P.hat;
      ctx.lineWidth = 1.7;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(hx + 1.5, headY - 3.9 - (p.hurtT > 0 ? 1.2 : 0));
      ctx.lineTo(hx + 6.2, headY - 2.8 - (p.hurtT > 0 ? 1.8 : 0));
      ctx.stroke();
      // mouth: a grin normally, an O when he is hit or shouting mid-slash
      ctx.strokeStyle = 'rgba(118,52,38,0.9)';
      ctx.lineWidth = 1.3;
      if (p.hurtT > 0 || p.slashT > p.slashDur * 0.5) {
        ctx.fillStyle = 'rgba(96,40,30,0.9)';
        ctx.beginPath();
        ctx.ellipse(hx + 3.2, headY + 2.8, 1.9, 2.3, 0, 0, U.TAU);
        ctx.fill();
      } else {
        ctx.beginPath(); ctx.arc(hx + 3, headY + 2.5, 2.6, -0.15, 1.15); ctx.stroke();
      }
      // gold hoop in the ear, swinging a little
      ctx.strokeStyle = P.gold;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.arc(hx - 4.8 + p.sashX * p.facing * 0.12, headY + 3.6, 1.9, 0, U.TAU);
      ctx.stroke();
      // hair at the nape
      ctx.fillStyle = P.hat;
      ctx.beginPath(); ctx.ellipse(hx - 5.4, headY + 0.4, 3, 3.8, 0.3, 0, U.TAU); ctx.fill();
      // papaq — the black astrakhan cap, jolted by every landing
      const capY = headY - 6.2 - landK * p.landPow * 1.6;
      const capTilt = -0.06 + U.clamp(-p.vx * 0.0004, -0.16, 0.16) * p.facing
        + (p.fidgetT > 0 && p.fidget === 'cap' ? 0.22 * Math.sin((1 - p.fidgetT) * Math.PI) : 0);
      ctx.beginPath(); ctx.ellipse(hx, capY, 8, 5.2, capTilt, 0, U.TAU); ctx.fill();
      ctx.fillStyle = '#3d2e2e';
      ctx.beginPath(); ctx.ellipse(hx - 2.3, capY - 1.9, 3.2, 1.8, -0.35, 0, U.TAU); ctx.fill();
      ctx.fillStyle = P.sash;
      ctx.beginPath(); ctx.ellipse(hx, headY - 3.4, 7.7, 2.1, -0.05, 0, U.TAU); ctx.fill();

      // ---- front limbs
      let e2 = seg(ctx, 1, hipY, thighF, 11, 7.6, P.pants);
      let f2 = seg(ctx, e2[0], e2[1], thighF + kneeF, 11, 6.6, P.pants);
      bootShape(ctx, f2[0], f2[1], P.boot, 1);
      ctx.fillStyle = P.sash;
      ctx.beginPath(); ctx.arc(f2[0] - 1, f2[1] - 4.6, 3.2, Math.PI, U.TAU); ctx.fill();

      // sword arm: the swing overrides the pose in three beats —
      // anticipation back, a fast cut, then a slow follow-through
      let sa = armF, se = elbowF;
      if (p.slashT > 0) {
        const k = 1 - p.slashT / p.slashDur;
        if (k < 0.22) { sa = -2.2 - (k / 0.22) * 0.55; se = 0.5; }
        else if (k < 0.6) { sa = -2.75 + U.ease.outCubic((k - 0.22) / 0.38) * 4.0; se = 0.12; }
        else { sa = 1.25 + (k - 0.6) * 0.7; se = 0.12 + (k - 0.6) * 0.5; }
      } else if (p.throwT > 0) {
        const k = 1 - p.throwT / p.throwDur;
        if (k < 0.3) { sa = -2.2 - (k / 0.3) * 0.5; se = 0.6; }
        else { sa = -2.7 + U.ease.outCubic((k - 0.3) / 0.7) * 2.9; se = 0.1; }
      }
      const a2 = seg(ctx, 2.5, shY + 3, sa, 9, 6, P.vest);
      const h2 = seg(ctx, a2[0], a2[1], sa + se, 8.5, 5.2, skin);

      // scimitar in hand — drawn only while the swing is live.
      // limb angles run from straight-down, so the blade needs the complement
      // to stay in line with the forearm instead of flipping behind him.
      if (p.slashT > 0) {
        ctx.save();
        ctx.translate(h2[0], h2[1]);
        ctx.rotate(Math.PI / 2 - (sa + se) + 0.28);
        ctx.fillStyle = P.goldDark;
        ctx.fillRect(-2.6, -5, 5.2, 8);
        ctx.fillStyle = P.gold;
        ctx.fillRect(-4.6, -1.5, 9.2, 2.6);
        ctx.strokeStyle = P.steel;
        ctx.lineWidth = 3.6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, 2);
        ctx.quadraticCurveTo(9, 8, 22, 1);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.85)';
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(2, 1.4);
        ctx.quadraticCurveTo(9, 6, 20, 0.6);
        ctx.stroke();
        ctx.restore();
      }

      ctx.restore(); // yOff

      // slash arc — only over the cut itself, trailing as it opens out
      if (p.slashT > 0) {
        const k = 1 - p.slashT / p.slashDur;
        if (k > 0.18) {
          const s = U.clamp((k - 0.18) / 0.5, 0, 1);
          const a0 = -2.0 + U.ease.outCubic(s) * 3.4;
          const fade = 1 - Math.max(0, (k - 0.68) / 0.32);
          ctx.globalAlpha = 0.8 * fade;
          ctx.strokeStyle = 'rgba(255,205,120,0.5)';
          ctx.lineWidth = 15 * fade;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.arc(6, -26, 30, a0 - 1.5 * s, a0 + 0.2);
          ctx.stroke();
          ctx.strokeStyle = '#fff6d8';
          ctx.lineWidth = 6 * fade;
          ctx.beginPath();
          ctx.arc(6, -26, 31, a0 - 1.5 * s, a0 + 0.35);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }

      // speed trail once he is really moving
      if (grounded && Math.abs(p.vx) > 250 && !sliding) {
        const a = (Math.abs(p.vx) - 250) / 110;
        ctx.globalAlpha = 0.16 * a;
        ctx.strokeStyle = P.stoneLite;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        for (let i = 0; i < 3; i++) {
          const yy = -14 - i * 12 + Math.sin(time * 20 + i) * 2;
          ctx.beginPath();
          ctx.moveTo(-14 - i * 5, yy);
          ctx.lineTo(-30 - i * 11, yy);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }

      ctx.restore();
      ctx.globalAlpha = 1;
    },

    /* -------------------------------------------------------- projectiles */
    drawProjectile(ctx, pr) {
      ctx.save();
      ctx.translate(pr.x, pr.y);
      ctx.rotate(pr.rot);
      ctx.fillStyle = '#8c1c22';
      ctx.beginPath(); ctx.arc(0.8, 0.8, 7.5, 0, U.TAU); ctx.fill();
      ctx.fillStyle = '#c8262e';
      ctx.beginPath(); ctx.arc(0, 0, 6.6, 0, U.TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,160,160,0.55)';
      ctx.beginPath(); ctx.arc(-2.4, -2.4, 2, 0, U.TAU); ctx.fill();
      ctx.strokeStyle = '#6d4b12';
      ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(0, -10); ctx.stroke();
      ctx.restore();
    },

    /** Everything else the enemies throw: coins, rocks, feathers, spit. */
    _hostile(ctx, a) {
      ctx.save();
      ctx.translate(a.x, a.y);
      switch (a.kind) {
        case 'coin':
          ctx.scale(Math.max(0.2, Math.abs(Math.cos(a.spin))), 1);
          ctx.fillStyle = P.goldDark;
          ctx.beginPath(); ctx.arc(0, 0, 9, 0, U.TAU); ctx.fill();
          ctx.fillStyle = P.gold;
          ctx.beginPath(); ctx.arc(0, 0, 7.2, 0, U.TAU); ctx.fill();
          ctx.fillStyle = P.goldDark;
          ctx.beginPath(); ctx.arc(0, 0, 3, 0, U.TAU); ctx.fill();
          break;
        case 'rock':
          ctx.rotate(a.spin * 0.4);
          ctx.fillStyle = P.stoneDark;
          ctx.beginPath();
          ctx.moveTo(-13, -4); ctx.lineTo(-6, -13); ctx.lineTo(8, -11);
          ctx.lineTo(13, 2); ctx.lineTo(4, 13); ctx.lineTo(-9, 9);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = P.stoneMid;
          ctx.beginPath();
          ctx.moveTo(-8, -3); ctx.lineTo(-3, -9); ctx.lineTo(6, -7); ctx.lineTo(7, 2); ctx.lineTo(-2, 6);
          ctx.closePath();
          ctx.fill();
          break;
        case 'feather':
          ctx.rotate(Math.sin(a.spin) * 0.5 + 0.4);
          ctx.fillStyle = '#2f2b2c';
          ctx.beginPath();
          ctx.ellipse(0, 0, 4.5, 13, 0, 0, U.TAU);
          ctx.fill();
          ctx.strokeStyle = '#6a6470';
          ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.moveTo(0, -13); ctx.lineTo(0, 15); ctx.stroke();
          break;
        case 'fire': {
          ctx.rotate(a.spin * 0.6);
          const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 22);
          g.addColorStop(0, 'rgba(255,246,216,1)');
          g.addColorStop(0.35, 'rgba(255,157,33,0.9)');
          g.addColorStop(1, 'rgba(224,64,15,0)');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(0, 0, 22, 0, U.TAU); ctx.fill();
          ctx.fillStyle = '#fff0b0';
          ctx.beginPath(); ctx.arc(0, 0, 6, 0, U.TAU); ctx.fill();
          break;
        }
        default: { // spit
          ctx.fillStyle = 'rgba(95,201,216,0.55)';
          ctx.beginPath(); ctx.arc(0, 0, 12, 0, U.TAU); ctx.fill();
          ctx.fillStyle = '#5fc9d8';
          ctx.beginPath(); ctx.arc(0, 0, 8, 0, U.TAU); ctx.fill();
          ctx.fillStyle = '#dff4f8';
          ctx.beginPath(); ctx.arc(-2.5, -2.5, 3, 0, U.TAU); ctx.fill();
        }
      }
      ctx.restore();
    },

    /* --------------------------------------------------------------- rope */
    drawRope(ctx, r, time) {
      const sway = r.holder ? 0 : Math.sin(time * 1.4 + r.x * 0.01) * 0.09;
      const ang = r.holder ? r.angle : sway;
      const ex = r.x + Math.sin(ang) * r.len;
      const ey = r.y + Math.cos(ang) * r.len;

      // anchor beam between two houses
      ctx.strokeStyle = P.woodDark;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(r.x - 42, r.y - 3);
      ctx.lineTo(r.x + 42, r.y - 3);
      ctx.stroke();

      ctx.strokeStyle = '#d8c9a4';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(r.x, r.y);
      ctx.quadraticCurveTo(
        r.x + Math.sin(ang) * r.len * 0.5 + Math.sin(ang) * 3,
        r.y + Math.cos(ang) * r.len * 0.5,
        ex, ey
      );
      ctx.stroke();

      // hanging rug at the end — that is what you grab
      ctx.save();
      ctx.translate(ex, ey);
      ctx.rotate(ang);
      ctx.fillStyle = P.carpetA;
      ctx.fillRect(-11, -4, 22, 24);
      ctx.fillStyle = P.carpetB;
      ctx.fillRect(-8, -1, 16, 18);
      ctx.fillStyle = P.carpetC;
      buta(ctx, 0, 8, 4, 0);
      ctx.fill();
      ctx.fillStyle = P.carpetC;
      for (let fx = -11; fx < 11; fx += 4) ctx.fillRect(fx, 20, 1.8, 4);
      ctx.restore();
    },

    /* -------------------------------------------------------- decorations */
    drawDeco(ctx, d, time) {
      switch (d.type) {
        case 'lamp': {
          ctx.strokeStyle = P.woodDark;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(d.x, d.y);
          ctx.lineTo(d.x, d.y + 14);
          ctx.stroke();
          const glow = 0.55 + Math.sin(time * 5 + d.x) * 0.12;
          ctx.globalAlpha = 0.10 * glow;
          ctx.fillStyle = P.fire;
          ctx.beginPath(); ctx.arc(d.x, d.y + 24, 26, 0, U.TAU); ctx.fill();
          ctx.globalAlpha = 1;
          ctx.fillStyle = P.goldDark;
          ctx.beginPath();
          ctx.moveTo(d.x - 9, d.y + 16);
          ctx.lineTo(d.x + 9, d.y + 16);
          ctx.lineTo(d.x + 6, d.y + 32);
          ctx.lineTo(d.x - 6, d.y + 32);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = P.fireHot;
          ctx.fillRect(d.x - 4, d.y + 19, 8, 10);
          break;
        }
        case 'rug': {
          ctx.strokeStyle = P.woodDark;
          ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.moveTo(d.x - 3, d.y); ctx.lineTo(d.x + d.w + 3, d.y); ctx.stroke();
          const sway = Math.sin(time * 1.6 + d.x * 0.02) * 2.5;
          ctx.save();
          ctx.translate(d.x, d.y);
          ctx.transform(1, 0, sway / d.h, 1, 0, 0);
          ctx.fillStyle = d.c1;
          ctx.fillRect(0, 0, d.w, d.h);
          ctx.fillStyle = d.c2;
          ctx.fillRect(4, 4, d.w - 8, d.h - 8);
          ctx.fillStyle = d.c3;
          for (let i = 0; i < 3; i++) {
            buta(ctx, d.w / 2, 14 + i * (d.h - 24) / 2, 5, i % 2 ? 0.3 : -0.3);
            ctx.fill();
          }
          ctx.fillStyle = d.c3;
          for (let fx = 0; fx < d.w - 2; fx += 5) ctx.fillRect(fx, d.h, 2, 5);
          ctx.restore();
          break;
        }
        case 'stall': {
          // bazaar table with produce
          ctx.fillStyle = P.woodDark;
          ctx.fillRect(d.x, d.y + 8, d.w, 5);
          ctx.fillRect(d.x + 3, d.y + 13, 4, 22);
          ctx.fillRect(d.x + d.w - 7, d.y + 13, 4, 22);
          ctx.fillStyle = P.carpetA;
          ctx.fillRect(d.x, d.y + 3, d.w, 6);
          const goods = ['#c8262e', '#e0a83c', '#6fa84a', '#c8262e'];
          for (let i = 0; i < d.w / 13; i++) {
            ctx.fillStyle = goods[i % goods.length];
            ctx.beginPath();
            ctx.arc(d.x + 8 + i * 13, d.y, 5.2, 0, U.TAU);
            ctx.fill();
          }
          break;
        }
        case 'plant': {
          ctx.fillStyle = '#8a5a33';
          ctx.fillRect(d.x - 8, d.y - 12, 16, 12);
          ctx.fillStyle = '#3f7a3a';
          for (let i = 0; i < 5; i++) {
            const a = -1.6 + i * 0.62 + Math.sin(time * 1.5 + i + d.x) * 0.07;
            ctx.save();
            ctx.translate(d.x, d.y - 12);
            ctx.rotate(a);
            ctx.beginPath();
            ctx.ellipse(0, -13, 4.5, 14, 0, 0, U.TAU);
            ctx.fill();
            ctx.restore();
          }
          break;
        }
        case 'door': {
          ctx.fillStyle = P.stoneDark;
          archPath(ctx, d.x, d.y, d.w, d.h);
          ctx.fill();
          ctx.fillStyle = '#2f6f6b';
          archPath(ctx, d.x + 4, d.y + 5, d.w - 8, d.h - 5);
          ctx.fill();
          ctx.strokeStyle = P.goldDark;
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(d.x + d.w / 2, d.y + 8);
          ctx.lineTo(d.x + d.w / 2, d.y + d.h);
          ctx.stroke();
          ctx.fillStyle = P.gold;
          ctx.beginPath(); ctx.arc(d.x + d.w / 2 - 5, d.y + d.h * 0.55, 2.2, 0, U.TAU); ctx.fill();
          ctx.beginPath(); ctx.arc(d.x + d.w / 2 + 5, d.y + d.h * 0.55, 2.2, 0, U.TAU); ctx.fill();
          break;
        }
        case 'plaque': {
          // the blue enamel street plate you see on every wall of the old city
          ctx.save();
          ctx.globalAlpha = 0.78;
          ctx.fillStyle = '#0d2f52';
          roundRect(ctx, d.x, d.y, d.w, 17, 2);
          ctx.fill();
          ctx.strokeStyle = 'rgba(223,231,239,0.8)';
          ctx.lineWidth = 1;
          roundRect(ctx, d.x + 2, d.y + 2, d.w - 4, 13, 1.5);
          ctx.stroke();
          ctx.fillStyle = '#e8eef5';
          ctx.font = '600 8px "Trebuchet MS", system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(d.text, d.x + d.w / 2, d.y + 11.5);
          ctx.restore();
          ctx.textAlign = 'left';
          break;
        }
        case 'chay': {
          // çayxana: samovar, armudu glasses, a backgammon board
          const bx = d.x, by = d.y;
          ctx.fillStyle = P.woodDark;
          ctx.fillRect(bx, by - 20, 62, 5);
          ctx.fillRect(bx + 4, by - 15, 4, 15);
          ctx.fillRect(bx + 54, by - 15, 4, 15);
          // samovar
          ctx.fillStyle = '#c9a227';
          ctx.beginPath();
          ctx.ellipse(bx + 16, by - 34, 9, 12, 0, 0, U.TAU);
          ctx.fill();
          ctx.fillRect(bx + 12, by - 48, 8, 8);
          ctx.fillStyle = '#8c6c14';
          ctx.fillRect(bx + 10, by - 23, 12, 4);
          ctx.fillRect(bx + 24, by - 33, 5, 3);
          const steam = Math.sin(time * 2 + bx) * 3;
          ctx.fillStyle = 'rgba(255,240,220,0.22)';
          ctx.beginPath();
          ctx.ellipse(bx + 16 + steam, by - 58, 5, 8, 0, 0, U.TAU);
          ctx.fill();
          // two armudu glasses
          for (let i = 0; i < 2; i++) {
            const gx = bx + 36 + i * 12;
            ctx.fillStyle = '#b5541c';
            ctx.beginPath();
            ctx.moveTo(gx - 3.5, by - 32);
            ctx.quadraticCurveTo(gx - 6, by - 27, gx - 2.4, by - 24);
            ctx.quadraticCurveTo(gx - 5, by - 21, gx - 2.4, by - 20);
            ctx.lineTo(gx + 2.4, by - 20);
            ctx.quadraticCurveTo(gx + 5, by - 21, gx + 2.4, by - 24);
            ctx.quadraticCurveTo(gx + 6, by - 27, gx + 3.5, by - 32);
            ctx.closePath();
            ctx.fill();
          }
          break;
        }
        case 'tandir': {
          // clay bread oven, always smoking
          ctx.fillStyle = '#8d5a2c';
          ctx.beginPath();
          ctx.moveTo(d.x - 22, d.y);
          ctx.quadraticCurveTo(-26 + d.x, d.y - 34, d.x - 12, d.y - 44);
          ctx.lineTo(d.x + 12, d.y - 44);
          ctx.quadraticCurveTo(d.x + 26, d.y - 34, d.x + 22, d.y);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#6b4118';
          ctx.beginPath(); ctx.ellipse(d.x, d.y - 44, 12, 4.5, 0, 0, U.TAU); ctx.fill();
          ctx.fillStyle = P.fire;
          ctx.beginPath(); ctx.ellipse(d.x, d.y - 44, 8, 3, 0, 0, U.TAU); ctx.fill();
          ctx.fillStyle = 'rgba(80,60,50,0.25)';
          for (let i = 0; i < 3; i++) {
            const t = (time * 0.35 + i * 0.34) % 1;
            ctx.beginPath();
            ctx.arc(d.x + Math.sin(time + i * 2) * 8 * t, d.y - 48 - t * 60, 5 + t * 12, 0, U.TAU);
            ctx.fill();
          }
          ctx.fillStyle = '#c9a05a';
          ctx.beginPath(); ctx.ellipse(d.x - 26, d.y - 6, 11, 4, -0.2, 0, U.TAU); ctx.fill();
          break;
        }
        case 'loom': {
          // carpet loom with a half-finished rug on it
          ctx.fillStyle = P.woodDark;
          ctx.fillRect(d.x - 30, d.y - 92, 6, 92);
          ctx.fillRect(d.x + 24, d.y - 92, 6, 92);
          ctx.fillRect(d.x - 32, d.y - 96, 64, 6);
          ctx.fillRect(d.x - 32, d.y - 30, 64, 5);
          ctx.strokeStyle = 'rgba(240,232,206,0.6)';
          ctx.lineWidth = 1;
          for (let wx = d.x - 22; wx < d.x + 24; wx += 5) {
            ctx.beginPath();
            ctx.moveTo(wx, d.y - 90); ctx.lineTo(wx, d.y - 30);
            ctx.stroke();
          }
          ctx.fillStyle = P.carpetA;
          ctx.fillRect(d.x - 24, d.y - 62, 48, 32);
          ctx.fillStyle = P.carpetB;
          ctx.fillRect(d.x - 20, d.y - 58, 40, 24);
          ctx.fillStyle = P.carpetC;
          buta(ctx, d.x, d.y - 46, 5, 0);
          ctx.fill();
          break;
        }
        case 'copper': {
          // misgər row: hammered copper trays hanging from a beam
          ctx.fillStyle = P.woodDark;
          ctx.fillRect(d.x - 40, d.y, 80, 5);
          for (let i = 0; i < 4; i++) {
            const px = d.x - 30 + i * 20;
            const sway = Math.sin(time * 1.6 + i) * 1.6;
            ctx.strokeStyle = '#6b5a2a';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(px, d.y + 5); ctx.lineTo(px + sway, d.y + 16);
            ctx.stroke();
            ctx.fillStyle = i % 2 ? '#b5762a' : '#c98a34';
            ctx.beginPath();
            ctx.ellipse(px + sway, d.y + 16 + (i % 2 ? 8 : 10), i % 2 ? 8 : 10, i % 2 ? 9 : 11, 0, 0, U.TAU);
            ctx.fill();
            ctx.fillStyle = 'rgba(255,225,170,0.45)';
            ctx.beginPath();
            ctx.ellipse(px + sway - 2.5, d.y + 12 + (i % 2 ? 8 : 10), 2.6, 3.4, -0.4, 0, U.TAU);
            ctx.fill();
          }
          break;
        }
        case 'bread': {
          // rack of təndir çörəyi
          ctx.fillStyle = P.woodDark;
          ctx.fillRect(d.x - 26, d.y - 46, 52, 4);
          ctx.fillRect(d.x - 24, d.y - 42, 4, 42);
          ctx.fillRect(d.x + 20, d.y - 42, 4, 42);
          for (let i = 0; i < 3; i++) {
            ctx.fillStyle = i === 1 ? '#d8a458' : '#c99447';
            ctx.save();
            ctx.translate(d.x - 15 + i * 15, d.y - 30);
            ctx.rotate(0.2 - i * 0.2);
            ctx.beginPath(); ctx.ellipse(0, 0, 7, 13, 0, 0, U.TAU); ctx.fill();
            ctx.fillStyle = '#a5701f';
            ctx.beginPath(); ctx.ellipse(0, 0, 3.4, 8, 0, 0, U.TAU); ctx.fill();
            ctx.restore();
          }
          break;
        }
        case 'well': {
          ctx.fillStyle = P.stoneMid;
          ctx.fillRect(d.x - 20, d.y - 30, 40, 30);
          ctx.fillStyle = P.stoneLite;
          ctx.fillRect(d.x - 22, d.y - 34, 44, 6);
          ctx.fillStyle = '#2c4a52';
          ctx.beginPath(); ctx.ellipse(d.x, d.y - 32, 15, 4, 0, 0, U.TAU); ctx.fill();
          ctx.strokeStyle = P.woodDark;
          ctx.lineWidth = 3.4;
          ctx.beginPath();
          ctx.moveTo(d.x - 16, d.y - 34); ctx.lineTo(d.x - 16, d.y - 74);
          ctx.moveTo(d.x + 16, d.y - 34); ctx.lineTo(d.x + 16, d.y - 74);
          ctx.moveTo(d.x - 18, d.y - 74); ctx.lineTo(d.x + 18, d.y - 74);
          ctx.stroke();
          const sway = Math.sin(time * 1.2 + d.x) * 3;
          ctx.strokeStyle = '#a89468';
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(d.x, d.y - 72); ctx.lineTo(d.x + sway, d.y - 54);
          ctx.stroke();
          ctx.fillStyle = P.wood;
          ctx.fillRect(d.x + sway - 6, d.y - 54, 12, 10);
          break;
        }
        case 'nerd': {
          // backgammon board waiting for the next two players
          ctx.fillStyle = P.woodDark;
          ctx.fillRect(d.x - 24, d.y - 22, 48, 5);
          ctx.fillRect(d.x - 20, d.y - 17, 4, 17);
          ctx.fillRect(d.x + 16, d.y - 17, 4, 17);
          ctx.fillStyle = '#7a4a22';
          ctx.fillRect(d.x - 22, d.y - 28, 44, 7);
          ctx.fillStyle = '#e8d9b4';
          for (let i = 0; i < 6; i++) {
            ctx.beginPath();
            ctx.moveTo(d.x - 20 + i * 7, d.y - 28);
            ctx.lineTo(d.x - 17 + i * 7, d.y - 22);
            ctx.lineTo(d.x - 14 + i * 7, d.y - 28);
            ctx.closePath();
            ctx.fill();
          }
          break;
        }
        case 'jarpile': {
          for (let i = 0; i < 3; i++) {
            const jx = d.x - 16 + i * 16;
            const jh = 22 + (i % 2) * 8;
            ctx.fillStyle = i % 2 ? '#a86a3c' : '#8d5626';
            ctx.beginPath();
            ctx.moveTo(jx - 7, d.y);
            ctx.quadraticCurveTo(jx - 12, d.y - jh * 0.5, jx - 5, d.y - jh);
            ctx.lineTo(jx + 5, d.y - jh);
            ctx.quadraticCurveTo(jx + 12, d.y - jh * 0.5, jx + 7, d.y);
            ctx.closePath();
            ctx.fill();
          }
          break;
        }
        case 'drip': {
          const t = (time * 0.7 + d.phase) % 1;
          ctx.fillStyle = 'rgba(180,220,225,0.6)';
          ctx.beginPath();
          ctx.ellipse(d.x, d.y + t * 150, 2.4, 4 + t * 3, 0, 0, U.TAU);
          ctx.fill();
          ctx.fillStyle = 'rgba(160,210,215,0.25)';
          ctx.fillRect(d.x - 8, d.y - 4, 16, 4);
          break;
        }
        case 'column': {
          // gallery column with a carved capital
          ctx.fillStyle = P.stoneMid;
          ctx.fillRect(d.x - 6, d.y - d.h, 12, d.h);
          ctx.fillStyle = P.stoneLite;
          ctx.fillRect(d.x - 4, d.y - d.h, 4, d.h);
          ctx.fillStyle = P.stoneDark;
          ctx.fillRect(d.x - 11, d.y - d.h - 9, 22, 9);
          ctx.fillRect(d.x - 9, d.y - 8, 18, 8);
          ctx.fillStyle = P.stoneEdge;
          ctx.fillRect(d.x - 13, d.y - d.h - 12, 26, 4);
          break;
        }
        case 'palm': {
          ctx.fillStyle = '#7a5a30';
          ctx.beginPath();
          ctx.moveTo(d.x - 5, d.y);
          ctx.quadraticCurveTo(d.x - 1, d.y - d.h * 0.6, d.x + 5, d.y - d.h);
          ctx.lineTo(d.x + 10, d.y - d.h + 3);
          ctx.quadraticCurveTo(d.x + 5, d.y - d.h * 0.6, d.x + 3, d.y);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#5a4222';
          for (let i = 0; i < 5; i++) ctx.fillRect(d.x - 4 + i, d.y - 14 - i * 14, 9, 3);
          for (let i = 0; i < 7; i++) {
            const a = -2.5 + i * 0.52 + Math.sin(time * 0.9 + i) * 0.06;
            ctx.save();
            ctx.translate(d.x + 7, d.y - d.h);
            ctx.rotate(a);
            ctx.fillStyle = i % 2 ? '#3f7a3a' : '#4f8d43';
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.quadraticCurveTo(22, -7, 42, 2);
            ctx.quadraticCurveTo(22, 4, 0, 5);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
          }
          ctx.fillStyle = '#b5541c';
          for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.arc(d.x + 4 + i * 5, d.y - d.h + 8, 3, 0, U.TAU);
            ctx.fill();
          }
          break;
        }
        case 'boat': {
          // a wooden caique pulled up on the quay
          ctx.fillStyle = '#7a4a24';
          ctx.beginPath();
          ctx.moveTo(d.x - 40, d.y - 10);
          ctx.quadraticCurveTo(d.x, d.y + 6, d.x + 40, d.y - 10);
          ctx.quadraticCurveTo(d.x + 30, d.y - 22, d.x - 30, d.y - 22);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#9c6431';
          ctx.beginPath();
          ctx.moveTo(-34 + d.x, d.y - 15);
          ctx.quadraticCurveTo(d.x, d.y - 2, d.x + 34, d.y - 15);
          ctx.quadraticCurveTo(d.x, d.y - 12, d.x - 34, d.y - 15);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = P.carpetB;
          ctx.fillRect(d.x - 40, d.y - 20, 80, 4);
          ctx.strokeStyle = '#6b4a24';
          ctx.lineWidth = 2.6;
          ctx.beginPath();
          ctx.moveTo(d.x + 12, d.y - 20); ctx.lineTo(d.x + 30, d.y - 58);
          ctx.stroke();
          break;
        }
        case 'net': {
          ctx.strokeStyle = '#8d7a4a';
          ctx.lineWidth = 1;
          const sway = Math.sin(time * 1.1 + d.x * 0.02) * 3;
          ctx.save();
          ctx.translate(d.x, d.y - 78);
          for (let i = 0; i <= 6; i++) {
            ctx.beginPath();
            ctx.moveTo(-24 + i * 8, 0);
            ctx.lineTo(-24 + i * 8 + sway, 62);
            ctx.stroke();
          }
          for (let j = 0; j <= 6; j++) {
            ctx.beginPath();
            ctx.moveTo(-24 + (sway * j) / 6, j * 10);
            ctx.lineTo(24 + (sway * j) / 6, j * 10);
            ctx.stroke();
          }
          ctx.fillStyle = P.woodDark;
          ctx.fillRect(-28, -4, 56, 4);
          ctx.restore();
          break;
        }
        case 'dish': {
          // rooftop water tank on a frame
          ctx.fillStyle = P.steelDark;
          ctx.fillRect(d.x - 14, d.y - 40, 28, 22);
          ctx.fillStyle = '#7d8a92';
          ctx.fillRect(d.x - 14, d.y - 40, 28, 5);
          ctx.strokeStyle = P.steelDark;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(d.x - 10, d.y - 18); ctx.lineTo(d.x - 13, d.y);
          ctx.moveTo(d.x + 10, d.y - 18); ctx.lineTo(d.x + 13, d.y);
          ctx.stroke();
          break;
        }
        case 'chimney': {
          ctx.fillStyle = P.stoneMid;
          ctx.fillRect(d.x - 9, d.y - 46, 18, 46);
          ctx.fillStyle = P.stoneDark;
          ctx.fillRect(d.x - 12, d.y - 52, 24, 7);
          ctx.fillStyle = '#3a2a1c';
          ctx.fillRect(d.x - 6, d.y - 52, 12, 4);
          ctx.fillStyle = 'rgba(90,70,58,0.2)';
          for (let i = 0; i < 3; i++) {
            const t = (time * 0.28 + i * 0.34) % 1;
            ctx.beginPath();
            ctx.arc(d.x + Math.sin(time * 0.8 + i * 2) * 10 * t, d.y - 56 - t * 70, 6 + t * 14, 0, U.TAU);
            ctx.fill();
          }
          break;
        }
        case 'pigeons': {
          // they scatter when you run through them, then drift back
          for (let i = 0; i < d.n; i++) {
            const b = d.birds[i];
            const bx = d.x + b.dx + b.vx;
            const by = d.y + b.dy + b.vy;
            const flying = b.fly > 0;
            ctx.save();
            ctx.translate(bx, by);
            ctx.scale(b.vx >= 0 ? 1 : -1, 1);
            ctx.fillStyle = i % 3 === 0 ? '#8d8a94' : '#a8a5ad';
            ctx.beginPath();
            ctx.ellipse(0, -5, 7, 5, 0, 0, U.TAU);
            ctx.fill();
            ctx.beginPath(); ctx.arc(5, -9, 3.4, 0, U.TAU); ctx.fill();
            ctx.fillStyle = '#d8a25a';
            ctx.beginPath();
            ctx.moveTo(8, -9); ctx.lineTo(12, -8); ctx.lineTo(8, -7);
            ctx.closePath();
            ctx.fill();
            if (flying) {
              const w = Math.sin(time * 22 + i) * 8;
              ctx.fillStyle = '#c2bfc7';
              ctx.beginPath();
              ctx.moveTo(-1, -6);
              ctx.quadraticCurveTo(-9, -12 - w, -13, -4 - w * 0.5);
              ctx.quadraticCurveTo(-7, -4, -1, -3);
              ctx.closePath();
              ctx.fill();
            } else {
              ctx.strokeStyle = '#d8a25a';
              ctx.lineWidth = 1.2;
              ctx.beginPath();
              ctx.moveTo(-1, 0); ctx.lineTo(-1, 3);
              ctx.moveTo(3, 0); ctx.lineTo(3, 3);
              ctx.stroke();
            }
            ctx.restore();
          }
          break;
        }
        case 'firepit': {
          const f = 0.7 + Math.sin(time * 6 + d.phase) * 0.3;
          ctx.fillStyle = P.stoneDark;
          ctx.beginPath();
          ctx.moveTo(d.x - 20, d.y); ctx.lineTo(d.x + 20, d.y);
          ctx.lineTo(d.x + 13, d.y - 16); ctx.lineTo(d.x - 13, d.y - 16);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = P.stoneMid;
          ctx.fillRect(d.x - 15, d.y - 20, 30, 5);
          const gg = ctx.createRadialGradient(d.x, d.y - 30, 4, d.x, d.y - 30, 70);
          gg.addColorStop(0, 'rgba(255,180,80,' + (0.35 * f).toFixed(2) + ')');
          gg.addColorStop(1, 'rgba(255,140,40,0)');
          ctx.fillStyle = gg;
          ctx.fillRect(d.x - 70, d.y - 100, 140, 140);
          for (let i = 0; i < 3; i++) {
            const hh = (30 + i * 6) * f;
            ctx.fillStyle = [P.fireDeep, P.fire, P.fireHot][i];
            const s2 = 1 - i * 0.28;
            ctx.beginPath();
            ctx.moveTo(d.x - 12 * s2, d.y - 20);
            ctx.quadraticCurveTo(d.x + Math.sin(time * 7 + i) * 6, d.y - 20 - hh, d.x + 12 * s2, d.y - 20);
            ctx.closePath();
            ctx.fill();
          }
          break;
        }
        case 'gatearch': {
          // the fortified gateway you have to earn your way through
          ctx.fillStyle = P.stoneDark;
          ctx.fillRect(d.x, d.y - d.h, d.w, d.h);
          ctx.fillStyle = P.stoneMid;
          ctx.fillRect(d.x + 6, d.y - d.h + 6, d.w - 12, d.h - 6);
          ctx.fillStyle = 'rgba(46,26,8,0.55)';
          archPath(ctx, d.x + 18, d.y - d.h + 30, d.w - 36, d.h - 30);
          ctx.fill();
          ctx.fillStyle = P.stoneLite;
          ctx.fillRect(d.x - 6, d.y - d.h - 10, d.w + 12, 12);
          ctx.fillStyle = P.stoneEdge;
          for (let cx = d.x - 6; cx < d.x + d.w + 6; cx += 16) ctx.fillRect(cx, d.y - d.h - 22, 10, 14);
          break;
        }
        case 'merlons': {
          for (let mx = d.x; mx < d.x + d.w - 6; mx += 17) {
            ctx.fillStyle = P.stoneMid;
            ctx.fillRect(mx, d.y - 16, 12, 18);
            ctx.fillStyle = P.stoneLite;
            ctx.fillRect(mx, d.y - 16, 12, 4);
            ctx.fillStyle = P.stoneEdge;
            ctx.fillRect(mx, d.y - 2, 12, 3);
          }
          break;
        }
        case 'cat': {
          const t = time * 1.5 + d.x;
          ctx.fillStyle = '#4a4038';
          ctx.beginPath();
          ctx.ellipse(d.x, d.y - 7, 11, 6, 0, 0, U.TAU);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(d.x + 10, d.y - 12, 5.5, 0, U.TAU);
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(d.x + 6, d.y - 16); ctx.lineTo(d.x + 8, d.y - 21); ctx.lineTo(d.x + 10, d.y - 16);
          ctx.closePath(); ctx.fill();
          ctx.beginPath();
          ctx.moveTo(d.x + 12, d.y - 16); ctx.lineTo(d.x + 14, d.y - 21); ctx.lineTo(d.x + 15, d.y - 16);
          ctx.closePath(); ctx.fill();
          ctx.strokeStyle = '#4a4038';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(d.x - 10, d.y - 8);
          ctx.quadraticCurveTo(d.x - 20, d.y - 12 + Math.sin(t) * 5, d.x - 17, d.y - 20 + Math.sin(t) * 4);
          ctx.stroke();
          ctx.fillStyle = '#f5e35a';
          ctx.fillRect(d.x + 11, d.y - 13, 1.8, 1.8);
          break;
        }
      }
    },

    /* -------------------------------------------------------------- signs */
    drawSign(ctx, x, y, text) {
      ctx.save();
      ctx.font = '600 13px "Trebuchet MS", system-ui, sans-serif';
      const w = ctx.measureText(text).width + 20;
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = 'rgba(20,16,30,0.6)';
      roundRect(ctx, x - w / 2, y - 12, w, 22, 6);
      ctx.fill();
      ctx.strokeStyle = 'rgba(245,197,66,0.5)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = P.ui;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, x, y);
      ctx.restore();
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    },
  };

  ICH.Art = Art;
})(window.ICH);
