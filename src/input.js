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

  const Input = {
    now: Object.create(null),
    prev: Object.create(null),
    touch: false,

    init() {
      window.addEventListener('keydown', (e) => {
        const a = MAP[e.code];
        if (a) {
          if (!e.repeat) this.now[a] = true;
          if (a !== 'mute' && a !== 'restart') e.preventDefault();
        }
        ICH.Audio.unlock();
      });

      window.addEventListener('keyup', (e) => {
        const a = MAP[e.code];
        if (a) { this.now[a] = false; e.preventDefault(); }
      });

      window.addEventListener('blur', () => { this.now = Object.create(null); });

      // On-screen buttons for phones/tablets.
      document.querySelectorAll('[data-btn]').forEach((el) => this.bindTouch(el, el.dataset.btn));

      const markTouch = () => {
        this.touch = true;
        document.body.classList.add('has-touch');
        window.removeEventListener('touchstart', markTouch);
      };
      window.addEventListener('touchstart', markTouch, { passive: true });
    },

    bindTouch(el, action) {
      const on = (e) => {
        e.preventDefault();
        this.now[action] = true;
        el.classList.add('down');
        ICH.Audio.unlock();
      };
      const off = (e) => {
        e.preventDefault();
        this.now[action] = false;
        el.classList.remove('down');
      };
      el.addEventListener('touchstart', on, { passive: false });
      el.addEventListener('touchend', off, { passive: false });
      el.addEventListener('touchcancel', off, { passive: false });
      el.addEventListener('mousedown', on);
      el.addEventListener('mouseup', off);
      el.addEventListener('mouseleave', off);
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
        return;
      }
    },

    /** Call once per frame, after the frame has consumed the state. */
    endFrame() {
      this.prev = Object.assign(Object.create(null), this.now);
    },

    held(a) { return !!this.now[a]; },
    pressed(a) { return !!this.now[a] && !this.prev[a]; },
    released(a) { return !this.now[a] && !!this.prev[a]; },
    consume(a) { this.now[a] = false; this.prev[a] = false; },
  };

  ICH.Input = Input;
})(window.ICH);
