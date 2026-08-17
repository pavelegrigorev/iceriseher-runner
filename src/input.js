/* İçərişəhər Runner — keyboard, touch and gamepad input. */
(function (ICH) {
  'use strict';

  const MAP = {
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    ArrowUp: 'jump', KeyW: 'jump', Space: 'jump',
    ArrowDown: 'down', KeyS: 'down',
    KeyJ: 'slash', KeyZ: 'slash', KeyX: 'slash',
    KeyK: 'throw', KeyC: 'throw', ShiftLeft: 'throw', ShiftRight: 'throw',
    Escape: 'pause', KeyP: 'pause',
    KeyM: 'mute',
    KeyR: 'restart',
    Enter: 'confirm', NumpadEnter: 'confirm',
  };

  /* A focused text field owns the keyboard. Nearly every letter is bound to
     something here, so without this a nickname typed on the results screen
     would slash, throw, mute and restart the game as it went in. */
  function typing(e) {
    const t = e && e.target;
    if (!t) return false;
    const tag = String(t.tagName || '').toUpperCase();
    return tag === 'INPUT' || tag === 'TEXTAREA' || t.isContentEditable === true;
  }

  const Input = {
    now: Object.create(null),
    prev: Object.create(null),
    /* Edges are latched, not inferred from now/prev alone. Input arrives on
       events but is read once a frame, so a tap whose press and release both
       land between two frames would otherwise vanish — which is exactly how
       people use the slide button. The latch guarantees every press is seen
       for one frame, however briefly it was held. */
    latch: Object.create(null),
    touch: false,

    init() {
      window.addEventListener('keydown', (e) => {
        if (typing(e)) return;
        const a = MAP[e.code];
        if (a) {
          if (!e.repeat) this.press(a);
          if (a !== 'mute' && a !== 'restart') e.preventDefault();
        }
        ICH.Audio.unlock();
      });

      window.addEventListener('keyup', (e) => {
        if (typing(e)) return;
        const a = MAP[e.code];
        if (a) { this.now[a] = false; e.preventDefault(); }
      });

      window.addEventListener('blur', () => {
        this.now = Object.create(null);
        this.latch = Object.create(null);
      });

      this.bindTouchLayer();

      const markTouch = () => {
        this.touch = true;
        document.body.classList.add('has-touch');
        window.removeEventListener('touchstart', markTouch);
      };
      window.addEventListener('touchstart', markTouch, { passive: true });
    },

    /* ------------------------------------------------------------- stick */
    /* Movement has no button. Wherever the thumb lands on the left half of the
       screen becomes the origin, and the pull from it steers — so the thumb
       never has to find a target by feel, which is the thing that actually
       goes wrong on a phone. Pull down to slide. */
    stick: { id: null, ox: 0, oy: 0, dx: 0, dy: 0 },

    /** Set an action, latching the press so a tap between two frames survives. */
    setAction(a, on) {
      if (on && !this.now[a]) this.press(a);
      else this.now[a] = on;
    },

    moveStick(x, y) {
      const C = ICH.C;
      const st = this.stick;
      let dx = x - st.ox;
      let dy = y - st.oy;
      // Past the edge the origin follows the thumb. Without this a thumb that
      // has drifted across the glass can no longer pull back the other way
      // without lifting — which is exactly what happens when you hold right
      // for a while and then need left in a hurry.
      const r = C.STICK_MAX;
      if (dx > r) { st.ox = x - r; dx = r; } else if (dx < -r) { st.ox = x + r; dx = -r; }
      if (dy > r) { st.oy = y - r; dy = r; } else if (dy < -r) { st.oy = y + r; dy = -r; }
      st.dx = dx;
      st.dy = dy;

      const dead = C.STICK_DEAD;
      // a downward pull only counts as a slide when it clearly beats the
      // sideways one, or running with a slightly low thumb would slide forever
      this.setAction('left', dx < -dead);
      this.setAction('right', dx > dead);
      this.setAction('down', dy > dead * 1.2 && dy > Math.abs(dx));
      this.paintStick(true);
    },

    releaseStick() {
      const st = this.stick;
      if (st.id === null && !st.dx && !st.dy) return;
      st.id = null;
      st.dx = 0;
      st.dy = 0;
      this.now.left = false;
      this.now.right = false;
      this.now.down = false;
      this.paintStick(false);
    },

    /** The ring and knob are plain elements moved by transform: cheaper than
        anything on the canvas, and it keeps the playfield draw untouched. */
    paintStick(on) {
      const ring = this._ring || (this._ring = document.getElementById('stick-ring'));
      const knob = this._knob || (this._knob = document.getElementById('stick-knob'));
      if (!ring || !knob) return;
      const st = this.stick;
      ring.classList.toggle('on', !!on);
      knob.classList.toggle('on', !!on);
      if (!on) return;
      ring.style.transform = 'translate(' + (st.ox | 0) + 'px,' + (st.oy | 0) + 'px)';
      knob.style.transform = 'translate(' + ((st.ox + st.dx) | 0) + 'px,' + ((st.oy + st.dy) | 0) + 'px)';
    },

    /* On-screen controls.
       Rather than binding each button separately, every live touch is hit
       tested against all of them each frame. That way a thumb can slide from
       one action to the next without lifting, and several can be held at once —
       both of which a per-element handler gets wrong. */
    bindTouchLayer() {
      const pads = Array.from(document.querySelectorAll('[data-btn]'));
      const zone = document.getElementById('stick');
      if (!pads.length && !zone) return;
      this.pads = pads;

      const inZone = (x, y) => {
        if (!zone) return false;
        const r = zone.getBoundingClientRect();
        return r.width > 0 && x >= r.left && x <= r.left + r.width && y >= r.top && y <= r.top + r.height;
      };

      const apply = (points) => {
        const hit = Object.create(null);
        for (const el of pads) {
          const r = el.getBoundingClientRect();
          if (!r.width) continue;
          // a generous radius: thumbs are imprecise and the buttons are round
          const cx = r.left + r.width / 2;
          const cy = r.top + r.height / 2;
          const rad = (r.width / 2) * 1.28;
          let on = false;
          for (const p of points) {
            const dx = p.x - cx;
            const dy = p.y - cy;
            if (dx * dx + dy * dy <= rad * rad) { on = true; break; }
          }
          const act = el.dataset.btn;
          if (on) hit[act] = true;
          el.classList.toggle('down', on);
        }
        for (const el of pads) {
          const act = el.dataset.btn;
          this.setAction(act, !!hit[act]);
        }
      };

      const handler = (e) => {
        if (e.cancelable) e.preventDefault();
        ICH.Audio.unlock();
        const st = this.stick;

        // a touch that begins inside the movement zone claims the stick and
        // keeps it until it lifts, wherever it wanders — otherwise a thumb
        // dragged across the middle would start pressing the action buttons
        if (e.type === 'touchstart') {
          for (const t of e.changedTouches || []) {
            if (st.id === null && inZone(t.clientX, t.clientY)) {
              st.id = t.identifier;
              st.ox = t.clientX;
              st.oy = t.clientY;
              st.dx = 0;
              st.dy = 0;
            }
          }
        }

        let held = null;
        const others = [];
        for (const t of e.touches) {
          if (st.id !== null && t.identifier === st.id) held = t;
          else others.push({ x: t.clientX, y: t.clientY });
        }
        if (held) this.moveStick(held.clientX, held.clientY);
        else this.releaseStick();
        apply(others);
      };

      const layer = document.getElementById('touch') || document;
      ['touchstart', 'touchmove', 'touchend', 'touchcancel'].forEach((n) => {
        layer.addEventListener(n, handler, { passive: false });
      });

      // mouse fallback so the controls can be tried on a desktop too
      pads.forEach((el) => {
        const act = el.dataset.btn;
        const down = (e) => { e.preventDefault(); this.press(act); el.classList.add('down'); ICH.Audio.unlock(); };
        const up = () => { this.now[act] = false; el.classList.remove('down'); };
        el.addEventListener('mousedown', down);
        el.addEventListener('mouseup', up);
        el.addEventListener('mouseleave', up);
      });
    },

    pollPad() {
      if (!navigator.getGamepads) return;
      const pads = navigator.getGamepads();
      for (const p of pads) {
        if (!p) continue;
        const ax = p.axes[0] || 0;
        if (ax < -0.35) this.now.left = true;
        if (ax > 0.35) this.now.right = true;
        if (p.buttons[14] && p.buttons[14].pressed) this.now.left = true;
        if (p.buttons[15] && p.buttons[15].pressed) this.now.right = true;
        if (p.buttons[13] && p.buttons[13].pressed) this.now.down = true;
        if (p.buttons[0] && p.buttons[0].pressed) this.now.jump = true;
        if (p.buttons[2] && p.buttons[2].pressed) this.now.slash = true;
        if (p.buttons[3] && p.buttons[3].pressed) this.now.throw = true;
        if (p.buttons[9] && p.buttons[9].pressed) this.now.pause = true;
        return; // first connected pad wins
      }
    },

    /** Register a press that must survive until the frame reads it. */
    press(a) {
      this.now[a] = true;
      this.latch[a] = true;
    },

    /** Drop everything held. Called when the game changes screens: a thumb
        still down when a menu opens must not keep steering behind it, and the
        tap that opened the menu must not leak into the next run. */
    clear() {
      this.now = Object.create(null);
      this.prev = Object.create(null);
      this.latch = Object.create(null);
      this.stick.id = null;
      this.stick.dx = 0;
      this.stick.dy = 0;
      this.paintStick(false);
      if (this.pads) for (const el of this.pads) el.classList.remove('down');
    },

    /** Call once per frame, after the frame has consumed the state. */
    endFrame() {
      this.prev = Object.assign(Object.create(null), this.now);
      this.latch = Object.create(null);
    },

    held(a) { return !!this.now[a]; },
    pressed(a) { return (!!this.now[a] && !this.prev[a]) || !!this.latch[a]; },
    released(a) { return !this.now[a] && !!this.prev[a]; },
    consume(a) { this.now[a] = false; this.prev[a] = false; this.latch[a] = false; },
  };

  ICH.Input = Input;
})(window.ICH);
