/* Headless harness.

   The game targets the browser and has no build step, so the tests run the
   real source files inside a vm context with just enough of a DOM to boot:
   a canvas whose 2d context swallows every call, a fake element registry
   built from the ids actually present in index.html, and stubs for the few
   browser APIs the game touches. Nothing is mocked at the module level —
   every test drives the same code the browser runs. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');

/* Load order matters and must match index.html, so it is read from there
   rather than duplicated — a script added to the page joins the tests too. */
function scriptOrder() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  return [...html.matchAll(/<script src="(src\/[^"]+)"><\/script>/g)].map((m) => m[1]);
}

function markup() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  return {
    ids: [...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]),
    buttons: [...html.matchAll(/data-btn="([^"]+)"/g)].map((m) => m[1]),
    screens: [...html.matchAll(/class="screen[^"]*"\s+id="([^"]+)"/g)].map((m) => m[1]),
    inputs: [...html.matchAll(/<input[^>]*\bid="([^"]+)"/g)].map((m) => m[1]),
  };
}

/* A 2d context that accepts anything. Tests care that drawing does not throw
   and that no coordinate goes non-finite, not about pixels. */
function makeCtx2d(record) {
  const gradient = { addColorStop() {} };
  const base = {
    canvas: null,
    save() {}, restore() {},
    setTransform() {}, transform() {}, translate() {}, rotate() {}, scale() {},
    beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, arc() {}, arcTo() {},
    ellipse() {}, quadraticCurveTo() {}, bezierCurveTo() {}, rect() {}, clip() {},
    fill() {}, stroke() {}, fillRect() {}, strokeRect() {}, clearRect() {},
    fillText() {}, strokeText() {}, drawImage() {},
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    createPattern: () => ({}),
    measureText: (s) => ({ width: String(s).length * 6 }),
    getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    putImageData() {},
  };
  // every numeric argument is checked: a NaN coordinate is a real defect and
  // silently paints nothing in a browser
  return new Proxy(base, {
    get(t, k) {
      const v = t[k];
      if (typeof v !== 'function') return v;
      return (...args) => {
        for (const a of args) {
          if (typeof a === 'number' && !Number.isFinite(a)) {
            record.bad.push(`${String(k)}(${args.join(', ')})`);
            break;
          }
        }
        return v.apply(t, args);
      };
    },
    set(t, k, v) {
      if (typeof v === 'number' && !Number.isFinite(v)) record.bad.push(`${String(k)} = ${v}`);
      t[k] = v;
      return true;
    },
  });
}

function makeElement(id, cls, tag) {
  const classes = new Set((cls || '').split(/\s+/).filter(Boolean));
  const el = {
    id: id || '',
    tagName: (tag || 'div').toUpperCase(),
    dataset: {},
    style: {},
    textContent: '',
    innerHTML: '',
    value: '',
    _rect: { left: 0, top: 0, width: 0, height: 0 },
    _handlers: {},
    classList: {
      add: (c) => classes.add(c),
      remove: (c) => classes.delete(c),
      contains: (c) => classes.has(c),
      toggle: (c, on) => {
        const want = on === undefined ? !classes.has(c) : !!on;
        if (want) classes.add(c); else classes.delete(c);
        return want;
      },
    },
    get className() { return [...classes].join(' '); },
    addEventListener(type, fn) { (el._handlers[type] = el._handlers[type] || []).push(fn); },
    removeEventListener(type, fn) {
      const a = el._handlers[type] || [];
      const i = a.indexOf(fn);
      if (i >= 0) a.splice(i, 1);
    },
    dispatchEvent(ev) {
      (el._handlers[ev.type] || []).forEach((fn) => fn(ev));
      return true;
    },
    click() { el.dispatchEvent({ type: 'click', preventDefault() {} }); },
    getBoundingClientRect() {
      const r = el._rect;
      return { ...r, right: r.left + r.width, bottom: r.top + r.height };
    },
    querySelectorAll: () => [],
  };
  return el;
}

