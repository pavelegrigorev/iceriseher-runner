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

    /* On-screen controls.
       Rather than binding each button separately, every live touch is hit
       tested against all of them each frame. That way a thumb can slide from
       ◀ to ▶ without lifting, and several buttons can be held at once — both
       of which a per-element handler gets wrong. */
    bindTouchLayer() {
      const pads = Array.from(document.querySelectorAll('[data-btn]'));
      if (!pads.length) return;
      this.pads = pads;
      const live = new Map(); // touch id → nothing, we only need the points

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
          const on = !!hit[act];
          if (on && !this.now[act]) this.press(act);
          else this.now[act] = on;
        }
      };

      const collect = (e) => {
        const pts = [];
        for (const t of e.touches) pts.push({ x: t.clientX, y: t.clientY });
        return pts;
      };

      const handler = (e) => {
        if (e.cancelable) e.preventDefault();
        ICH.Audio.unlock();
        apply(collect(e));
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
