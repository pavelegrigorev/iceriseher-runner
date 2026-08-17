/* Tiny test runner: no dependencies, same as the game. `node tests/run.js` */
'use strict';
const fs = require('fs');
const path = require('path');

const suites = [];
let current = null;

global.describe = (name, fn) => {
  current = { name, tests: [] };
  suites.push(current);
  fn();
  current = null;
};
global.it = (name, fn) => current.tests.push({ name, fn });

function fail(msg, extra) {
  const e = new Error(extra === undefined ? msg : `${msg}\n      получено: ${JSON.stringify(extra)}`);
  e.assertion = true;
  throw e;
}

global.assert = {
  ok(v, msg) { if (!v) fail(msg || 'ожидалось истинное значение', v); },
  equal(a, b, msg) {
    if (a !== b) fail(msg || `ожидалось ${JSON.stringify(b)}`, a);
  },
  deepEqual(a, b, msg) {
    if (JSON.stringify(a) !== JSON.stringify(b)) fail(msg || `ожидалось ${JSON.stringify(b)}`, a);
  },
  near(a, b, tol, msg) {
    if (!(Math.abs(a - b) <= tol)) fail(msg || `ожидалось ${b} ± ${tol}`, a);
  },
  between(v, lo, hi, msg) {
    if (!(v >= lo && v <= hi)) fail(msg || `ожидалось от ${lo} до ${hi}`, v);
  },
  finite(v, msg) {
    if (!Number.isFinite(v)) fail(msg || 'ожидалось конечное число', v);
  },
  throws(fn, msg) {
    try { fn(); } catch (e) { return; }
    fail(msg || 'ожидалось исключение');
  },
};

const files = fs.readdirSync(__dirname)
  .filter((f) => f.endsWith('.test.js'))
  .sort();
for (const f of files) require(path.join(__dirname, f));

const RED = '\x1b[31m', GREEN = '\x1b[32m', DIM = '\x1b[2m', RESET = '\x1b[0m';
let passed = 0;
const failures = [];
const t0 = Date.now();

/* A test may return a promise — anything going through a browser callback does.
   Awaiting it is not a nicety: a promise the runner drops takes its assertions
   with it, and the test reports green having checked nothing. */
(async () => {
  for (const suite of suites) {
    console.log(`\n${suite.name}`);
    for (const t of suite.tests) {
      try {
        await t.fn();
        passed++;
        console.log(`  ${GREEN}✓${RESET} ${DIM}${t.name}${RESET}`);
      } catch (e) {
        failures.push({ suite: suite.name, test: t.name, err: e });
        console.log(`  ${RED}✗ ${t.name}${RESET}`);
        console.log(`      ${e.message.split('\n').join('\n      ')}`);
        if (!e.assertion && e.stack) {
          console.log(`      ${DIM}${e.stack.split('\n')[1].trim()}${RESET}`);
        }
      }
    }
  }

  const ms = Date.now() - t0;
  console.log();
  if (failures.length) {
    console.log(`${RED}провалено ${failures.length}${RESET}, пройдено ${passed} — ${ms} мс`);
    process.exit(1);
  }
  console.log(`${GREEN}все ${passed} тестов пройдены${RESET} — ${ms} мс`);
})();
