/* İçərişəhər Runner — the local tables of records.

   No backend and no dependencies, so the leaderboard is whatever this browser
   remembers: top-10 lists in localStorage, each row tied to a nickname the
   player types once and keeps.

   There are two lists because the city rotates daily (see U.seed). Comparing
   today's run against one from last week compares two different cities, so
   «сегодня» is the honest ranking and «всё время» is the trophy cabinet. The
   day list is thrown away when the calendar day turns.

   The module owns both the data and the markup that shows it, so the two
   cannot drift apart. */
(function (ICH) {
  'use strict';
  const U = ICH.U;

  const ALL_KEY = 'icherisheher.scores';
  const DAY_KEY = 'icherisheher.today';
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

  const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

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
      day: DAY_RE.test(row.day) ? row.day : '',
    };
  }

  function parseList(raw) {
    let list = [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) list = parsed.map(clean);
    } catch (e) { list = []; }
    list = list.filter(Boolean);
    list.sort((a, b) => b.score - a.score); // the stored order is not trusted either
    list.length = Math.min(list.length, SIZE);
    return list;
  }

  /** Place a run in a sorted list. Ties do not displace the older row. */
  function insert(list, entry) {
    let i = 0;
    while (i < list.length && list[i].score >= entry.score) i++;
    if (i >= SIZE) return -1;
    list.splice(i, 0, entry);
    list.length = Math.min(list.length, SIZE);
    return i;
  }

  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ESC[c]);

  /** Digits in groups of three, so a six-figure score reads at a glance. */
  const num = (n) => String(int(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '\u2009');

  const Scores = {
    size: SIZE,
    nickMax: NICK_MAX,
    guest: NO_NICK,
    all: null,
    day: null,
    dayOf: '', // which calendar day the day list belongs to
    nick: null,

    /** All-time top ten, best first. Cached: storage is read once per session. */
    loadAll() {
      if (this.all) return this.all;
      const raw = get(ALL_KEY);
      if (raw === null) {
        // migrate the single number the previous build stored, so nobody loses
        // a record to the upgrade
        const legacy = int(get(LEGACY_KEY));
        this.all = legacy > 0 ? [clean({ nick: NO_NICK, score: legacy })] : [];
      } else {
        this.all = parseList(raw);
      }
      return this.all;
    },

    /** Today's top ten. A stored list from an earlier date is dropped: it
        ranks runs through a city that no longer exists. */
    loadDay(today) {
      const now = today || U.today();
      if (this.day && this.dayOf === now) return this.day;
      let list = [];
      const raw = get(DAY_KEY);
      if (raw !== null) {
        let box = null;
        try { box = JSON.parse(raw); } catch (e) { box = null; }
        if (box && box.day === now) list = parseList(JSON.stringify(box.rows || []));
      }
      this.day = list;
      this.dayOf = now;
      return list;
    },

    list(which) {
      return which === 'day' ? this.loadDay() : this.loadAll();
    },

    save() {
      put(ALL_KEY, JSON.stringify(this.loadAll()));
      put(DAY_KEY, JSON.stringify({ day: this.dayOf, rows: this.loadDay() }));
    },

    best() {
      const list = this.loadAll();
      return list.length ? list[0].score : 0;
    },

    /** Would this run make a table? Ties do not displace the older row. */
    qualifies(score, which) {
      const s = int(score);
      const list = this.list(which);
      return s > 0 && (list.length < SIZE || s > list[SIZE - 1].score);
    },

    /** File a finished run in both tables. Returns the places it took, -1 for
        a table it missed. */
    add(row) {
      const today = U.today();
      const entry = clean(Object.assign({ day: today }, row));
      if (!entry) return { all: -1, day: -1 };
      this.loadAll();
      this.loadDay(today);
      const places = {
        all: insert(this.all, entry),
        // the same object in both lists on purpose: renaming touches one row
        day: entry.day === this.dayOf ? insert(this.day, entry) : -1,
      };
      this.save();
      return places;
    },

    /** Re-sign a row while its nickname is still being typed. Both tables hold
        the same object, so one write covers them. */
    rename(places, nick) {
      const name = normNick(nick) || NO_NICK;
      const at = (list, i) => { if (i >= 0 && i < list.length) list[i].nick = name; };
      at(this.loadAll(), places && places.all);
      at(this.loadDay(), places && places.day);
      this.save();
    },

    clear() {
      this.all = [];
      this.day = [];
      this.dayOf = U.today();
      // empty lists, not missing keys: leaving ALL_KEY absent would let the
      // legacy record rise from the dead on the next load
      this.save();
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

    /** A table as markup. `mark` highlights one place, -1 for none. */
    tableHTML(which, mark) {
      const list = this.list(which);
      if (!list.length) {
        return '<p class="board-empty">'
          + (which === 'day' ? 'Сегодня ещё никто не бегал.' : 'Пока пусто — сыграй партию.')
          + '</p>';
      }
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
