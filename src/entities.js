/* İçərişəhər Runner — player, enemies, pickups, projectiles + their physics. */
(function (ICH) {
  'use strict';
  const U = ICH.U;
  const C = ICH.C;
  const FX = ICH.FX;
  const Audio = ICH.Audio;

  /* -------------------------------------------------- collision helpers */

  function solidAt(x, y) {
    for (const p of ICH.Level.platforms) {
      if (p.oneWay) continue;
      if (x > p.x && x < p.x + p.w && y > p.y && y < p.y + p.h) return p;
    }
    return null;
  }

  /** Any platform (incl. one-way) whose top surface is just under this point. */
  function floorAt(x, y) {
    for (const p of ICH.Level.platforms) {
      if (x > p.x && x < p.x + p.w && y >= p.y - 2 && y < p.y + 14) return p;
    }
    return null;
  }

  /* ================================================================ PLAYER */

  const Player = {
    create() {
      return {
        x: 120, y: C.GROUND_Y - 56, w: 28, h: 56,
        vx: 0, vy: 0, facing: 1,
        // he is placed exactly on the paving, so he starts standing on it —
        // otherwise a jump on the very first frame reads as a mid-air one
        grounded: true, prevBottom: C.GROUND_Y,
        state: 'idle',
        animT: 0,
        jumps: 0, coyote: C.COYOTE, buffer: 0,
        slashT: 0, slashDur: 0.2, slashCd: 0, slashId: 0, slashBuf: 0,
        throwT: 0, throwDur: 0.22, throwCd: 0,
        invulT: 0, hurtT: 0,
        sliding: false, slideT: 0,
        carpetT: 0,
        rope: null, ropeCd: 0, ropeOmega: 0,
        dropT: 0,
        dead: false, deadT: 0,
        stepT: 0,
        // ---- purely visual state, all of it read by the renderer
        sx: 1, sy: 1,          // squash and stretch
        flipT: 0,              // mid-air somersault on the second jump
        landT: 0, landPow: 0,  // landing recovery crouch
        turnT: 0,              // skid when you reverse at speed
        faceVis: 1,            // facing, smoothed so he pivots instead of mirroring
        airT: 0,
        idleT: 0, fidget: '', fidgetT: 0,
        blink: 0, blinkT: 3,
        sashX: 0, sashY: 0,
      };
    },

    canStand(p) {
      const y0 = p.y - 22;
      return !solidAt(p.x + 3, y0 + 4) && !solidAt(p.x + p.w - 3, y0 + 4) && !solidAt(p.x + p.w / 2, y0 + 4);
    },

    update(p, dt, G) {
      const In = ICH.Input;
      const dead = p.dead;

      p.animT += dt;
      p.slashCd = Math.max(0, p.slashCd - dt);
      // springs and timers behind the animation
      const settle = 1 - Math.pow(0.0004, dt);
      p.sx += (1 - p.sx) * settle;
      p.sy += (1 - p.sy) * settle;
      p.landT = Math.max(0, p.landT - dt);
      p.turnT = Math.max(0, p.turnT - dt);
      p.flipT = Math.max(0, p.flipT - dt);
      p.faceVis = U.approach(p.faceVis, p.facing, dt * 14);
      p.blinkT -= dt;
      if (p.blinkT <= 0) { p.blink = 0.11; p.blinkT = U.rnd(2.4, 6.5); }
      p.blink = Math.max(0, p.blink - dt);
      // the sash tail trails the body instead of being welded to it
      const sashTX = U.clamp(-p.vx * 0.024, -10, 10);
      const sashTY = U.clamp(-p.vy * 0.013, -8, 10);
      const drag = 1 - Math.pow(0.002, dt);
      p.sashX += (sashTX - p.sashX) * drag;
      p.sashY += (sashTY - p.sashY) * drag;
      p.throwCd = Math.max(0, p.throwCd - dt);
      p.slashT = Math.max(0, p.slashT - dt);
      p.throwT = Math.max(0, p.throwT - dt);
      p.invulT = Math.max(0, p.invulT - dt);
      p.hurtT = Math.max(0, p.hurtT - dt);
      p.ropeCd = Math.max(0, p.ropeCd - dt);
      if (p.carpetT > 0) {
        p.carpetT -= dt;
        if (p.carpetT <= 0) FX.text(p.x + p.w / 2, p.y - 14, 'xalça bitdi', '#e9b7a0', 13);
      }

      if (dead) {
        p.deadT += dt;
        p.vy = Math.min(p.vy + C.GRAVITY * dt, C.MAX_FALL);
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= Math.pow(0.9, dt * 60);
        return;
      }

      /* ------------------------------------------------------- on a rope */
      if (p.rope) {
        const r = p.rope;
        const alpha = -(C.GRAVITY / r.len) * Math.sin(r.angle);
        // pumping the swing, like kicking on a playground swing
        const pump = (In.held('right') ? 1 : 0) - (In.held('left') ? 1 : 0);
        r.omega += (alpha + pump * 2.6) * dt;
        r.omega *= Math.pow(0.995, dt * 60);
        r.angle += r.omega * dt;
        p.ropeOmega = r.omega;
        p.x = r.x + Math.sin(r.angle) * r.len - p.w / 2;
        p.y = r.y + Math.cos(r.angle) * r.len;
        p.vx = r.omega * r.len * Math.cos(r.angle);
        p.vy = -r.omega * r.len * Math.sin(r.angle);
        if (Math.abs(p.vx) > 30) p.facing = Math.sign(p.vx);
        p.state = 'rope';
        p.grounded = false;

        if (In.pressed('jump') || In.pressed('down')) {
          const boost = In.pressed('jump') ? 300 : 0;
          p.vy -= boost;
          p.vx *= 1.18;
          r.holder = null;
          p.rope = null;
          p.ropeCd = 0.32;
          p.jumps = 1;
          Audio.play('jump');
          FX.burst(p.x + p.w / 2, p.y + 10, 6, { color: '#e8d9b4', speedMax: 140, lifeMax: 0.4, g: 400 });
        }
        return;
      }

      /* ------------------------------------------------- horizontal move */
      const left = In.held('left');
      const right = In.held('right');
      const dir = (right ? 1 : 0) - (left ? 1 : 0);
      const accel = p.grounded ? C.RUN_ACCEL : C.AIR_ACCEL;
      const maxSpeed = C.RUN_SPEED * (p.carpetT > 0 ? 1.14 : 1);

      if (p.sliding) {
        p.vx = U.approach(p.vx, 0, 900 * dt);
        p.slideT -= dt;
        if (p.slideT <= 0 && this.canStand(p)) {
          p.sliding = false;
          p.y -= 22;
          p.h = 56;
        }
      } else if (dir !== 0) {
        if (p.grounded && dir !== Math.sign(p.vx) && Math.abs(p.vx) > 190 && p.turnT <= 0) {
          p.turnT = 0.22;
          p.sx = 1.14; p.sy = 0.92;
          Audio.play('step');
          for (let i = 0; i < 5; i++) FX.dust(p.x + p.w / 2 + U.rnd(-8, 8), p.y + p.h, -dir);
        }
        p.vx = U.approach(p.vx, dir * maxSpeed, accel * dt);
        p.facing = dir;
      } else {
        p.vx = U.approach(p.vx, 0, (p.grounded ? C.FRICTION : C.AIR_ACCEL * 0.5) * dt);
      }

      /* -------------------------------------------------------- crouch/slide */
      if (In.pressed('down') && p.grounded && !p.sliding && Math.abs(p.vx) > 120) {
        p.sliding = true;
        p.slideT = 0.42;
        p.h = 34;
        p.y += 22;
        p.vx = p.facing * Math.max(Math.abs(p.vx), 330);
        Audio.play('land');
        for (let i = 0; i < 6; i++) FX.dust(p.x + p.w / 2, p.y + p.h, p.facing);
      }

      /* ---------------------------------------------------------- jumping */
      if (In.pressed('jump')) p.buffer = C.JUMP_BUFFER;
      p.buffer = Math.max(0, p.buffer - dt);
      p.coyote = Math.max(0, p.coyote - dt);

      if (p.buffer > 0) {
        if (p.grounded || p.coyote > 0) {
          p.vy = C.JUMP_VEL;
          p.grounded = false;
          p.coyote = 0;
          p.buffer = 0;
          p.jumps = 1;
          if (p.sliding && this.canStand(p)) { p.sliding = false; p.y -= 22; p.h = 56; }
          p.sx = 0.84; p.sy = 1.22;
          Audio.play('jump');
          for (let i = 0; i < 5; i++) FX.dust(p.x + p.w / 2 + U.rnd(-6, 6), p.y + p.h, 0);
        } else if (p.jumps < 2) {
          p.vy = C.DJUMP_VEL;
          p.jumps = 2;
          p.buffer = 0;
          p.flipT = 0.44;
          p.sx = 0.9; p.sy = 1.14;
          Audio.play('djump');
          FX.burst(p.x + p.w / 2, p.y + p.h, 10, {
            color: ['#fff0c0', '#f5c542', '#e8a44c'], speedMax: 190, lifeMax: 0.45, g: 260, kind: 'spark',
          });
        }
      }
      // short hop when the button is let go early
      if (ICH.Input.released('jump') && p.vy < -190) p.vy *= 0.45;

      /* ---------------------------------------------------------- gravity */
      const gliding = p.carpetT > 0 && !p.grounded && p.vy > 0 && In.held('jump');
      if (gliding) {
        p.vy = U.approach(p.vy, C.GLIDE_FALL, 2600 * dt);
        if (Math.random() < 0.4) {
          FX.spawn({
            x: p.x + U.rnd(0, p.w), y: p.y + p.h, vx: U.rnd(-30, 30), vy: U.rnd(10, 50),
            life: 0.4, size: 3, g: 60, color: 'rgba(245,197,66,0.7)',
          });
        }
      } else {
        p.vy = Math.min(p.vy + C.GRAVITY * dt, C.MAX_FALL);
      }

      /* --------------------------------------------------------- attacks */
      /* The swing is buffered the same way the jump is. Without it a press
         landing during the 0.3 s cooldown is simply thrown away, and a player
         mashing through a pack of guards gets silence for every second tap —
         which reads as the button not working. */
      if (In.pressed('slash')) p.slashBuf = C.SLASH_BUFFER;
      p.slashBuf = Math.max(0, p.slashBuf - dt);
      if (p.slashBuf > 0 && p.slashCd <= 0) {
        p.slashBuf = 0;
        p.slashT = p.slashDur;
        p.slashCd = 0.3;
        p.slashId++;
        p.sx = 1.12; p.sy = 0.9;
        Audio.play('slash');
      }
      if (In.pressed('throw') && p.throwCd <= 0 && G.ammo > 0) {
        p.throwT = p.throwDur;
        p.throwCd = 0.32;
        p.sx = 1.08; p.sy = 0.94;
        G.ammo--;
        ICH.Game.projectiles.push(Ent.projectile(
          p.x + p.w / 2 + p.facing * 14, p.y + 16,
          p.facing * 540 + p.vx * 0.35, -170
        ));
        Audio.play('throw');
      }

      /* ------------------------------------------------------- integrate */
      p.prevBottom = p.y + p.h;
      /* Dropping through an awning has to outlive the frame it starts on:
         the moment he leaves the plank he is no longer grounded, so a
         condition rebuilt from `grounded` each frame lets him fall a fraction
         of a pixel and immediately catch the same plank again. */
      if (In.held('down') && p.grounded && !p.sliding) p.dropT = 0.2;
      p.dropT = Math.max(0, p.dropT - dt);
      const dropThrough = p.dropT > 0;

      p.x += p.vx * dt;
      this.collideX(p);

      p.y += p.vy * dt;
      const wasGrounded = p.grounded;
      const impact = p.vy;
      this.collideY(p, dropThrough);

      if (p.grounded && !wasGrounded) {
        const pow = U.clamp(impact / 900, 0.15, 1);
        p.landPow = pow;
        p.landT = 0.16 + pow * 0.12;
        p.sx = 1 + pow * 0.32;
        p.sy = 1 - pow * 0.3;
        p.flipT = 0;
        Audio.play('land');
        const n = (2 + pow * 7) | 0;
        for (let i = 0; i < n; i++) FX.dust(p.x + p.w / 2 + U.rnd(-12, 12), p.y + p.h, 0);
        if (impact > 700) FX.shake(3, 0.14);
      }
      if (p.grounded) { p.coyote = C.COYOTE; p.jumps = 0; p.airT = 0; }
      else p.airT += dt;

      /* ------------------------------------------------------ rope catch */
      if (!p.grounded && p.ropeCd <= 0) {
        for (const r of ICH.Level.ropes) {
          if (r.holder) continue;
          const hx = r.x + Math.sin(r.angle) * r.len;
          const hy = r.y + Math.cos(r.angle) * r.len;
          const cx = p.x + p.w / 2;
          const cy = p.y + 8;
          if (Math.abs(cx - hx) < 26 && Math.abs(cy - hy) < 34) {
            r.holder = p;
            p.rope = r;
            const a = Math.atan2(cx - r.x, Math.max(6, cy - r.y));
            r.angle = a;
            r.omega = (p.vx * Math.cos(a) - p.vy * Math.sin(a)) / r.len;
            r.omega = U.clamp(r.omega, -3.4, 3.4);
            Audio.play('rope');
            FX.text(cx, p.y - 6, 'tut!', '#f6e7c4', 13);
            break;
          }
        }
      }

      /* ------------------------------------------------------- footsteps */
      if (p.grounded && Math.abs(p.vx) > 60 && !p.sliding) {
        p.stepT -= dt * Math.abs(p.vx) / 200;
        if (p.stepT <= 0) {
          p.stepT = 0.32;
          FX.dust(p.x + p.w / 2 - p.facing * 8, p.y + p.h, p.facing);
          Audio.play('step');
        }
      }
      if (p.sliding && Math.random() < 0.6) FX.dust(p.x + p.w / 2 - p.facing * 10, p.y + p.h, p.facing);

      /* --------------------------------------------------- idle fidgets */
      if (p.grounded && Math.abs(p.vx) < 14 && dir === 0 && p.slashT <= 0 && p.throwT <= 0) {
        p.idleT += dt;
        if (p.fidgetT > 0) {
          p.fidgetT -= dt;
        } else if (p.idleT > 3.2) {
          p.fidget = U.pick(['look', 'cap', 'sword', 'stretch']);
          p.fidgetT = 1.0;
          p.idleT = U.rnd(-1.5, 0.5);
        }
      } else {
        p.idleT = 0;
        p.fidgetT = 0;
      }

      /* ----------------------------------------------------------- state */
      if (p.sliding) p.state = 'slide';
      else if (!p.grounded) p.state = p.vy < 0 ? 'jump' : 'fall';
      else if (Math.abs(p.vx) > 22) p.state = 'run';
      else p.state = 'idle';
    },

    collideX(p) {
      for (const pl of ICH.Level.platforms) {
        if (pl.oneWay) continue;
        if (!U.rectHit(p.x, p.y, p.w, p.h, pl.x, pl.y, pl.w, pl.h)) continue;
        // ignore a hair of overlap when standing on the very top
        if (p.y + p.h - pl.y < 6) continue;
        if (p.vx > 0) p.x = pl.x - p.w;
        else if (p.vx < 0) p.x = pl.x + pl.w;
        else p.x = p.x < pl.x + pl.w / 2 ? pl.x - p.w : pl.x + pl.w;
        p.vx = 0;
      }
    },

    collideY(p, dropThrough) {
      p.grounded = false;
      for (const pl of ICH.Level.platforms) {
        if (!U.rectHit(p.x, p.y, p.w, p.h, pl.x, pl.y, pl.w, pl.h)) continue;
        if (pl.oneWay) {
          if (dropThrough) continue;
          if (p.vy < 0) continue;
          if (p.prevBottom > pl.y + 6) continue;
        }
        if (p.vy >= 0 && p.prevBottom <= pl.y + 8) {
          p.y = pl.y - p.h;
          p.vy = 0;
          p.grounded = true;
        } else if (p.vy < 0 && !pl.oneWay) {
          /* Corner nudge. Clipping the underside of a slab by a few pixels
             used to stop the jump dead, which reads as the stonework cheating
             rather than as a miss. If a small sideways shift clears the edge,
             take it and let the climb continue. */
          const fromLeft = p.x + p.w - pl.x;
          const fromRight = pl.x + pl.w - p.x;
          const over = Math.min(fromLeft, fromRight);
          if (over <= C.NUDGE) {
            p.x += fromLeft < fromRight ? -(over + 1) : over + 1;
          } else {
            p.y = pl.y + pl.h;
            p.vy = 40;
          }
        }
      }
    },

    /** Hitbox of the current sword swing, or null. */
    slashBox(p) {
      if (p.slashT <= 0) return null;
      const w = 46, h = 46;
      return {
        x: p.facing > 0 ? p.x + p.w - 6 : p.x - w + 6,
        y: p.y + (p.sliding ? -6 : 2),
        w, h,
      };
    },
  };

  /* ================================================================ ENEMY */

  const KINDS = {
    guard: { w: 32, h: 56, speed: 62, hp: 1, score: 60 },
    snake: { w: 44, h: 24, speed: 118, hp: 1, score: 45 },
    crow: { w: 32, h: 28, speed: 90, hp: 1, score: 55 },
    dog: { w: 46, h: 34, speed: 84, hp: 1, score: 70 },
    scorpion: { w: 36, h: 20, speed: 150, hp: 1, score: 50 },
    archer: { w: 30, h: 56, speed: 34, hp: 1, score: 95 },
    bat: { w: 32, h: 24, speed: 128, hp: 1, score: 60 },
    thug: { w: 44, h: 64, speed: 50, hp: 3, score: 170 },
    roller: { w: 36, h: 36, speed: 210, hp: 1, score: 40 },
  };

  const FLYERS = { crow: 1, bat: 1 };

  function updateGuard(e, dt, G) {
    const p = G.player;
    const cx = e.x + e.w / 2;
    const near = Math.abs(cx - (p.x + p.w / 2)) < 140 && Math.abs(e.y - p.y) < 70;

    if (e.state === 'wind') {
      e.attackT -= dt;
      e.vx = 0;
      if (e.attackT <= 0) { e.state = 'swing'; e.attackT = 0.26; ICH.Audio.play('slash'); }
    } else if (e.state === 'swing') {
      e.attackT -= dt;
      e.vx = e.dir * 40;
      if (e.attackT <= 0) { e.state = 'walk'; e.cool = 0.9; }
    } else {
      e.cool = Math.max(0, e.cool - dt);
      e.vx = e.dir * e.speed * (e.elite ? 1.3 : 1);
      if (near && e.cool <= 0) {
        e.dir = Math.sign((p.x + p.w / 2) - cx) || e.dir;
        e.state = 'wind';
        e.attackT = 0.34;
      }
    }

    groundStep(e, dt, 8);
    e.animT += dt * (e.state === 'walk' ? 1 : 0.3);
  }

  function updateSnake(e, dt, G) {
    e.vx = e.dir * e.speed;
    groundStep(e, dt, 6);
    e.animT += dt;
  }

  /* Street dog: trots along, then commits to a flat-out charge. */
  function updateDog(e, dt, G) {
    const p = G.player;
    const cx = e.x + e.w / 2;
    const dx = (p.x + p.w / 2) - cx;
    const level = Math.abs((e.y + e.h) - (p.y + p.h)) < 60;

    if (e.state === 'charge') {
      e.attackT -= dt;
      e.vx = e.dir * e.speed * 2.9;
      if (e.attackT <= 0) { e.state = 'walk'; e.cool = 1.4; }
    } else {
      e.cool = Math.max(0, e.cool - dt);
      e.vx = e.dir * e.speed;
      if (level && Math.abs(dx) < 250 && e.cool <= 0) {
        e.dir = Math.sign(dx) || e.dir;
        e.state = 'charge';
        e.attackT = 1.0;
        ICH.Audio.play('bark');
        FX.text(cx, e.y - 10, 'hav!', '#f6e7c4', 13);
      }
    }
    groundStep(e, dt, e.state === 'charge' ? 10 : 8);
    e.animT += dt * (e.state === 'charge' ? 2.4 : 1);
  }

  /* Scorpion: scuttles in short bursts, low enough to force a jump. */
  function updateScorpion(e, dt, G) {
    e.attackT -= dt;
    if (e.attackT <= 0) {
      e.state = e.state === 'walk' ? 'wait' : 'walk';
      e.attackT = e.state === 'walk' ? 0.5 : 0.55;
      if (e.state === 'walk') {
        const dx = (G.player.x + G.player.w / 2) - (e.x + e.w / 2);
        if (Math.abs(dx) < 320) e.dir = Math.sign(dx) || e.dir;
      }
    }
    e.vx = e.state === 'walk' ? e.dir * e.speed : 0;
    groundStep(e, dt, 6);
    e.animT += dt * (e.state === 'walk' ? 3 : 1);
  }

  /* Archer on a wall or roof: draws, then looses an arrow down the street. */
  function updateArcher(e, dt, G) {
    const p = G.player;
    const cx = e.x + e.w / 2;
    const dx = (p.x + p.w / 2) - cx;
    const dy = (p.y + p.h) - (e.y + e.h);

    e.cool = Math.max(0, e.cool - dt);
    if (e.state === 'draw') {
      e.attackT -= dt;
      e.vx = 0;
      if (e.attackT <= 0) {
        e.state = 'walk';
        e.cool = 1.9;
        ICH.Game.arrows.push(Ent.arrow(cx + e.dir * 18, e.y + 20, e.dir * 430, dy > 60 ? 60 : 0));
        ICH.Audio.play('bow');
      }
    } else {
      e.vx = e.patrol ? e.dir * e.speed : 0;
      if (Math.abs(dx) < 460 && dy > -80 && e.cool <= 0) {
        e.dir = Math.sign(dx) || e.dir;
        e.state = 'draw';
        e.attackT = 0.62;
      }
    }
    groundStep(e, dt, 8);
    e.animT += dt;
  }

  /* Bat: hangs from the vault until you pass, then drops and hunts. */
  function updateBat(e, dt, G) {
    const p = G.player;
    e.t += dt;
    if (e.state === 'hang') {
      const dx = Math.abs((p.x + p.w / 2) - (e.x + e.w / 2));
      if (dx < 190) {
        e.state = 'fly';
        e.baseY = e.y;
        FX.burst(e.x + e.w / 2, e.y + e.h, 6, { color: '#3a2f3c', speedMax: 90, lifeMax: 0.4 });
      }
      return;
    }
    const tx = (p.x + p.w / 2) - (e.x + e.w / 2);
    const ty = (p.y + 10) - e.y;
    e.dir = tx >= 0 ? 1 : -1;
    e.x += U.clamp(tx, -1, 1) * e.speed * dt;
    e.baseY += U.clamp(ty, -1, 1) * 46 * dt;
    e.y = e.baseY + Math.sin(e.t * 7) * 13;
    e.animT += dt;
  }

  /* Pəhləvan with a club: three hits to fell, and his slam shakes the street. */
  function updateThug(e, dt, G) {
    const p = G.player;
    const cx = e.x + e.w / 2;
    const dx = (p.x + p.w / 2) - cx;

    if (e.state === 'wind') {
      e.attackT -= dt;
      e.vx = 0;
      if (e.attackT <= 0) { e.state = 'slam'; e.attackT = 0.3; }
    } else if (e.state === 'slam') {
      e.attackT -= dt;
      e.vx = 0;
      if (e.attackT > 0.24 && !e.slammed) {
        e.slammed = true;
        ICH.Audio.play('slam');
        FX.shake(8, 0.3);
        for (let i = 0; i < 14; i++) {
          FX.spawn({
            x: cx + U.rnd(-30, 30), y: e.y + e.h, vx: U.rnd(-190, 190), vy: U.rnd(-180, -40),
            life: U.rnd(0.3, 0.6), size: U.rnd(3, 6), color: 'rgba(214,190,150,0.9)', kind: 'shard',
          });
        }
      }
      if (e.attackT <= 0) { e.state = 'walk'; e.cool = 1.5; e.slammed = false; }
    } else {
      e.cool = Math.max(0, e.cool - dt);
      e.vx = e.dir * e.speed;
      if (Math.abs(dx) < 120 && Math.abs(e.y - p.y) < 70 && e.cool <= 0) {
        e.dir = Math.sign(dx) || e.dir;
        e.state = 'wind';
        e.attackT = 0.5;
      }
    }
    groundStep(e, dt, 10);
    e.animT += dt * (e.state === 'walk' ? 1 : 0.2);
  }

  /* A big clay jar shoved down the bazaar street. */
  function updateRoller(e, dt, G) {
    e.vx = e.dir * e.speed;
    e.spin += (e.vx / 18) * dt;
    groundStep(e, dt, 6, true);
    e.animT += dt;
  }

  /** Shared walk-and-fall step used by every ground enemy. */
  function groundStep(e, dt, ledgeProbe, keepDir) {
    e.x += e.vx * dt;
    e.vy = Math.min(e.vy + C.GRAVITY * dt, C.MAX_FALL);
    e.y += e.vy * dt;
    const cx = e.x + e.w / 2;
    const foot = floorAt(cx, e.y + e.h);
    if (foot && e.vy >= 0 && e.y + e.h >= foot.y && e.y + e.h <= foot.y + 18) {
      e.y = foot.y - e.h;
      e.vy = 0;
    }
    const ahead = cx + e.dir * (e.w / 2 + ledgeProbe);
    if (e.patrol) {
      if (ahead < e.patrol[0] || ahead > e.patrol[1]) e.dir *= -1;
    } else if (!keepDir && (!floorAt(ahead, e.y + e.h + 6) || solidAt(ahead, e.y + e.h - 14))) {
      e.dir *= -1;
    }
  }

  function updateCrow(e, dt, G) {
    const p = G.player;
    e.t += dt;
    const dx = (p.x + p.w / 2) - (e.x + e.w / 2);
    const dy = (p.y + p.h / 2) - (e.y + e.h / 2);
    const d = Math.hypot(dx, dy);

    if (e.dive <= 0 && d < 230 && dx < 40) {
      e.dive = 1.1;
      e.dvx = (dx / d) * 300;
      e.dvy = (dy / d) * 300;
    }
    if (e.dive > 0) {
      e.dive -= dt;
      e.x += e.dvx * dt;
      e.y += e.dvy * dt;
      e.dvy += 260 * dt;
      e.dir = e.dvx >= 0 ? 1 : -1;
      if (e.dive <= 0) e.baseY = e.y;
    } else {
      e.x -= e.speed * dt * 0.5;
      e.y = e.baseY + Math.sin(e.t * 2.6 + e.phase) * e.amp;
      e.dir = -1;
      // ease back to the patrol altitude after a dive
      e.baseY = U.approach(e.baseY, e.homeY, 60 * dt);
    }
    e.animT += dt;
  }

  /* ================================================================ FACTORY */

  const Ent = {
    Player,
    solidAt,
    floorAt,

    isFlyer: (kind) => !!FLYERS[kind],
    kindSize: (kind) => KINDS[kind] || KINDS.guard,

    enemy(kind, cx, top, opts) {
      const k = KINDS[kind] || KINDS.guard;
      opts = opts || {};
      const elite = !!opts.elite && k.hp === 1 && kind !== 'roller';
      const e = {
        kind, x: cx - k.w / 2, y: top, w: k.w, h: k.h,
        vx: 0, vy: 0, dir: opts.dir || -1,
        speed: k.speed * (elite ? 1.25 : 1),
        hp: elite ? 3 : k.hp,
        score: elite ? k.score * 2 : k.score,
        elite,
        state: kind === 'bat' ? 'hang' : 'walk',
        attackT: kind === 'scorpion' ? 0.4 : 0,
        cool: 0.6, slammed: false, spin: 0,
        animT: Math.random() * 5, phase: Math.random() * 6,
        hurtT: 0, dead: false,
        patrol: opts.patrol || null,
        amp: opts.amp || 34,
        baseY: top, homeY: top, t: Math.random() * 6, dive: 0, dvx: 0, dvy: 0,
      };
      return e;
    },

    /** Place an enemy resting on surfaceY; fliers hover above it. */
    enemyOn(kind, cx, surfaceY, opts) {
      opts = opts || {};
      const k = KINDS[kind] || KINDS.guard;
      let top;
      if (opts.flying) top = surfaceY - k.h / 2;
      else if (FLYERS[kind]) top = surfaceY - 100 - k.h;
      else top = surfaceY - k.h;
      return this.enemy(kind, cx, top, opts);
    },

    updateEnemy(e, dt, G) {
      e.hurtT = Math.max(0, e.hurtT - dt);
      switch (e.kind) {
        case 'guard': updateGuard(e, dt, G); break;
        case 'snake': updateSnake(e, dt, G); break;
        case 'dog': updateDog(e, dt, G); break;
        case 'scorpion': updateScorpion(e, dt, G); break;
        case 'archer': updateArcher(e, dt, G); break;
        case 'bat': updateBat(e, dt, G); break;
        case 'thug': updateThug(e, dt, G); break;
        case 'roller': updateRoller(e, dt, G); break;
        default: updateCrow(e, dt, G);
      }
    },

    /** Damage box of an enemy mid-attack, or null. */
    enemyAttackBox(e) {
      if (e.kind === 'guard' && e.state === 'swing') {
        return { x: e.dir > 0 ? e.x + e.w - 8 : e.x - 34, y: e.y + 6, w: 42, h: 34 };
      }
      if (e.kind === 'thug' && e.state === 'slam' && e.attackT > 0.12) {
        return { x: e.x - 46, y: e.y + e.h - 30, w: e.w + 92, h: 32 };
      }
      return null;
    },

    /** Stomping kills outright, except the ones built to shrug it off. */
    stompDamage: (e) => (e.kind === 'thug' ? 1 : e.elite ? 1 : 99),

    /* Everything an enemy throws at you lives in one list, keyed by kind. */
    HOSTILE: {
      arrow: { g: 190, r: 5, life: 3, hitSolid: true, burst: '#c9b68d' },
      coin: { g: 900, r: 8, life: 3, hitSolid: true, burst: '#f5b91f' },
      rock: { g: 1000, r: 13, life: 4, hitSolid: true, burst: '#a8854f' },
      feather: { g: 90, r: 8, life: 3.4, hitSolid: false, burst: '#2f2b2c' },
      spit: { g: 520, r: 10, life: 3, hitSolid: true, burst: '#5fc9d8' },
      fire: { g: 420, r: 12, life: 4, hitSolid: true, burst: '#ff9d21' },
    },

    arrow(x, y, vx, vy, kind) {
      const k = kind || 'arrow';
      const d = this.HOSTILE[k];
      return { kind: k, x, y, vx, vy, rot: Math.atan2(vy, vx), spin: 0, life: d.life, dead: false, r: d.r };
    },

    updateArrow(a, dt) {
      const d = Ent.HOSTILE[a.kind] || Ent.HOSTILE.arrow;
      a.life -= dt;
      a.vy += d.g * dt;
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      a.rot = Math.atan2(a.vy, a.vx);
      a.spin += dt * 9;
      if (a.life <= 0) a.dead = true;
      if (d.hitSolid && solidAt(a.x, a.y)) {
        a.dead = true;
        FX.burst(a.x, a.y, a.kind === 'rock' ? 12 : 5, {
          color: d.burst, speedMax: 160, lifeMax: 0.4, kind: 'shard', sizeMax: a.kind === 'rock' ? 6 : 4,
        });
        if (a.kind === 'rock') { FX.shake(4, 0.18); ICH.Audio.play('slam'); }
      }
    },

    pickup(type, cx, cy) {
      const size = type === 'carpet' ? 30 : type === 'paxlava' ? 26 : 22;
      return {
        type, x: cx - size / 2, y: cy - size / 2, w: size, h: size,
        phase: Math.random() * 6, dead: false, vx: 0, vy: 0, magnet: false,
      };
    },

    projectile(x, y, vx, vy) {
      return { x, y, vx, vy, rot: 0, life: 2.4, dead: false, r: 8 };
    },

    updateProjectile(pr, dt) {
      pr.life -= dt;
      pr.vy += 1100 * dt;
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      pr.rot += dt * (pr.vx > 0 ? 12 : -12);
      if (pr.life <= 0) pr.dead = true;
      if (solidAt(pr.x, pr.y)) { pr.dead = true; Ent.splash(pr.x, pr.y); }
      if (Math.random() < 0.3) {
        FX.spawn({ x: pr.x, y: pr.y, vx: U.rnd(-20, 20), vy: U.rnd(-20, 20), life: 0.25, size: 2.5, g: 0, color: 'rgba(200,38,46,0.6)' });
      }
    },

    splash(x, y) {
      FX.burst(x, y, 14, {
        color: ['#c8262e', '#f05a52', '#ffd0a0'], speedMax: 300, lifeMax: 0.6, sizeMax: 5, kind: 'spark',
      });
      FX.spawn({ x, y, life: 0.35, size: 6, g: 0, color: 'rgba(255,190,150,0.9)', kind: 'ring' });
    },
  };

  ICH.Ent = Ent;
})(window.ICH);