/** Boot the game in a fresh sandbox. */
function boot(opts) {
  opts = opts || {};
  const width = opts.width || 1280;
  const height = opts.height || 720;
  const record = { bad: [] };
  const m = markup();

  const elements = new Map();
  for (const id of m.ids) {
    const cls = m.screens.includes(id) ? 'screen' : '';
    elements.set(id, makeElement(id, cls, m.inputs.includes(id) ? 'input' : 'div'));
  }
  const pads = m.buttons.map((name) => {
    const el = makeElement('', 'tbtn');
    el.dataset.btn = name;
    return el;
  });
  // a plausible thumb layout so hit tests in the input tests mean something
  const padPos = {
    left: [24, height - 90], right: [96, height - 90], down: [96, height - 160],
    throw: [width - 168, height - 160], slash: [width - 96, height - 160],
    jump: [width - 96, height - 90],
  };
  pads.forEach((el) => {
    const p = padPos[el.dataset.btn] || [0, 0];
    el._rect = { left: p[0], top: p[1], width: 62, height: 62 };
  });
  // the movement zone, laid out as the stylesheet does: the left 46%
  const stickEl = elements.get('stick');
  if (stickEl) stickEl._rect = { left: 0, top: 0, width: Math.round(width * 0.46), height };

  const canvas = makeElement('game');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext = () => makeCtx2d(record);
  elements.set('game', canvas);

  const body = makeElement('body');
  const docHandlers = Object.create(null);
  const documentEl = {
    body,
    hidden: false,
    getElementById: (id) => elements.get(id) || null,
    querySelectorAll(sel) {
      if (sel === '[data-btn]') return pads;
      if (sel === '.screen') return [...elements.values()].filter((e) => e.classList.contains('screen'));
      return [];
    },
    querySelector: () => null,
    addEventListener(type, fn) { (docHandlers[type] = docHandlers[type] || []).push(fn); },
    removeEventListener(type, fn) {
      const a = docHandlers[type] || [];
      const i = a.indexOf(fn);
      if (i >= 0) a.splice(i, 1);
    },
    createElement: () => makeElement(),
  };

  // seeded before the scripts run, so a test can boot into a browser that
  // already remembers something
  const store = new Map(Object.entries(opts.storage || {}).map(([k, v]) => [k, String(v)]));
  const raf = [];
  // Window listeners are kept rather than dropped: the keyboard is bound there,
  // and a test that cannot deliver a keystroke cannot check what it does.
  const winHandlers = Object.create(null);
  const sandbox = {
    console,
    setTimeout, clearTimeout, setInterval: () => 0, clearInterval() {},
    document: documentEl,
    navigator: { maxTouchPoints: opts.touch ? 5 : 0, getGamepads: () => [] },
    screen: { orientation: null },
    performance: { now: () => Date.now() },
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    },
    // only the pending callback matters; the loop reschedules itself every
    // frame and a growing list would just be a leak in a long test
    requestAnimationFrame: (fn) => { raf.length = 0; raf.push(fn); return 1; },
    matchMedia: () => ({ matches: !!opts.touch }),
    innerWidth: width,
    innerHeight: height,
    addEventListener(type, fn, o) {
      (winHandlers[type] = winHandlers[type] || []).push({ fn, once: !!(o && o.once) });
    },
    removeEventListener(type, fn) {
      const a = winHandlers[type] || [];
      const i = a.findIndex((h) => h.fn === fn);
      if (i >= 0) a.splice(i, 1);
    },
    Touch: function Touch(o) { Object.assign(this, o); },
    TouchEvent: function TouchEvent(type, o) { Object.assign(this, o, { type }); },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);

  for (const rel of scriptOrder()) {
    const code = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    vm.runInContext(code, sandbox, { filename: rel });
  }

  const ICH = sandbox.window.ICH;
  ICH.Game.init();

  // count repaints, so a test can tell that a frame which simulated nothing
  // also drew nothing
  record.draws = 0;
  const realDraw = ICH.Game.draw.bind(ICH.Game);
  ICH.Game.draw = function () { record.draws++; realDraw(); };

  const api = {
    ICH, sandbox, record, pads, elements, canvas,
    /** What this browser would have remembered after the run so far. */
    stored: (k) => (store.has(k) ? store.get(k) : null),
    /** Deliver a key event the way the browser does — through the window, from
        whichever element has focus. */
    key(type, code, target) {
      const ev = { type, code, target: target || body, repeat: false, preventDefault() {} };
      for (const h of (winHandlers[type] || []).slice()) {
        h.fn(ev);
        if (h.once) sandbox.removeEventListener(type, h.fn);
      }
      return ev;
    },
    /** Advance the simulation without touching the real clock. */
    step(frames, before) {
      for (let i = 0; i < (frames || 1); i++) {
        if (before) before(i);
        if (ICH.Game.state === 'paused') ICH.Game.state = 'playing';
        ICH.Game.update(1 / 60);
        ICH.Input.endFrame();
      }
    },
    draw() { ICH.Game.draw(); },
    /** Drive the real rAF loop at a given refresh rate, so anything that
        depends on frame timing is visible to a test. `step()` bypasses the
        loop and always simulates 1/60, which hides exactly that. */
    frames(hz, seconds, before) {
      const ms = 1000 / hz;
      const n = Math.round(seconds * hz);
      for (let i = 0; i < n; i++) {
        if (before) before(i);
        api._ts += ms;
        ICH.Game.loop(api._ts);
      }
      return api;
    },
    _ts: 0,
    /** How many times the loop actually repainted. */
    draws: () => record.draws,
    /** Send the tab to the background and bring it back. */
    visibility(hidden) {
      documentEl.hidden = !!hidden;
      for (const fn of (docHandlers.visibilitychange || []).slice()) fn({ type: 'visibilitychange' });
      return api;
    },
    resize(w, h) {
      sandbox.innerWidth = w;
      sandbox.innerHeight = h;
      canvas.width = w;
      canvas.height = h;
      ICH.Game.resize();
    },
    /** Where a thumb would land in the movement zone. */
    stickCenter() {
      const r = elements.get('stick')._rect;
      return [Math.round(r.left + r.width / 2), Math.round(r.top + r.height * 0.7)];
    },
    /** Fire a touch event carrying the given screen points. A point is
        [x, y] or [x, y, id]; the id keeps a finger identifiable across
        events, which is what the stick tracks. */
    touch(type, points) {
      const layer = elements.get('touch');
      const touches = points.map((p, i) => ({
        identifier: p.length > 2 ? p[2] : i, clientX: p[0], clientY: p[1],
      }));
      layer.dispatchEvent({
        type, touches, targetTouches: touches, changedTouches: touches,
        cancelable: true, preventDefault() {},
      });
    },
    /** Strip the street of props and creatures so a physics test is isolated:
        the generated jars, enemies and pickups otherwise interfere. */
    clearWorld() {
      const L = ICH.Level;
      for (const key of ['enemies', 'jars', 'pickups', 'hazards', 'ropes', 'decos']) {
        L[key].length = 0;
      }
      return api;
    },
    padCenter(name) {
      const el = pads.find((p) => p.dataset.btn === name);
      const r = el.getBoundingClientRect();
      return [r.left + r.width / 2, r.top + r.height / 2];
    },
    badDraws: () => record.bad,
  };
  api._ts = ICH.Game.last;
  return api;
}

module.exports = { boot, scriptOrder, markup, ROOT };
