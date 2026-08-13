/* İçərişəhər Runner — zones.
   The endless street is cut into districts. Each one carries its own palette,
   its own set of level templates, enemies, hazards and street props, so the
   run keeps changing character instead of scrolling the same block forever. */
(function (ICH) {
  'use strict';
  const U = ICH.U;

  /* Colours are authored as hex and pre-parsed so the theme can cross-fade. */
  const ZONES = [
    {
      id: 'qala',
      boss: 'serkerde',
      name: 'QALA KÜÇƏLƏRİ',
      ru: 'Улицы крепости',
      interior: 0,
      sky: ['#4f97c2', '#94c6da', '#e6c98f', '#f7e3b3'],
      sun: '#fff6d8',
      sea: '#6b9db0',
      layers: ['#c5cfcb', '#dcd0ae', '#c0a674', '#8d7139'],
      canyon: 0.5,
      front: '#4a3216',
      ground: 'ground',
      templates: [['street', 3], ['gap', 2], ['stairs', 2], ['bazaar', 1], ['wall', 2], ['ropes', 1]],
      enemies: [['guard', 3], ['snake', 2], ['dog', 2], ['crow', 1]],
      hazards: [['brazier', 3], ['spikes', 2], ['censer', 2]],
      props: [['stall', 2], ['lamp', 3], ['plant', 2], ['cat', 2], ['chay', 2], ['door', 3],
        ['plaque', 3], ['tandir', 2], ['pigeons', 2], ['well', 1], ['nerd', 1]],
      music: { root: 146.83, bpm: 138, scale: [0, 1, 4, 5, 7, 8, 11], reverb: 0.24, def: true, zurna: true },
    },
    {
      id: 'bazar',
      boss: 'bazarbasi',
      name: 'KARVANSARAY',
      ru: 'Караван-сарай и базар',
      interior: 0,
      sky: ['#6ba3b8', '#b3ccc6', '#eab97a', '#f6d9a0'],
      sun: '#fff0c4',
      sea: '#7fa5ab',
      layers: ['#c9c8b6', '#dbc9a0', '#c39c66', '#8a6631'],
      canyon: 0.62,
      front: '#4e3315',
      ground: 'ground',
      templates: [['bazaar', 4], ['street', 2], ['stairs', 2], ['gap', 1], ['arcade', 3]],
      enemies: [['thug', 3], ['scorpion', 3], ['guard', 2], ['snake', 1]],
      hazards: [['brazier', 2], ['censer', 3], ['roller', 3]],
      props: [['stall', 4], ['rug', 3], ['lamp', 2], ['chay', 3], ['tandir', 3], ['loom', 3],
        ['copper', 3], ['bread', 3], ['plaque', 1], ['cat', 2], ['nerd', 2]],
      music: { root: 155.56, bpm: 146, scale: [0, 2, 3, 5, 7, 8, 10], reverb: 0.16, def: true, zurna: true },
    },
    {
      id: 'damlar',
      boss: 'qargasahi',
      name: 'DAMLAR ÜSTÜ',
      ru: 'По крышам',
      interior: 0,
      sky: ['#2f7fb8', '#7fbcd8', '#dfd0a4', '#f6ecc8'],
      sun: '#fffff0',
      sea: '#6fa6bd',
      layers: ['#cbd6d6', '#e2d8ba', '#c9b184', '#96793f'],
      canyon: 0.32,
      front: '#4a3a1c',
      ground: 'roofdeck',
      wind: 46,
      templates: [['rooftops', 4], ['ropes', 3], ['gap', 2], ['stairs', 2]],
      enemies: [['crow', 3], ['archer', 3], ['bat', 2], ['guard', 1]],
      hazards: [['crumble', 4], ['faller', 3], ['censer', 1]],
      props: [['rug', 3], ['pigeons', 4], ['lamp', 1], ['dish', 2], ['chimney', 3], ['cat', 2]],
      music: { root: 174.61, bpm: 152, scale: [0, 2, 4, 6, 7, 9, 11], reverb: 0.38, def: false, zurna: true },
    },
    {
      id: 'hamam',
      boss: 'div',
      name: 'HAMAM VƏ ANBAR',
      ru: 'Хамам и подземелье',
      interior: 1,
      sky: ['#16323d', '#1f4a52', '#2d5f5a', '#3b6b58'],
      sun: '#9fd0c4',
      sea: '#1b3d46',
      layers: ['#3d5f60', '#4b6d66', '#3f5a4e', '#2b3f38'],
      canyon: 0.72,
      front: '#16241f',
      ground: 'tile',
      templates: [['street', 3], ['gap', 3], ['stairs', 3], ['arcade', 3], ['wall', 1]],
      enemies: [['bat', 4], ['scorpion', 3], ['dog', 2], ['thug', 1]],
      hazards: [['steam', 4], ['spikes', 3], ['censer', 2]],
      props: [['lamp', 4], ['well', 3], ['copper', 2], ['jarpile', 3], ['drip', 3], ['cat', 1]],
      music: { root: 130.81, bpm: 124, scale: [0, 1, 3, 5, 6, 8, 10], reverb: 0.78, def: false, zurna: false },
    },
    {
      id: 'deniz',
      boss: 'ejdaha',
      name: 'DƏNİZ QAPISI',
      ru: 'Морские ворота',
      interior: 0,
      sky: ['#2e86c6', '#8ec9e2', '#dbd7b4', '#f2ead0'],
      sun: '#fffff0',
      sea: '#3f8fae',
      layers: ['#bcd2d8', '#dcd6bc', '#bfae86', '#8a7a52'],
      canyon: 0.3,
      front: '#4a4020',
      ground: 'quay',
      wind: -34,
      templates: [['street', 3], ['gap', 3], ['ropes', 2], ['wall', 2], ['stairs', 1]],
      enemies: [['archer', 3], ['crow', 3], ['guard', 2], ['dog', 1]],
      hazards: [['spikes', 3], ['censer', 2], ['brazier', 1]],
      props: [['palm', 4], ['boat', 3], ['lamp', 2], ['plaque', 2], ['net', 3], ['pigeons', 2], ['cat', 1]],
      music: { root: 164.81, bpm: 132, scale: [0, 2, 4, 5, 7, 9, 11], reverb: 0.42, def: true, zurna: false },
    },
  ];

  /* Not part of the rotation: the yard you reach only after all five
     districts are behind you. Land of Fire, at last, and at night. */
  const FINAL = {
    id: 'alov',
    boss: 'alovsahi',
    name: 'ATƏŞGAH MEYDANI',
    ru: 'Площадь огня',
    finale: true,
    interior: 0,
    sky: ['#180c1a', '#40141f', '#8c2f18', '#cf6a14'],
    sun: '#ffd07a',
    sea: '#3a1a1c',
    layers: ['#6e3f33', '#7d4527', '#5c2c1a', '#301710'],
    canyon: 0.72,
    front: '#20100a',
    ground: 'ground',
    templates: [], enemies: [], hazards: [], props: [],
    music: { root: 123.47, bpm: 158, scale: [0, 1, 4, 5, 7, 8, 11], reverb: 0.3, def: true, zurna: true },
  };

  for (const z of ZONES.concat([FINAL])) {
    z.skyRgb = z.sky.map(U.hex2rgb);
    z.sunRgb = U.hex2rgb(z.sun);
    z.seaRgb = U.hex2rgb(z.sea);
    z.layersRgb = z.layers.map(U.hex2rgb);
    z.frontRgb = U.hex2rgb(z.front);
  }

  /** Live palette; cross-fades toward whichever zone is on screen. */
  const Theme = {
    zone: ZONES[0],
    target: ZONES[0],
    t: 1, // progress of the current cross-fade

    sky: [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]],
    sun: [0, 0, 0],
    sea: [0, 0, 0],
    layers: [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]],
    front: [0, 0, 0],
    canyon: 0.5,
    interior: 0,
    wind: 0,

    layerCss: ['', '', '', ''],
    frontCss: '',
    sunCss: '',
    seaCss: '',

    reset(zone) {
      this.zone = this.target = zone || ZONES[0];
      this.t = 1;
      this._apply(this.zone, this.zone, 1);
    },

    setTarget(zone) {
      if (!zone || zone === this.target) return;
      // freeze what is on screen right now as the new fade origin
      this.from = {
        skyRgb: this.sky.map((c) => c.slice()),
        sunRgb: this.sun.slice(),
        seaRgb: this.sea.slice(),
        layersRgb: this.layers.map((c) => c.slice()),
        frontRgb: this.front.slice(),
        canyon: this.canyon,
        interior: this.interior,
        wind: this.wind,
      };
      this.target = zone;
      this.t = 0;
    },

    update(dt) {
      if (this.t < 1) {
        this.t = Math.min(1, this.t + dt / 2.2);
        this._apply(this.from || this.target, this.target, U.ease.inOutSine(this.t));
        if (this.t >= 1) this.zone = this.target;
      }
    },

    _apply(a, b, k) {
      for (let i = 0; i < 4; i++) {
        U.mixRgb(a.skyRgb[i], b.skyRgb[i], k, this.sky[i]);
        U.mixRgb(a.layersRgb[i], b.layersRgb[i], k, this.layers[i]);
        this.layerCss[i] = U.rgbCss(this.layers[i]);
      }
      U.mixRgb(a.sunRgb, b.sunRgb, k, this.sun);
      U.mixRgb(a.seaRgb, b.seaRgb, k, this.sea);
      U.mixRgb(a.frontRgb, b.frontRgb, k, this.front);
      this.sunCss = U.rgbCss(this.sun);
      this.seaCss = U.rgbCss(this.sea);
      this.frontCss = U.rgbaCss(this.front, 0.84);
      this.canyon = U.lerp(a.canyon, b.canyon, k);
      this.interior = U.lerp(a.interior || 0, b.interior || 0, k);
      this.wind = U.lerp(a.wind || 0, b.wind || 0, k);
    },
  };

  Theme.reset(ZONES[0]);

  ICH.Zones = ZONES;
  ICH.FinalZone = FINAL;
  ICH.Theme = Theme;
  ICH.zoneById = (id) => ZONES.find((z) => z.id === id) || ZONES[0];
})(window.ICH);
