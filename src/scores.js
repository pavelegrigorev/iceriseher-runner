/* İçərişəhər Runner — the local table of records.

   No backend and no dependencies, so the leaderboard is whatever this browser
   remembers: a top-10 list in localStorage, each row tied to a nickname the
   player types once and keeps. The module owns both the data and the markup
   that shows it, so the two cannot drift apart. */
(function (ICH) {
  'use strict';

  const KEY = 'icherisheher.scores';
  const NICK_KEY = 'icherisheher.nick';
  const LEGACY_KEY = 'icherisheher.best'; // all the older build kept: one number
  const SIZE = 10;
  const NICK_MAX = 12;
  const NO_NICK = 'Qonaq'; // "guest" — what an unsigned run is filed under

  /* Storage throws on a blocked origin and in some private modes. A score
     table is never worth taking the game down for. */
  function get(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function put(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { /* nothing to do */ }
  }

  const int = (v) => (Number.isFinite(+v) ? Math.max(0, Math.floor(+v)) : 0);

  /** Trim a nickname to something that fits a row. May come back empty — the
      field is allowed to be blank while it is being typed. */
  function normNick(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/[\u0000-\u001f\u007f]/g, ' ') // control chars, incl. a pasted newline
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, NICK_MAX);
  }

  /** Anything coming out of storage may be from an older build, hand-edited or
      plain corrupt, so every row is rebuilt rather than trusted. */
  function clean(row) {
    if (!row || typeof row !== 'object') return null;
    const score = int(row.score);
    if (score <= 0) return null;
    return {
      nick: normNick(row.nick) || NO_NICK,
      score,
      dist: int(row.dist),
      kills: int(row.kills),
      coins: int(row.coins),
      combo: Math.max(1, int(row.combo)),
      ts: int(row.ts),
    };
  }

  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ESC[c]);

  /** Digits in groups of three, so a six-figure score reads at a glance. */
  const num = (n) => String(int(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '\u2009');

  const Scores = {
    size: SIZE,
    nickMax: NICK_MAX,
    list: null,
    nick: null,

    /** The table, best first. Cached: storage is read once per session. */
    load() {
      if (this.list) return this.list;
      const raw = get(KEY);
      let list = [];
      if (raw === null) {
        // migrate the single number the previous build stored, so nobody
        // loses a record to the upgrade
        const legacy = int(get(LEGACY_KEY));
        if (legacy > 0) list = [clean({ nick: NO_NICK, score: legacy })];
      } else {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) list = parsed.map(clean);
        } catch (e) { list = []; }
      }
      list = list.filter(Boolean);
      list.sort((a, b) => b.score - a.score); // the stored order is not trusted either
      list.length = Math.min(list.length, SIZE);
      this.list = list;
      return list;
    },

    save() {
      put(KEY, JSON.stringify(this.load()));
    },

    best() {
      const list = this.load();
      return list.length ? list[0].score : 0;
    },

    /** Would this run make the table? Ties do not displace the older row. */
    qualifies(score) {
      const s = int(score);
      const list = this.load();
      return s > 0 && (list.length < SIZE || s > list[SIZE - 1].score);
    },

    /** Insert a finished run. Returns its place (0-based) or -1 if it missed. */
    add(row) {
      const entry = clean(row);
      if (!entry) return -1;
      const list = this.load();
      let i = 0;
      while (i < list.length && list[i].score >= entry.score) i++;
      if (i >= SIZE) return -1;
      list.splice(i, 0, entry);
      list.length = Math.min(list.length, SIZE);
      this.save();
      return i;
    },

    /** Re-sign a row while its nickname is still being typed. */
    rename(i, nick) {
      const list = this.load();
      if (i < 0 || i >= list.length) return;
      list[i].nick = normNick(nick) || NO_NICK;
      this.save();
    },

    clear() {
      this.list = [];
      // an empty list, not a missing key: leaving the key absent would let the
      // legacy record rise from the dead on the next load
      put(KEY, '[]');
    },

    /** The name this player signs runs with. Empty until they type one. */
    loadNick() {
      if (this.nick === null) this.nick = normNick(get(NICK_KEY));
      return this.nick;
    },

    setNick(s) {
      this.nick = normNick(s);
      put(NICK_KEY, this.nick);
      return this.nick;
    },

    /** The table as markup. `mark` highlights one place, -1 for none. */
    tableHTML(mark) {
      const list = this.load();
      if (!list.length) return '<p class="board-empty">Пока пусто — сыграй партию.</p>';
      const rows = list.map((r, i) => '<tr' + (i === mark ? ' class="me"' : '') + '>'
        + '<td class="rank">' + (i + 1) + '</td>'
        + '<td class="nick">' + esc(r.nick) + '</td>'
        + '<td class="pts">' + num(r.score) + '</td>'
        + '<td class="meta">' + num(r.dist) + ' м</td>'
        + '</tr>').join('');
      return '<table class="board-t">' + rows + '</table>';
    },

    num,
    normNick,
  };

  ICH.Scores = Scores;
})(window.ICH);
