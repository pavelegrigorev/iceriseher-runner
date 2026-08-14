/* İçərişəhər Runner — core: math, RNG, palette, shared constants */
window.ICH = window.ICH || {};
(function (ICH) {
  'use strict';

  /* ---------------------------------------------------------------- utils */
  const U = {};
  U.TAU = Math.PI * 2;
  U.clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.approach = (v, target, delta) =>
    v < target ? Math.min(v + delta, target) : Math.max(v - delta, target);
  U.rnd = (a, b) => (b === undefined ? Math.random() * (a === undefined ? 1 : a) : a + Math.random() * (b - a));
  U.rndInt = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
  U.pick = (arr) => arr[(Math.random() * arr.length) | 0];
  U.chance = (p) => Math.random() < p;
  U.rectHit = (ax, ay, aw, ah, bx, by, bw, bh) =>
    ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  U.dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);

  U.mulberry32 = function (a) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  /** Seeded random generator with the same surface as the Math.random helpers. */
  U.rng = function (seed) {
    const r = U.mulberry32(seed | 0);
    return {
      next: r,
      f: (a, b) => (b === undefined ? r() * (a === undefined ? 1 : a) : a + r() * (b - a)),
      i: (a, b) => Math.floor(a + r() * (b - a + 1)),
      pick: (arr) => arr[(r() * arr.length) | 0],
      chance: (p) => r() < p,
      sign: () => (r() < 0.5 ? -1 : 1),
    };
  };

  /** Stable 2d hash — lets background cells regenerate identically forever. */
  U.hash = function (a, b) {
    let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return (h ^ (h >>> 16)) >>> 0;
  };

  /* ---- colour helpers, used to cross-fade the palette between zones ---- */
  const _hexCache = Object.create(null);
  U.hex2rgb = function (hex) {
    let v = _hexCache[hex];
    if (v) return v;
    const n = parseInt(hex.slice(1), 16);
    v = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    _hexCache[hex] = v;
    return v;
  };
  U.mixRgb = function (a, b, t, out) {
    out = out || [0, 0, 0];
    out[0] = a[0] + (b[0] - a[0]) * t;
    out[1] = a[1] + (b[1] - a[1]) * t;
    out[2] = a[2] + (b[2] - a[2]) * t;
    return out;
  };
  U.rgbCss = (c) => 'rgb(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ')';
  U.rgbaCss = (c, a) => 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + a + ')';
  /** Weighted pick from [[value, weight], ...]. */
  U.weighted = function (table, rnd) {
    let total = 0;
    for (const e of table) total += e[1];
    let r = (rnd ? rnd() : Math.random()) * total;
    for (const e of table) {
      r -= e[1];
      if (r <= 0) return e[0];
    }
    return table[table.length - 1][0];
  };

  U.ease = {
    outCubic: (t) => 1 - Math.pow(1 - t, 3),
    outBack: (t) => 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2),
    inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  };

  ICH.U = U;

  /* -------------------------------------------------------------- palette */
  /* Late afternoon in the Old City: everything is Absheron limestone, honey
     coloured, hazing out toward the sky with distance. The gameplay plane is
     the brightest and most saturated band, so it always reads first. */
  ICH.P = {
    skyTop: '#4f97c2',
    skyMid: '#94c6da',
    skyWarm: '#e6c98f',
    skyLow: '#f7e3b3',
    sun: '#fff6d8',

    sea: '#6b9db0',
    seaGlint: '#dcecf1',

    layerSea: '#c5cfcb',
    layerFar: '#dcd0ae',
    layerMid: '#c0a674',
    layerNear: '#8d7139',
    layerFront: '#5b4425',

    stoneLite: '#f7e2b3',
    stone: '#e6c891',
    stoneMid: '#d0ac72',
    stoneDark: '#a8854f',
    stoneEdge: '#7d6035',
    stoneShade: '#5a4326',

    roof: '#c96a3c',
    roofDark: '#8e4622',
    wood: '#8a5a33',
    woodDark: '#54341c',

    gold: '#f5b91f',
    goldDark: '#a9720c',
    gem: '#1fb7d6',

    carpetA: '#a72128',
    carpetB: '#15607c',
    carpetC: '#e8a92e',

    fire: '#ff9d21',
    fireHot: '#fff0b0',
    fireDeep: '#e0400f',

    skin: '#e0a878',
    skinDark: '#b9814f',
    vest: '#0f8c86',
    vestDark: '#0a6660',
    vestTrim: '#f0b52a',
    shirt: '#fbf0d6',
    sash: '#c0272d',
    sashDark: '#8d1a1f',
    pants: '#efe1bd',
    pantsDark: '#c9b68d',
    boot: '#5e3617',
    hat: '#1f1717',

    guardRobe: '#2c6a55',
    guardRobeDark: '#1b4739',
    guardCloth: '#f2ead4',
    steel: '#eef4f9',
    steelDark: '#93a2b1',

    snake: '#7ab247',
    snakeDark: '#48762b',
    crow: '#2f2b2c',
    crowBeak: '#e0a23c',

    ink: '#2a1d14',
    ui: '#fbeecb',
  };

  /* ------------------------------------------------------------ constants */
  ICH.C = {
    // The logical viewport. BASE_* is the reference frame everything is tuned
    // against; W/H grow past it to fill whatever aspect the screen has, so a
    // phone in landscape gets extra width instead of black bars.
    BASE_W: 960,
    BASE_H: 540,
    W: 960,
    H: 540,
    HUD: 1, // HUD magnification, raised on small touch screens
    touch: false,
    GROUND_Y: 430, // world y of the top of street level
    DEATH_Y: 720,

    GRAVITY: 2100,
    MAX_FALL: 1150,
    RUN_SPEED: 335,
    RUN_ACCEL: 2600,
    AIR_ACCEL: 1500,
    FRICTION: 2900,
    JUMP_VEL: -705,
    DJUMP_VEL: -615,
    COYOTE: 0.1,
    JUMP_BUFFER: 0.13,
    GLIDE_FALL: 130,

    CAM_LEAD: 340, // how far behind the runner the camera sits
    BACKTRACK: 560, // how far back you may walk before the city closes behind you

    INVUL_TIME: 1.25,
    MAX_HEALTH: 5,
    MAX_AMMO: 9,
    COMBO_TIME: 3.2,
  };
})(window.ICH);
