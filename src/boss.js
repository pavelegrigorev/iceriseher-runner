/* İçərişəhər Runner — district bosses.
   Every zone ends in a walled arena. The gate ahead stays shut until the boss
   is down, so each district finishes on a real fight instead of just fading
   into the next palette. */
(function (ICH) {
  'use strict';
  const U = ICH.U;
  const C = ICH.C;
  const P = ICH.P;
  const FX = ICH.FX;
  const Audio = ICH.Audio;

  const G_ACC = 2200;

  const DEFS = {
    /* ---- Captain of the guard: shield up front, so flank him or wait out
       the charge. The one boss that punishes mashing the sabre. */
    serkerde: {
      name: 'QALA SƏRKƏRDƏSİ', ru: 'Начальник стражи',
      hp: 14, w: 56, h: 96, speed: 78, contact: 1,
      stompable: false,
    },
    /* ---- Master of the bazaar: never comes to you, buries you in stock. */
    bazarbasi: {
      name: 'BAZAR AĞASI', ru: 'Хозяин базара',
      hp: 13, w: 66, h: 86, speed: 62, contact: 1,
      stompable: true,
    },
    /* ---- Crow king: untouchable in the air — that is what the nar is for. */
    qargasahi: {
      name: 'QARĞA ŞAHI', ru: 'Вороний царь',
      hp: 12, w: 92, h: 62, speed: 150, contact: 1,
      flying: true, stompable: false,
    },
    /* ---- Div, straight out of the folk tales, boiling in the hamam steam. */
    div: {
      name: 'HAMAM DİVİ', ru: 'Див из хамама',
      hp: 16, w: 82, h: 116, speed: 54, contact: 1,
      stompable: false,
    },
    /* ---- The Caspian serpent: only the head is flesh, and only above water. */
    ejdaha: {
      name: 'XƏZƏR ƏJDAHASI', ru: 'Каспийский дракон',
      hp: 14, w: 74, h: 62, speed: 120, contact: 1,
      flying: true, stompable: false,
    },
    /* ---- The one waiting past all five districts. Land of Fire, literally:
       he barely moves, he changes the floor instead. Hit him any time, but
       the core between attacks is where the damage really is. */
    alovsahi: {
      name: 'ALOV ŞAHI', ru: 'Царь огня',
      hp: 30, w: 104, h: 148, speed: 34, contact: 1,
      stompable: false, final: true,
    },
  };

  /* -------------------------------------------------------------- helpers */

  function fall(b, dt) {
    b.vy = Math.min(b.vy + G_ACC * dt, 1400);
    b.y += b.vy * dt;
    if (b.y + b.h >= b.floorY) {
      if (b.vy > 500) { FX.shake(4, 0.18); dust(b, 10); }
      b.y = b.floorY - b.h;
      b.vy = 0;
      b.grounded = true;
    } else {
      b.grounded = false;
    }
  }

  function walk(b, dt, speed) {
    b.x += b.dir * speed * dt;
    b.x = U.clamp(b.x, b.arena.x0 + 30, b.arena.x1 - b.w - 30);
  }

  function facePlayer(b, G) {
    b.dir = Math.sign((G.player.x + G.player.w / 2) - (b.x + b.w / 2)) || b.dir;
  }

  function dust(b, n) {
    for (let i = 0; i < n; i++) {
      FX.spawn({
        x: b.x + U.rnd(0, b.w), y: b.y + b.h,
        vx: U.rnd(-160, 160), vy: U.rnd(-140, -20),
        life: U.rnd(0.3, 0.6), size: U.rnd(3, 7), g: 700,
        color: 'rgba(226,205,166,0.85)', kind: 'puff',
      });
    }
  }

  /** Short flash + a shout so every telegraph is readable. */
  function tell(b, text, color) {
    FX.text(b.x + b.w / 2, b.y - 16, text, color || '#ffd98a', 15);
  }

  function shoot(G, kind, x, y, vx, vy) {
    G.arrows.push(ICH.Ent.arrow(x, y, vx, vy, kind));
  }

  /* -------------------------------------------------------------- the AIs */

  const AI = {
    serkerde(b, dt, G) {
      const p = G.player;
      const dx = (p.x + p.w / 2) - (b.x + b.w / 2);
      b.shield = b.state === 'walk' || b.state === 'wind' || b.state === 'combo';

      switch (b.state) {
        case 'walk': {
          facePlayer(b, G);
          walk(b, dt, b.speed * (b.phase > 1 ? 1.35 : 1));
          b.cool -= dt;
          if (b.cool <= 0) {
            const roll = Math.random();
            if (Math.abs(dx) > 210 || roll < 0.35) {
              b.state = 'wind'; b.t = 0.55; tell(b, 'hücum!', '#ff9a6a');
            } else if (roll < 0.7 || b.phase === 1) {
              b.state = 'combo'; b.t = 0; b.swing = 0;
            } else {
              b.state = 'call'; b.t = 0.6; tell(b, 'köməyə!', '#f6e7c4');
            }
          }
          break;
        }
        case 'wind':
          b.t -= dt;
          if (Math.floor(b.t * 12) % 2 === 0) dust(b, 1);
          if (b.t <= 0) { b.state = 'charge'; b.t = 1.1; Audio.play('bark'); }
          break;
        case 'charge':
          b.t -= dt;
          b.x += b.dir * 430 * dt;
          if (Math.random() < 0.6) dust(b, 1);
          if (b.x <= b.arena.x0 + 30 || b.x + b.w >= b.arena.x1 - 30 || b.t <= 0) {
            b.x = U.clamp(b.x, b.arena.x0 + 30, b.arena.x1 - b.w - 30);
            b.state = 'stun'; b.t = 1.4;
            FX.shake(7, 0.3); Audio.play('slam'); dust(b, 14);
            tell(b, 'uf!', '#9fd0c4');
          }
          break;
        case 'stun': // shield down — the window you were waiting for
          b.t -= dt;
          if (b.t <= 0) { b.state = 'walk'; b.cool = b.phase > 1 ? 0.7 : 1.2; }
          break;
        case 'combo':
          b.t -= dt;
          if (b.t <= 0) {
            b.swing++;
            Audio.play('slash');
            b.t = b.phase > 1 ? 0.34 : 0.44;
            if (b.swing > 3) { b.state = 'walk'; b.cool = b.phase > 1 ? 0.8 : 1.4; }
          }
          break;
        case 'call':
          b.t -= dt;
          if (b.t <= 0) {
            for (let i = 0; i < (b.phase > 1 ? 3 : 2); i++) {
              ICH.Level.enemies.push(ICH.Ent.enemyOn('guard', b.x + U.rnd(-90, 90), b.floorY, {}));
            }
            Audio.play('bow');
            b.state = 'walk'; b.cool = 1.6;
          }
          break;
      }
      fall(b, dt);
    },

    bazarbasi(b, dt, G) {
      switch (b.state) {
        case 'walk': {
          facePlayer(b, G);
          b.cool -= dt;
          if (b.grounded && b.cool <= 0) {
            const roll = Math.random();
            if (roll < 0.36) { b.state = 'rollwind'; b.t = 0.5; tell(b, 'küp!', '#c98a52'); }
            else if (roll < 0.7) { b.state = 'coins'; b.t = 0; b.shots = 0; tell(b, 'qızıl!', P.gold); }
            else { b.state = 'hop'; b.t = 0; b.vy = -820; b.grounded = false; }
          }
          break;
        }
        case 'hop':
          if (!b.grounded) {
            b.x += b.dir * 190 * dt;
            b.x = U.clamp(b.x, b.arena.x0 + 30, b.arena.x1 - b.w - 30);
          } else {
            // landing sends a shock along the floor
            FX.shake(9, 0.35);
            Audio.play('slam');
            dust(b, 18);
            b.state = 'pound'; b.t = 0.28;
          }
          break;
        case 'pound':
          b.t -= dt;
          if (b.t <= 0) { b.state = 'walk'; b.cool = b.phase > 1 ? 0.7 : 1.2; }
          break;
        case 'rollwind':
          b.t -= dt;
          if (b.t <= 0) {
            const n = b.phase > 1 ? 3 : 2;
            for (let i = 0; i < n; i++) {
              ICH.Level.enemies.push(ICH.Ent.enemyOn('roller', b.x + b.w / 2 + b.dir * (40 + i * 70), b.floorY, { dir: b.dir }));
            }
            Audio.play('break');
            b.state = 'walk'; b.cool = 1.5;
          }
          break;
        case 'coins':
          b.t -= dt;
          if (b.t <= 0) {
            b.shots++;
            const a = -1.5 + b.shots * 0.22;
            shoot(G, 'coin', b.x + b.w / 2, b.y + 24, Math.cos(a) * 330 * b.dir, Math.sin(a) * 330 - 120);
            Audio.play('coin');
            b.t = 0.13;
            if (b.shots >= (b.phase > 1 ? 7 : 5)) { b.state = 'walk'; b.cool = 1.3; }
          }
          break;
      }
      fall(b, dt);
    },

    qargasahi(b, dt, G) {
      const p = G.player;
      b.t2 += dt;
      switch (b.state) {
        case 'hover': {
          facePlayer(b, G);
          const tx = U.clamp(p.x - 40 + Math.sin(b.t2 * 0.9) * 220, b.arena.x0 + 40, b.arena.x1 - b.w - 40);
          b.x = U.lerp(b.x, tx, 1 - Math.pow(0.05, dt));
          b.y = b.homeY + Math.sin(b.t2 * 2.2) * 26;
          b.cool -= dt;
          if (b.cool <= 0) {
            const roll = Math.random();
            if (roll < 0.4) { b.state = 'divewind'; b.t = 0.5; tell(b, 'qar!', '#d8d0d8'); }
            else if (roll < 0.72) { b.state = 'gust'; b.t = 0.9; tell(b, 'külək!', '#cfe3ea'); }
            else { b.state = 'feathers'; b.t = 0; b.shots = 0; }
          }
          break;
        }
        case 'divewind':
          b.t -= dt;
          facePlayer(b, G);
          if (b.t <= 0) {
            const dx = (p.x + p.w / 2) - (b.x + b.w / 2);
            const dy = (p.y + p.h / 2) - (b.y + b.h / 2);
            const d = Math.max(1, Math.hypot(dx, dy));
            b.vx = (dx / d) * 620; b.vy = (dy / d) * 620;
            b.state = 'dive'; b.t = 1.0;
            Audio.play('slash');
          }
          break;
        case 'dive':
          b.t -= dt;
          b.x += b.vx * dt;
          b.y += b.vy * dt;
          b.vy += 380 * dt;
          if (b.y + b.h >= b.floorY) {
            b.y = b.floorY - b.h;
            b.state = 'rest'; b.t = b.phase > 1 ? 1.2 : 1.8;
            FX.shake(6, 0.28); dust(b, 14); Audio.play('slam');
            tell(b, '...', '#d8d0d8');
          } else if (b.t <= 0) {
            b.state = 'climb';
          }
          break;
        case 'rest': // grounded and reachable with the sabre
          b.t -= dt;
          if (b.t <= 0) b.state = 'climb';
          break;
        case 'climb':
          b.y = U.approach(b.y, b.homeY, 260 * dt);
          if (Math.abs(b.y - b.homeY) < 4) { b.state = 'hover'; b.cool = b.phase > 1 ? 0.7 : 1.3; }
          break;
        case 'gust': {
          b.t -= dt;
          const push = b.dir * 300 * dt;
          if (Math.abs((p.x + p.w / 2) - (b.x + b.w / 2)) < 460) {
            p.x += push;
            p.vy -= 60 * dt;
          }
          if (Math.random() < 0.7) {
            FX.spawn({
              x: b.x + b.w / 2, y: b.y + 30 + U.rnd(-20, 20),
              vx: b.dir * U.rnd(200, 460), vy: U.rnd(-40, 60),
              life: 0.6, size: U.rnd(2, 4), g: 0, drag: 1,
              color: 'rgba(238,244,249,0.6)', kind: 'spark',
            });
          }
          if (b.t <= 0) { b.state = 'hover'; b.cool = 1.2; }
          break;
        }
        case 'feathers':
          b.t -= dt;
          if (b.t <= 0) {
            b.shots++;
            shoot(G, 'feather', b.x + b.w / 2 + U.rnd(-26, 26), b.y + b.h, U.rnd(-40, 40), 190);
            b.t = 0.16;
            if (b.shots >= (b.phase > 1 ? 8 : 5)) { b.state = 'hover'; b.cool = 1.1; }
          }
          break;
      }
    },

    div(b, dt, G) {
      const p = G.player;
      const dx = (p.x + p.w / 2) - (b.x + b.w / 2);
      switch (b.state) {
        case 'walk':
          facePlayer(b, G);
          walk(b, dt, b.speed * (b.phase > 1 ? 1.4 : 1));
          b.cool -= dt;
          if (b.cool <= 0) {
            const roll = Math.random();
            if (Math.abs(dx) < 150 || roll < 0.4) { b.state = 'slamwind'; b.t = 0.6; tell(b, 'gurr!', '#9fd0c4'); }
            else if (roll < 0.75) { b.state = 'throwwind'; b.t = 0.55; tell(b, 'daş!', '#c9b68d'); }
            else { b.state = 'roar'; b.t = 1.0; tell(b, 'HAAA!', '#ff9a6a'); }
          }
          break;
        case 'slamwind':
          b.t -= dt;
          if (b.t <= 0) {
            b.state = 'slam'; b.t = 0.4;
            FX.shake(12, 0.45); Audio.play('slam'); dust(b, 22);
            // geysers erupt out of the hamam floor on both sides
            const n = b.phase > 1 ? 4 : 3;
            for (let i = 1; i <= n; i++) {
              [-1, 1].forEach((s) => {
                ICH.Level.hazards.push({
                  type: 'steam', x: b.x + b.w / 2 + s * i * 96, y: b.floorY - 8,
                  w: 34, h: 12, timer: 0.15 * i, on: true, power: 0, temp: 3.4,
                });
              });
            }
          }
          break;
        case 'slam':
          b.t -= dt;
          if (b.t <= 0) { b.state = 'walk'; b.cool = b.phase > 1 ? 0.8 : 1.4; }
          break;
        case 'throwwind':
          b.t -= dt;
          if (b.t <= 0) {
            shoot(G, 'rock', b.x + b.w / 2 + b.dir * 30, b.y + 20, b.dir * 320, -420);
            if (b.phase > 1) shoot(G, 'rock', b.x + b.w / 2 + b.dir * 30, b.y + 20, b.dir * 190, -520);
            Audio.play('throw');
            b.state = 'walk'; b.cool = 1.3;
          }
          break;
        case 'roar':
          b.t -= dt;
          if (Math.random() < 0.5) {
            FX.spawn({
              x: b.x + b.w / 2 + b.dir * 40, y: b.y + 26,
              vx: b.dir * U.rnd(120, 320), vy: U.rnd(-40, 40),
              life: 0.5, size: U.rnd(5, 12), g: -40, drag: 0.95,
              color: 'rgba(226,244,244,0.4)', kind: 'puff',
            });
          }
          if (b.t <= 0) { b.state = 'walk'; b.cool = 0.9; }
          break;
      }
      fall(b, dt);
    },

    ejdaha(b, dt, G) {
      const p = G.player;
      b.t2 += dt;
      switch (b.state) {
        case 'under': // submerged: nothing to hit
          b.t -= dt;
          b.y = U.approach(b.y, b.floorY + 60, 320 * dt);
          b.targetX = U.clamp(p.x - 30, b.arena.x0 + 60, b.arena.x1 - b.w - 60);
          b.x = U.lerp(b.x, b.targetX, 1 - Math.pow(0.02, dt));
          if (Math.random() < 0.5) {
            FX.spawn({
              x: b.x + b.w / 2 + U.rnd(-30, 30), y: b.floorY - 4,
              vx: U.rnd(-30, 30), vy: U.rnd(-70, -20),
              life: 0.5, size: U.rnd(3, 7), g: 200,
              color: 'rgba(120,200,215,0.6)', kind: 'puff',
            });
          }
          if (b.t <= 0) { b.state = 'rise'; b.t = 0.5; Audio.play('roar'); }
          break;
        case 'rise':
          b.t -= dt;
          facePlayer(b, G);
          b.y = U.approach(b.y, b.homeY, 520 * dt);
          if (b.t <= 0) { b.state = 'up'; b.cool = 0.5; }
          break;
        case 'up': // head is out — this is your window
          b.y = b.homeY + Math.sin(b.t2 * 3) * 10;
          facePlayer(b, G);
          b.cool -= dt;
          if (b.cool <= 0) {
            const roll = Math.random();
            if (roll < 0.45) { b.state = 'spit'; b.t = 0; b.shots = 0; tell(b, 'fışş!', '#5fc9d8'); }
            else if (roll < 0.8) { b.state = 'lungewind'; b.t = 0.5; tell(b, 'hücum!', '#ff9a6a'); }
            else { b.state = 'under'; b.t = b.phase > 1 ? 1.1 : 1.7; }
          }
          break;
        case 'spit':
          b.t -= dt;
          if (b.t <= 0) {
            b.shots++;
            const a = -0.9 + b.shots * 0.2;
            shoot(G, 'spit', b.x + b.w / 2 + b.dir * 26, b.y + 20, Math.cos(a) * 380 * b.dir, Math.sin(a) * 300);
            b.t = 0.18;
            if (b.shots >= (b.phase > 1 ? 6 : 4)) { b.state = 'up'; b.cool = 1.1; }
          }
          break;
        case 'lungewind':
          b.t -= dt;
          if (b.t <= 0) { b.state = 'lunge'; b.t = 0.85; }
          break;
        case 'lunge':
          b.t -= dt;
          b.x += b.dir * 520 * dt;
          b.y = U.approach(b.y, b.floorY - b.h - 6, 400 * dt);
          if (b.x <= b.arena.x0 + 40 || b.x + b.w >= b.arena.x1 - 40 || b.t <= 0) {
            b.x = U.clamp(b.x, b.arena.x0 + 40, b.arena.x1 - b.w - 40);
            b.state = 'up'; b.cool = b.phase > 1 ? 0.7 : 1.2;
          }
          break;
      }
    },
  };

  /** Fire column bursting out of the paving. Warns first, then burns. */
  function pillar(x) {
    ICH.Level.hazards.push({
      type: 'pillar', x: x - 22, y: C.GROUND_Y - 150, w: 44, h: 150,
      warn: 0.75, live: 0, expired: false,
    });
  }

  AI.alovsahi = function (b, dt, G) {
    const p = G.player;
    b.t2 += dt;
    b.core = b.state === 'core';

    // he drifts, so a corner is never a hiding place
    const want = U.clamp(p.x + p.w / 2 - b.w / 2, b.arena.x0 + 60, b.arena.x1 - b.w - 60);
    if (b.state === 'idle' || b.state === 'core') {
      b.x = U.approach(b.x, want, b.speed * dt);
    }
    b.y = b.floorY - b.h + Math.sin(b.t2 * 1.6) * 5;
    facePlayer(b, G);

    // embers rising off him all fight long
    if (Math.random() < 0.7) {
      FX.spawn({
        x: b.x + U.rnd(10, b.w - 10), y: b.y + U.rnd(20, b.h),
        vx: U.rnd(-24, 24), vy: U.rnd(-120, -40),
        life: U.rnd(0.5, 1.1), size: U.rnd(2, 5), g: -50, drag: 0.96,
        color: U.pick(['#ff9d21', '#ffd07a', '#e0400f']),
      });
    }

    switch (b.state) {
      case 'idle':
        b.cool -= dt;
        if (b.cool <= 0) {
          const roll = Math.random();
          if (b.phase >= 2 && roll < 0.3) {
            b.state = 'sweepwind'; b.t = 0.75;
            b.sweepLow = Math.random() < 0.5;
            tell(b, b.sweepLow ? 'tullan!' : 'əyil!', '#ffd07a');
          } else if (b.phase >= 3 && roll < 0.5) {
            b.state = 'meteor'; b.t = 0; b.shots = 0; tell(b, 'göydən!', '#ff9d21');
          } else if (roll < 0.72) {
            b.state = 'pillarwind'; b.t = 0.1; b.shots = 0; tell(b, 'atəş!', '#ff9d21');
          } else {
            b.state = 'balls'; b.t = 0; b.shots = 0;
          }
        }
        break;

      case 'pillarwind': {
        b.t -= dt;
        if (b.t <= 0) {
          // a line of columns with one gap to stand in
          const span = b.arena.x1 - b.arena.x0 - 160;
          const n = b.phase >= 3 ? 7 : b.phase >= 2 ? 6 : 5;
          const safe = 1 + Math.floor(Math.random() * (n - 2));
          for (let i = 0; i < n; i++) {
            if (i === safe) continue;
            pillar(b.arena.x0 + 80 + (span * i) / (n - 1));
          }
          Audio.play('roar');
          b.state = 'core'; b.t = 1.7;
        }
        break;
      }

      case 'balls':
        b.t -= dt;
        if (b.t <= 0) {
          b.shots++;
          const a = -1.35 + b.shots * 0.2;
          shoot(G, 'fire', b.x + b.w / 2, b.y + 46, Math.cos(a) * 340 * b.dir, Math.sin(a) * 340);
          Audio.play('throw');
          b.t = 0.12;
          if (b.shots >= (b.phase >= 2 ? 7 : 5)) { b.state = 'core'; b.t = 1.5; }
        }
        break;

      case 'sweepwind':
        b.t -= dt;
        if (b.t <= 0) {
          const fromLeft = p.x > b.x;
          b.sweep = {
            x: fromLeft ? b.arena.x0 + 10 : b.arena.x1 - 10,
            dir: fromLeft ? 1 : -1,
            low: b.sweepLow,
          };
          b.state = 'sweep';
          Audio.play('slash');
        }
        break;

      case 'sweep': {
        const s = b.sweep;
        s.x += s.dir * 340 * dt;
        for (let i = 0; i < 3; i++) {
          FX.spawn({
            x: s.x + U.rnd(-14, 14), y: C.GROUND_Y - (s.low ? U.rnd(0, 46) : U.rnd(60, 130)),
            vx: U.rnd(-40, 40), vy: U.rnd(-90, -10),
            life: U.rnd(0.3, 0.6), size: U.rnd(4, 9), g: -80, drag: 0.94,
            color: U.pick(['#ff9d21', '#e0400f', '#ffd07a']),
          });
        }
        if (s.x < b.arena.x0 - 30 || s.x > b.arena.x1 + 30) {
          b.sweep = null;
          b.state = 'core';
          b.t = 1.5;
        }
        break;
      }

      case 'meteor':
        b.t -= dt;
        if (b.t <= 0) {
          b.shots++;
          const mx = U.rnd(b.arena.x0 + 60, b.arena.x1 - 60);
          shoot(G, 'fire', mx, G.camY - 40, U.rnd(-30, 30), 240);
          b.t = 0.22;
          if (b.shots >= 7) { b.state = 'core'; b.t = 1.6; }
        }
        break;

      case 'core': // chest open, damage doubled — the window worth waiting for
        b.t -= dt;
        if (Math.random() < 0.8) {
          FX.spawn({
            x: b.x + b.w / 2 + U.rnd(-16, 16), y: b.y + 52,
            vx: U.rnd(-70, 70), vy: U.rnd(-110, -30),
            life: 0.5, size: U.rnd(3, 7), g: -30,
            color: U.pick(['#fff0b0', '#ffd07a']),
          });
        }
        if (b.t <= 0) { b.state = 'idle'; b.cool = b.phase >= 3 ? 0.5 : b.phase >= 2 ? 0.8 : 1.2; }
        break;
    }
  };

  /* ------------------------------------------------------------- drawing */

  const DRAW = {
    serkerde(ctx, b, time) {
      const cx = b.x + b.w / 2;
      const by = b.y + b.h;
      const ph = b.animT * (b.state === 'charge' ? 16 : 6);
      ctx.save();
      ctx.translate(cx, by);
      ctx.scale(b.dir, 1);
      const hipY = -44, shY = -74;

      // legs
      ICH.Art.seg(ctx, -6, hipY, -0.45 - Math.sin(ph) * 0.5, 22, 15, '#2a4c3d');
      ICH.Art.seg(ctx, 6, hipY, 0.45 + Math.sin(ph) * 0.5, 22, 15, '#356252');
      ICH.Art.seg(ctx, -7, hipY + 21, -0.15, 21, 13, '#2a4c3d');
      ICH.Art.seg(ctx, 7, hipY + 21, 0.15, 21, 13, '#356252');
      ctx.fillStyle = '#3a2414';
      ctx.fillRect(-16, -6, 16, 8);
      ctx.fillRect(2, -6, 16, 8);

      // scale coat over a green robe
      ctx.fillStyle = P.guardRobe;
      ctx.beginPath();
      ctx.moveTo(-20, shY); ctx.lineTo(20, shY); ctx.lineTo(24, hipY + 6); ctx.lineTo(-24, hipY + 6);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#4b7a63';
      for (let r = 0; r < 4; r++) {
        for (let cxx = -18; cxx < 20; cxx += 10) {
          ctx.beginPath();
          ctx.arc(cxx + (r % 2 ? 5 : 0), shY + 8 + r * 8, 4.6, Math.PI, 0);
          ctx.fill();
        }
      }
      ctx.fillStyle = P.gold;
      ctx.fillRect(-24, hipY - 2, 48, 5);

      // head with a plumed helmet
      ctx.fillStyle = P.skin;
      ctx.beginPath(); ctx.arc(3, shY - 14, 13, 0, U.TAU); ctx.fill();
      ctx.fillStyle = '#3a2a20';
      ctx.beginPath(); ctx.ellipse(1, shY - 5, 12, 8, 0, 0, Math.PI); ctx.fill();
      ctx.fillStyle = P.ink;
      ctx.beginPath(); ctx.arc(8, shY - 16, 2.2, 0, U.TAU); ctx.fill();
      ctx.fillStyle = P.steelDark;
      ctx.beginPath(); ctx.arc(2, shY - 20, 14, Math.PI, U.TAU); ctx.fill();
      ctx.fillStyle = P.steel;
      ctx.fillRect(-12, shY - 22, 28, 5);
      ctx.fillStyle = P.gold;
      ctx.fillRect(-1, shY - 44, 4, 22);
      ctx.fillStyle = '#b8232b';
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.ellipse(1 + Math.sin(time * 4 + i) * 3, shY - 46 - i * 5, 7 - i, 4, 0.4, 0, U.TAU);
        ctx.fill();
      }

      // scimitar arm
      let arm = -0.8 + Math.sin(ph) * 0.3;
      if (b.state === 'combo') arm = -2.2 + (1 - U.clamp(b.t / 0.44, 0, 1)) * 3.6;
      if (b.state === 'wind' || b.state === 'charge') arm = -1.9;
      if (b.state === 'stun') arm = 1.5;
      const el = ICH.Art.seg(ctx, 12, shY + 4, arm, 20, 13, P.skin);
      const hd = ICH.Art.seg(ctx, el[0], el[1], arm + 0.4, 17, 11, P.skin);
      ctx.save();
      ctx.translate(hd[0], hd[1]);
      ctx.rotate(arm + 1.0);
      ctx.fillStyle = P.goldDark;
      ctx.fillRect(-5, -8, 10, 16);
      ctx.strokeStyle = P.steel;
      ctx.lineWidth = 8;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, 5);
      ctx.quadraticCurveTo(24, 16, 52, -4);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(4, 3);
      ctx.quadraticCurveTo(24, 12, 48, -4);
      ctx.stroke();
      ctx.restore();

      // shield: raised unless he is winded
      const sy = b.shield ? shY + 6 : shY + 26;
      const sa = b.shield ? 0 : 0.9;
      ctx.save();
      ctx.translate(-18, sy);
      ctx.rotate(sa);
      ctx.fillStyle = '#7a5a2a';
      ctx.beginPath(); ctx.arc(0, 0, 22, 0, U.TAU); ctx.fill();
      ctx.fillStyle = P.goldDark;
      ctx.beginPath(); ctx.arc(0, 0, 18, 0, U.TAU); ctx.fill();
      ctx.fillStyle = P.gold;
      ICH.Art.buta(ctx, 0, 0, 10, 0);
      ctx.fill();
      ctx.fillStyle = '#5a3f18';
      ctx.beginPath(); ctx.arc(0, 0, 4, 0, U.TAU); ctx.fill();
      ctx.restore();
      ctx.restore();
    },

    bazarbasi(ctx, b, time) {
      const cx = b.x + b.w / 2;
      const by = b.y + b.h;
      ctx.save();
      ctx.translate(cx, by);
      ctx.scale(b.dir, 1);
      const squash = b.state === 'pound' ? 1.25 : 1;
      ctx.scale(squash, 2 - squash);

      // little legs under a lot of merchant
      ICH.Art.seg(ctx, -10, -30, -0.3, 15, 13, '#4a3a6b');
      ICH.Art.seg(ctx, 10, -30, 0.3, 15, 13, '#5b4880');
      ctx.fillStyle = '#3a2414';
      ctx.fillRect(-20, -6, 17, 8);
      ctx.fillRect(4, -6, 17, 8);

      // robe
      ctx.fillStyle = '#5b4880';
      ctx.beginPath();
      ctx.moveTo(-16, -74);
      ctx.quadraticCurveTo(-38, -50, -30, -26);
      ctx.lineTo(30, -26);
      ctx.quadraticCurveTo(38, -50, 16, -74);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = P.carpetA;
      ctx.fillRect(-30, -40, 60, 8);
      ctx.fillStyle = P.gold;
      ctx.fillRect(-30, -37, 60, 2.5);
      ctx.fillStyle = '#7a68a0';
      for (let i = -1; i <= 1; i++) { ICH.Art.buta(ctx, i * 14, -56, 6, i * 0.3); ctx.fill(); }

      // head, beard, enormous turban
      ctx.fillStyle = P.skin;
      ctx.beginPath(); ctx.arc(2, -86, 13, 0, U.TAU); ctx.fill();
      ctx.fillStyle = '#e8e2d4';
      ctx.beginPath();
      ctx.moveTo(-8, -82); ctx.quadraticCurveTo(2, -60, 12, -82);
      ctx.quadraticCurveTo(2, -74, -8, -82);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = P.ink;
      ctx.beginPath(); ctx.arc(8, -89, 2, 0, U.TAU); ctx.fill();
      ctx.fillStyle = '#f2ead4';
      ctx.beginPath(); ctx.ellipse(2, -101, 20, 13, 0, 0, U.TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(2, -108, 15, 9, 0, 0, U.TAU); ctx.fill();
      ctx.fillStyle = P.carpetB;
      ctx.fillRect(-19, -101, 38, 4);
      ctx.fillStyle = P.gem;
      ctx.beginPath(); ctx.arc(14, -105, 4, 0, U.TAU); ctx.fill();

      // arms: one clutching a purse, one weighing out fate
      const swing = Math.sin(time * 3) * 0.2;
      const l = ICH.Art.seg(ctx, -14, -70, -0.9 + swing, 16, 11, P.skin);
      ICH.Art.seg(ctx, l[0], l[1], -0.3, 14, 9, P.skin);
      const r = ICH.Art.seg(ctx, 14, -70, 0.9 - swing, 16, 11, P.skin);
      const rh = ICH.Art.seg(ctx, r[0], r[1], 0.4, 14, 9, P.skin);
      ctx.fillStyle = P.goldDark;
      ctx.beginPath(); ctx.ellipse(rh[0] + 4, rh[1] + 8, 9, 11, 0, 0, U.TAU); ctx.fill();
      ctx.fillStyle = P.gold;
      ctx.fillRect(rh[0] - 2, rh[1] - 1, 12, 4);
      ctx.restore();
    },

    qargasahi(ctx, b, time) {
      const cx = b.x + b.w / 2;
      const cy = b.y + b.h / 2;
      const flap = b.state === 'rest' ? 0.1 : Math.sin(time * 9);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(b.dir, 1);

      // wings
      ctx.fillStyle = '#1e1c22';
      [-1, 1].forEach((s) => {
        ctx.beginPath();
        ctx.moveTo(0, -4);
        ctx.quadraticCurveTo(s * 46, -30 - flap * 26, s * 74, -2 - flap * 14);
        ctx.quadraticCurveTo(s * 48, 4, s * 20, 12);
        ctx.quadraticCurveTo(s * 12, 2, 0, 6);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#332f38';
        ctx.beginPath();
        ctx.moveTo(s * 20, -6);
        ctx.quadraticCurveTo(s * 44, -18 - flap * 16, s * 62, -2 - flap * 10);
        ctx.quadraticCurveTo(s * 40, 0, s * 20, 4);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#1e1c22';
      });

      // body + tail
      ctx.fillStyle = P.crow;
      ctx.beginPath();
      ctx.ellipse(0, 2, 26, 17, 0.1, 0, U.TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-20, 2); ctx.lineTo(-52, 12); ctx.lineTo(-46, -4);
      ctx.closePath();
      ctx.fill();

      // head, beak, crown
      ctx.beginPath(); ctx.arc(22, -12, 13, 0, U.TAU); ctx.fill();
      ctx.fillStyle = P.crowBeak;
      ctx.beginPath();
      ctx.moveTo(32, -15); ctx.lineTo(54, -10); ctx.lineTo(32, -5);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#c8262e';
      ctx.beginPath(); ctx.arc(26, -15, 3.2, 0, U.TAU); ctx.fill();
      ctx.fillStyle = P.gold;
      ctx.beginPath();
      ctx.moveTo(12, -22);
      for (let i = 0; i < 4; i++) {
        ctx.lineTo(14 + i * 6, -34 - (i % 2 ? 6 : 0));
        ctx.lineTo(17 + i * 6, -24);
      }
      ctx.lineTo(34, -22);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = P.gem;
      ctx.beginPath(); ctx.arc(23, -30, 3, 0, U.TAU); ctx.fill();

      // claws, tucked unless he is on the ground
      ctx.strokeStyle = P.crowBeak;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      const drop = b.state === 'rest' || b.state === 'dive' ? 16 : 6;
      [-8, 8].forEach((ox) => {
        ctx.beginPath();
        ctx.moveTo(ox, 14);
        ctx.lineTo(ox + 4, 14 + drop);
        ctx.stroke();
      });
      ctx.restore();
    },

    div(ctx, b, time) {
      const cx = b.x + b.w / 2;
      const by = b.y + b.h;
      const ph = b.animT * 4;
      ctx.save();
      ctx.translate(cx, by);
      ctx.scale(b.dir, 1);
      const hipY = -52, shY = -88;
      const skin = '#6f8a86';
      const dark = '#4d635f';

      ICH.Art.seg(ctx, -12, hipY, -0.4 - Math.sin(ph) * 0.4, 26, 20, dark);
      ICH.Art.seg(ctx, 12, hipY, 0.4 + Math.sin(ph) * 0.4, 26, 20, skin);
      ICH.Art.seg(ctx, -14, hipY + 25, -0.1, 25, 17, dark);
      ICH.Art.seg(ctx, 14, hipY + 25, 0.1, 25, 17, skin);
      ctx.fillStyle = '#3b2f22';
      ctx.fillRect(-26, -8, 22, 10);
      ctx.fillRect(6, -8, 22, 10);

      // torso
      ctx.fillStyle = skin;
      ctx.beginPath();
      ctx.moveTo(-26, shY); ctx.lineTo(26, shY); ctx.lineTo(20, hipY + 6); ctx.lineTo(-20, hipY + 6);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = dark;
      ctx.beginPath(); ctx.ellipse(-9, shY + 16, 9, 7, 0, 0, U.TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(10, shY + 16, 9, 7, 0, 0, U.TAU); ctx.fill();
      ctx.fillStyle = '#8d5a2c';
      ctx.fillRect(-22, hipY - 4, 44, 12);
      ctx.fillStyle = P.carpetA;
      ctx.fillRect(-22, hipY - 4, 44, 3);

      // head: one horn, one tusk, no patience
      ctx.fillStyle = skin;
      ctx.beginPath(); ctx.arc(4, shY - 18, 19, 0, U.TAU); ctx.fill();
      ctx.fillStyle = dark;
      ctx.beginPath(); ctx.ellipse(2, shY - 8, 17, 11, 0, 0, Math.PI); ctx.fill();
      ctx.fillStyle = '#f2ead4';
      ctx.beginPath();
      ctx.moveTo(10, shY - 6); ctx.lineTo(16, shY - 20); ctx.lineTo(19, shY - 5);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffcf4a';
      ctx.beginPath(); ctx.arc(12, shY - 22, 4.4, 0, U.TAU); ctx.fill();
      ctx.fillStyle = P.ink;
      ctx.beginPath(); ctx.arc(13.5, shY - 22, 2, 0, U.TAU); ctx.fill();
      ctx.fillStyle = '#d8cbb2';
      ctx.beginPath();
      ctx.moveTo(-6, shY - 34);
      ctx.quadraticCurveTo(-22, shY - 58, -4, shY - 62);
      ctx.quadraticCurveTo(-10, shY - 48, 0, shY - 32);
      ctx.closePath();
      ctx.fill();

      // arms: heavy, and one of them is always about to come down
      let arm = -0.5 + Math.sin(ph) * 0.3;
      if (b.state === 'slamwind') arm = -2.4;
      else if (b.state === 'slam') arm = 1.5;
      else if (b.state === 'throwwind') arm = -2.6;
      const el = ICH.Art.seg(ctx, 20, shY + 8, arm, 28, 19, skin);
      const hd = ICH.Art.seg(ctx, el[0], el[1], arm + 0.4, 24, 16, skin);
      ctx.fillStyle = skin;
      ctx.beginPath(); ctx.arc(hd[0], hd[1] + 4, 13, 0, U.TAU); ctx.fill();
      const el2 = ICH.Art.seg(ctx, -20, shY + 8, 0.6, 26, 17, dark);
      ICH.Art.seg(ctx, el2[0], el2[1], 0.3, 22, 14, dark);
      ctx.restore();
    },

    ejdaha(ctx, b, time) {
      const cx = b.x + b.w / 2;
      const cy = b.y + b.h / 2;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(b.dir, 1);

      // coils trailing back into the water
      ctx.strokeStyle = '#1f6a70';
      ctx.lineWidth = 26;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i <= 6; i++) {
        const t = i / 6;
        const x = -20 - t * 150;
        const y = 20 + Math.sin(time * 2.4 - t * 4) * 18 + t * 40;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.strokeStyle = '#2b9099';
      ctx.lineWidth = 18;
      ctx.stroke();
      // dorsal fins
      ctx.fillStyle = '#0f4d55';
      for (let i = 1; i <= 5; i++) {
        const t = i / 6;
        const x = -20 - t * 150;
        const y = 20 + Math.sin(time * 2.4 - t * 4) * 18 + t * 40;
        ctx.beginPath();
        ctx.moveTo(x - 8, y - 8); ctx.lineTo(x, y - 26); ctx.lineTo(x + 8, y - 8);
        ctx.closePath();
        ctx.fill();
      }

      // head
      ctx.fillStyle = '#2b9099';
      ctx.beginPath();
      ctx.ellipse(4, -2, 34, 22, -0.12, 0, U.TAU);
      ctx.fill();
      ctx.fillStyle = '#1f6a70';
      ctx.beginPath();
      ctx.ellipse(0, 6, 30, 13, -0.12, 0, U.TAU);
      ctx.fill();
      // jaw
      ctx.fillStyle = '#2b9099';
      ctx.beginPath();
      ctx.moveTo(22, -8); ctx.lineTo(52, -2); ctx.lineTo(48, 10); ctx.lineTo(20, 12);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#f2ead4';
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(26 + i * 7, 6); ctx.lineTo(29 + i * 7, 14); ctx.lineTo(32 + i * 7, 6);
        ctx.closePath();
        ctx.fill();
      }
      // eye + horns
      ctx.fillStyle = '#ffcf4a';
      ctx.beginPath(); ctx.ellipse(18, -10, 6, 5, 0, 0, U.TAU); ctx.fill();
      ctx.fillStyle = P.ink;
      ctx.beginPath(); ctx.ellipse(20, -10, 2, 4.4, 0, 0, U.TAU); ctx.fill();
      ctx.fillStyle = '#0f4d55';
      [0, 1, 2].forEach((i) => {
        ctx.beginPath();
        ctx.moveTo(-2 - i * 12, -18);
        ctx.lineTo(-8 - i * 12, -40 + i * 6);
        ctx.lineTo(6 - i * 12, -20);
        ctx.closePath();
        ctx.fill();
      });
      // whiskers
      ctx.strokeStyle = '#5fc9d8';
      ctx.lineWidth = 3;
      [-1, 1].forEach((s) => {
        ctx.beginPath();
        ctx.moveTo(34, 2 + s * 6);
        ctx.quadraticCurveTo(52, 8 + s * 16 + Math.sin(time * 3 + s) * 5, 66, -2 + s * 22);
        ctx.stroke();
      });
      ctx.restore();
    },
  };

  /* ---- Alov Şahı: basalt body split by lava, crowned in flame. */
  DRAW.alovsahi = function (ctx, b, time) {
    const cx = b.x + b.w / 2;
    const by = b.y + b.h;
    const open = b.core ? 1 : 0;
    ctx.save();
    ctx.translate(cx, by);
    ctx.scale(b.dir, 1);

    // heat haze on the paving
    const hg = ctx.createRadialGradient(0, 0, 10, 0, 0, 150);
    hg.addColorStop(0, 'rgba(255,140,40,0.35)');
    hg.addColorStop(1, 'rgba(255,140,40,0)');
    ctx.fillStyle = hg;
    ctx.fillRect(-150, -70, 300, 90);

    const hipY = -66, shY = -112;
    const rock = '#3b2622';
    const rockLit = '#54332b';

    // legs like broken columns
    ICH.Art.seg(ctx, -18, hipY, -0.16, 34, 28, rock);
    ICH.Art.seg(ctx, 18, hipY, 0.16, 34, 28, rockLit);
    ctx.fillStyle = '#241713';
    ctx.fillRect(-38, -10, 34, 12);
    ctx.fillRect(6, -10, 34, 12);

    // torso
    ctx.fillStyle = rock;
    ctx.beginPath();
    ctx.moveTo(-34, shY); ctx.lineTo(34, shY); ctx.lineTo(26, hipY + 8); ctx.lineTo(-26, hipY + 8);
    ctx.closePath();
    ctx.fill();
    // lava veins
    ctx.strokeStyle = '#e0400f';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 13, shY + 6);
      ctx.lineTo(i * 13 + 6, shY + 32);
      ctx.lineTo(i * 13 - 3, hipY + 4);
      ctx.stroke();
    }

    // the core, banked while he attacks and blazing while he recovers
    const cr = 17 + open * 7 + Math.sin(time * 9) * (1.5 + open * 2);
    const cg = ctx.createRadialGradient(0, shY + 34, 2, 0, shY + 34, cr * 2.4);
    cg.addColorStop(0, open ? 'rgba(255,255,235,0.98)' : 'rgba(255,180,80,0.85)');
    cg.addColorStop(0.4, open ? 'rgba(255,200,80,0.7)' : 'rgba(224,64,15,0.4)');
    cg.addColorStop(1, 'rgba(224,64,15,0)');
    ctx.fillStyle = cg;
    ctx.beginPath(); ctx.arc(0, shY + 34, cr * 2.4, 0, U.TAU); ctx.fill();
    ctx.fillStyle = open ? '#fff6d8' : '#e0400f';
    ctx.beginPath(); ctx.arc(0, shY + 34, cr, 0, U.TAU); ctx.fill();
    ctx.fillStyle = rock;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * U.TAU + time * 0.3;
      const gap = open ? 12 : 2;
      ctx.save();
      ctx.translate(Math.cos(a) * (cr + gap), shY + 34 + Math.sin(a) * (cr + gap));
      ctx.rotate(a);
      ctx.fillRect(-7, -5, 14, 10);
      ctx.restore();
    }

    // shoulders and arms of shaped flame
    [-1, 1].forEach((s) => {
      ctx.fillStyle = s < 0 ? rock : rockLit;
      ctx.beginPath();
      ctx.ellipse(s * 34, shY + 10, 15, 17, 0, 0, U.TAU);
      ctx.fill();
      ctx.strokeStyle = '#ff9d21';
      ctx.lineWidth = 12;
      ctx.beginPath();
      ctx.moveTo(s * 36, shY + 16);
      ctx.quadraticCurveTo(s * 54 + Math.sin(time * 3 + s) * 6, shY + 50, s * 42, shY + 82);
      ctx.stroke();
      ctx.strokeStyle = '#ffd07a';
      ctx.lineWidth = 5;
      ctx.stroke();
    });

    // head: a mask of basalt with burning eyes
    ctx.fillStyle = rock;
    ctx.beginPath();
    ctx.moveTo(-20, shY - 4); ctx.lineTo(20, shY - 4); ctx.lineTo(15, shY - 42);
    ctx.lineTo(-15, shY - 42);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fff0b0';
    [-8, 8].forEach((ox) => {
      ctx.beginPath();
      ctx.moveTo(ox - 6, shY - 28); ctx.lineTo(ox + 6, shY - 30); ctx.lineTo(ox + 4, shY - 22);
      ctx.closePath();
      ctx.fill();
    });
    ctx.strokeStyle = '#e0400f';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(-12, shY - 12);
    for (let i = 0; i < 5; i++) ctx.lineTo(-12 + i * 6, shY - 12 + (i % 2 ? 5 : 0));
    ctx.stroke();

    // crown of flame
    for (let i = 0; i < 7; i++) {
      const fx = -21 + i * 7;
      const h = 26 + Math.sin(time * 7 + i * 1.3) * 10 + (i === 3 ? 14 : 0);
      ctx.fillStyle = i % 2 ? '#ff9d21' : '#e0400f';
      ctx.beginPath();
      ctx.moveTo(fx - 5, shY - 40);
      ctx.quadraticCurveTo(fx + Math.sin(time * 5 + i) * 5, shY - 40 - h, fx + 5, shY - 40);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = '#fff0b0';
    ctx.beginPath();
    ctx.moveTo(-4, shY - 40);
    ctx.quadraticCurveTo(0, shY - 62 - Math.sin(time * 6) * 8, 4, shY - 40);
    ctx.closePath();
    ctx.fill();

    ctx.restore();

    // the sweeping wall of fire
    if (b.sweep) {
      const s = b.sweep;
      const y0 = s.low ? C.GROUND_Y - 52 : C.GROUND_Y - 138;
      const hh = s.low ? 52 : 82;
      ctx.save();
      ctx.globalAlpha = 0.9;
      const g = ctx.createLinearGradient(s.x - 26, 0, s.x + 26, 0);
      g.addColorStop(0, 'rgba(224,64,15,0)');
      g.addColorStop(0.5, '#ff9d21');
      g.addColorStop(1, 'rgba(224,64,15,0)');
      ctx.fillStyle = g;
      ctx.fillRect(s.x - 26, y0, 52, hh);
      ctx.fillStyle = 'rgba(255,240,176,0.85)';
      for (let i = 0; i < 7; i++) {
        const yy = y0 + (hh / 7) * i;
        const ww = 10 + Math.sin(time * 18 + i) * 6;
        ctx.fillRect(s.x - ww / 2, yy, ww, hh / 7);
      }
      ctx.restore();
    }
  };

  /* --------------------------------------------------------------- module */

  const Boss = {
    DEFS,

    create(spec) {
      const d = DEFS[spec.id];
      const lap = ICH.Level.lap || 0;
      const hp = d.hp + lap * (d.final ? 8 : 4);
      const b = {
        id: spec.id, name: d.name, ru: d.ru, final: !!d.final,
        w: d.w, h: d.h, speed: d.speed,
        hp, maxHp: hp, phase: 1, phases: d.final ? 3 : 2,
        core: false, sweep: null,
        x: spec.arena.x1 - 300, y: C.GROUND_Y - d.h,
        vx: 0, vy: 0, dir: -1, grounded: false,
        floorY: C.GROUND_Y,
        arena: spec.arena, spec,
        state: 'intro', t: 1.3, t2: 0, cool: 1, swing: 0, shots: 0,
        animT: 0, hurtT: 0, hitId: -1, invulT: 0.6,
        dead: false, deadT: 0, shield: false,
        stompable: !!d.stompable, flying: !!d.flying,
      };
      if (d.flying) {
        b.homeY = C.GROUND_Y - 210;
        b.y = spec.id === 'ejdaha' ? C.GROUND_Y + 60 : b.homeY;
      }
      return b;
    },

    update(b, dt, G) {
      b.animT += dt;
      b.hurtT = Math.max(0, b.hurtT - dt);
      b.invulT = Math.max(0, b.invulT - dt);

      if (b.dead) {
        b.deadT += dt;
        if (!b.flying) fall(b, dt);
        if (Math.random() < 0.5) {
          FX.burst(b.x + U.rnd(0, b.w), b.y + U.rnd(0, b.h), 3, {
            color: ['#ffd98a', '#ff9a3a', '#fff0bd'], speedMax: 190, lifeMax: 0.6, kind: 'spark',
          });
        }
        return;
      }

      if (b.state === 'intro') {
        b.t -= dt;
        if (!b.flying) fall(b, dt);
        if (b.t <= 0) {
          b.state = b.id === 'ejdaha' ? 'under'
            : b.id === 'alovsahi' ? 'idle'
              : b.flying ? 'hover' : 'walk';
          b.t = 1.2;
          b.cool = 1;
        }
        return;
      }

      const want = 1 + Math.floor((1 - b.hp / b.maxHp) * b.phases);
      if (want > b.phase && want <= b.phases) {
        b.phase = want;
        FX.flash('rgba(255,180,90,0.35)', 0.45);
        FX.shake(9, 0.45);
        Audio.play('roar');
        tell(b, b.phase >= 3 ? 'ODUM!' : 'qəzəb!', '#ff9a6a');
      }

      AI[b.id](b, dt, G);
    },

    draw(ctx, b, time) {
      if (b.hurtT > 0 && Math.floor(b.hurtT * 40) % 2 === 0) ctx.globalAlpha = 0.55;
      if (b.state === 'intro') ctx.globalAlpha = U.clamp(1.3 - b.t, 0, 1);
      if (b.dead) ctx.globalAlpha = Math.max(0, 1 - b.deadT / 1.4);
      // contact shadow
      if (!b.flying || b.state === 'rest') {
        ctx.globalAlpha *= 0.9;
        ctx.fillStyle = 'rgba(40,24,8,0.3)';
        ctx.beginPath();
        ctx.ellipse(b.x + b.w / 2, b.floorY + 3, b.w * 0.6, 6, 0, 0, U.TAU);
        ctx.fill();
        ctx.globalAlpha /= 0.9;
      }
      DRAW[b.id](ctx, b, time);
      ctx.globalAlpha = 1;
    },

    /** Box you can actually damage. */
    hitBox(b) {
      if (b.id === 'ejdaha' && (b.state === 'under' || b.state === 'rise')) return null;
      if (b.invulT > 0 || b.state === 'intro' || b.dead) return null;
      return { x: b.x, y: b.y, w: b.w, h: b.h };
    },

    /** True when a frontal sabre hit just clangs off. */
    blocks(b, fromX) {
      if (b.id !== 'serkerde' || !b.shield) return false;
      const front = b.dir > 0 ? fromX > b.x + b.w * 0.4 : fromX < b.x + b.w * 0.6;
      return front;
    },

    /** Boxes that hurt the player, on top of simple body contact. */
    attackBoxes(b) {
      const out = [];
      if (b.dead || b.state === 'intro') return out;
      if (b.id === 'serkerde' && b.state === 'combo' && b.t > 0.1) {
        out.push({ x: b.dir > 0 ? b.x + b.w - 10 : b.x - 62, y: b.y + 16, w: 72, h: 54 });
      }
      if (b.id === 'bazarbasi' && b.state === 'pound') {
        out.push({ x: b.x - 90, y: b.y + b.h - 34, w: b.w + 180, h: 36 });
      }
      if (b.id === 'div' && b.state === 'slam') {
        out.push({ x: b.x - 110, y: b.y + b.h - 38, w: b.w + 220, h: 40 });
      }
      if (b.id === 'qargasahi' && b.state === 'dive') {
        out.push({ x: b.x + 10, y: b.y, w: b.w - 20, h: b.h });
      }
      if (b.sweep) {
        const s = b.sweep;
        out.push(s.low
          ? { x: s.x - 20, y: C.GROUND_Y - 52, w: 40, h: 54 }
          : { x: s.x - 20, y: C.GROUND_Y - 138, w: 40, h: 82 });
      }
      return out;
    },

    damage(b, n, G, fromX) {
      if (b.dead || b.invulT > 0 || b.state === 'intro') return false;
      if (this.blocks(b, fromX)) {
        Audio.play('clang');
        FX.text(b.x + b.w / 2, b.y - 10, 'qalxan!', '#dfe7ef', 14);
        FX.burst(fromX, b.y + b.h / 2, 8, { color: ['#eef4f9', '#93a2b1'], speedMax: 200, kind: 'spark' });
        if (!b.taughtBlock) {
          // one nudge, the first time the shield turns you away
          b.taughtBlock = true;
          FX.text(b.x + b.w / 2, b.y - 34, 'бей со спины или после рывка', '#ffd98a', 15);
        }
        return false;
      }
      if (b.core) {
        n *= 2;
        FX.text(b.x + b.w / 2, b.y + 30, 'nüvə!', '#fff6d8', 15);
      }
      b.hp -= n;
      b.hurtT = 0.3;
      b.invulT = 0.12;
      Audio.play('kill');
      FX.shake(4, 0.16);
      FX.buzz(b.core ? 22 : 10); // a hit into the open core should feel bigger
      FX.burst(b.x + b.w / 2, b.y + b.h / 2, 10, {
        color: ['#fff0bd', '#ff9a6a'], speedMax: 220, kind: 'spark',
      });
      if (b.hp <= 0) this.kill(b, G);
      return true;
    },

    kill(b, G) {
      b.dead = true;
      b.deadT = 0;
      Audio.play('die');
      FX.shake(14, 0.7);
      FX.slowmo(0.8, 0.4);
      FX.flash('rgba(255,220,150,0.45)', 0.55);
      FX.burst(b.x + b.w / 2, b.y + b.h / 2, 40, {
        color: ['#ffd98a', '#ff7a2a', '#fff0bd'], speedMax: 420, lifeMax: 1, kind: 'shard', sizeMax: 8,
      });
      const bonus = 1500;
      G.score += Math.round(bonus * G.combo);
      FX.text(b.x + b.w / 2, b.y, '+' + Math.round(bonus * G.combo), '#fff0bd', 24);
      // spoils
      const gx = b.x + b.w / 2;
      ICH.Level.pickups.push(ICH.Ent.pickup('tea', gx - 60, C.GROUND_Y - 60));
      ICH.Level.pickups.push(ICH.Ent.pickup('nar', gx, C.GROUND_Y - 60));
      ICH.Level.pickups.push(ICH.Ent.pickup('gem', gx + 60, C.GROUND_Y - 60));
      ICH.Level.pickups.push(ICH.Ent.pickup('zefer', gx, C.GROUND_Y - 130));
      for (let i = 0; i < 10; i++) {
        ICH.Level.pickups.push(ICH.Ent.pickup('coin', gx + U.rnd(-140, 140), C.GROUND_Y - U.rnd(40, 150)));
      }
    },
  };

  ICH.Boss = Boss;
})(window.ICH);
