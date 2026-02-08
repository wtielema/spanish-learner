# Spanish Vocabulary Learner — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an offline-first PWA that teaches the top 1000 Spanish nouns and 100 verbs using spaced repetition flashcards and multiple choice quizzes.

**Architecture:** Single-page vanilla JS app with hash-based routing. All data bundled as static JSON. Progress stored in IndexedDB. Service worker provides full offline capability. Dark-themed UI optimized for iOS Safari.

**Tech Stack:** Vanilla HTML/CSS/JavaScript, IndexedDB, Service Workers, Web App Manifest

---

### Task 1: Project Scaffolding & Dev Server

**Files:**
- Create: `index.html`
- Create: `manifest.json`
- Create: `css/styles.css`
- Create: `js/app.js`
- Create: `js/router.js`

**Step 1: Create `index.html` with PWA boilerplate**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="theme-color" content="#1a1a2e">
  <title>Spanish Learner</title>
  <link rel="manifest" href="manifest.json">
  <link rel="apple-touch-icon" href="icons/icon-192.png">
  <link rel="stylesheet" href="css/styles.css">
</head>
<body>
  <div id="app"></div>
  <script type="module" src="js/app.js"></script>
</body>
</html>
```

**Step 2: Create `manifest.json`**

```json
{
  "name": "Spanish Learner",
  "short_name": "Spanish",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#1a1a2e",
  "theme_color": "#1a1a2e",
  "icons": [
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

**Step 3: Create base CSS with dark theme and CSS custom properties**

```css
/* css/styles.css */
:root {
  --bg-primary: #1a1a2e;
  --bg-secondary: #16213e;
  --bg-card: #0f3460;
  --text-primary: #e8e8e8;
  --text-secondary: #a0a0b0;
  --accent: #e94560;
  --success: #4ecca3;
  --warning: #f0c040;
  --danger: #e94560;
  --radius: 12px;
  --safe-top: env(safe-area-inset-top);
  --safe-bottom: env(safe-area-inset-bottom);
}

* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  background: var(--bg-primary);
  color: var(--text-primary);
  min-height: 100vh;
  padding-top: var(--safe-top);
  padding-bottom: var(--safe-bottom);
  -webkit-user-select: none;
  user-select: none;
}

#app {
  max-width: 500px;
  margin: 0 auto;
  padding: 16px;
  min-height: 100vh;
}

button {
  font-family: inherit;
  font-size: 16px;
  border: none;
  border-radius: var(--radius);
  padding: 14px 24px;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  min-height: 48px;
}

.btn-primary {
  background: var(--accent);
  color: white;
  width: 100%;
  font-weight: 600;
  font-size: 18px;
}

.btn-secondary {
  background: var(--bg-card);
  color: var(--text-primary);
  width: 100%;
}
```

**Step 4: Create hash router**

```javascript
// js/router.js
export class Router {
  constructor(routes) {
    this.routes = routes;
    window.addEventListener('hashchange', () => this.resolve());
  }

  resolve() {
    const hash = window.location.hash.slice(1) || '/';
    const route = this.routes[hash] || this.routes['/'];
    route();
  }

  navigate(path) {
    window.location.hash = path;
  }
}
```

**Step 5: Create app entry point with router**

```javascript
// js/app.js
import { Router } from './router.js';

const app = document.getElementById('app');

function renderHome() {
  app.innerHTML = `
    <h1 style="text-align:center; margin: 40px 0;">Spanish Learner</h1>
    <p style="text-align:center; color: var(--text-secondary);">App is running.</p>
  `;
}

const router = new Router({
  '/': renderHome,
});

router.resolve();
```

**Step 6: Create placeholder icon**

Create `icons/` directory with a simple SVG-based placeholder icon (we'll generate proper PNGs later).

**Step 7: Verify it works**

Run: `cd "/Users/woutertielemans/Documents/Claude VibeCoding" && python3 -m http.server 8080`
Open: `http://localhost:8080` — should show "Spanish Learner" heading on dark background.

**Step 8: Commit**

```bash
git add index.html manifest.json css/styles.css js/app.js js/router.js icons/
git commit -m "feat: project scaffolding with PWA boilerplate and dark theme"
```

---

### Task 2: Word Data — Nouns JSON

**Files:**
- Create: `data/nouns.json`

**Step 1: Create the top 1000 Spanish nouns JSON file**

Generate the full list of 1000 nouns from established Spanish frequency lists. Each entry follows this format:

```json
[
  { "id": "n0001", "spanish": "tiempo", "english": "time", "gender": "m", "plural": "tiempos" },
  { "id": "n0002", "spanish": "año", "english": "year", "gender": "m", "plural": "años" },
  ...
]
```

Source: Use established Spanish frequency word lists (e.g., based on RAE corpus data). Order by frequency rank.

**Step 2: Validate the JSON**

Run: `python3 -c "import json; data=json.load(open('data/nouns.json')); print(f'{len(data)} nouns loaded'); assert len(data) == 1000"`
Expected: `1000 nouns loaded`

**Step 3: Commit**

```bash
git add data/nouns.json
git commit -m "feat: add top 1000 Spanish nouns dataset"
```

---

### Task 3: Word Data — Verbs JSON

**Files:**
- Create: `data/verbs.json`

**Step 1: Create the top 100 Spanish verbs JSON file**

Generate the full list of 100 verbs with conjugations for present, preterite, and future tenses. Each entry:

```json
[
  {
    "id": "v0001",
    "spanish": "ser",
    "english": "to be (permanent)",
    "conjugations": {
      "present": { "yo": "soy", "tú": "eres", "él": "es", "nosotros": "somos", "vosotros": "sois", "ellos": "son" },
      "preterite": { "yo": "fui", "tú": "fuiste", "él": "fue", "nosotros": "fuimos", "vosotros": "fuisteis", "ellos": "fueron" },
      "future": { "yo": "seré", "tú": "serás", "él": "será", "nosotros": "seremos", "vosotros": "seréis", "ellos": "serán" }
    }
  },
  ...
]
```

Pay special attention to irregular verbs (ser, estar, ir, haber, tener, hacer, poder, decir, etc.). Many of the top 100 are irregular.

**Step 2: Validate the JSON**

Run: `python3 -c "import json; data=json.load(open('data/verbs.json')); print(f'{len(data)} verbs loaded'); [assert all(t in v['conjugations'] for t in ['present','preterite','future']) for v in data]; print('All tenses present')"`
Expected: `100 verbs loaded` then `All tenses present`

**Step 3: Commit**

```bash
git add data/verbs.json
git commit -m "feat: add top 100 Spanish verbs with conjugations"
```

---

### Task 4: IndexedDB Storage Layer

**Files:**
- Create: `js/db.js`
- Create: `tests/db.test.html`

**Step 1: Write a test page for the DB module**

```html
<!-- tests/db.test.html -->
<!DOCTYPE html>
<html><head><title>DB Tests</title></head>
<body>
<pre id="output"></pre>
<script type="module">
import { DB } from '../js/db.js';

const out = document.getElementById('output');
function log(msg) { out.textContent += msg + '\n'; }
function assert(cond, msg) { log(cond ? `PASS: ${msg}` : `FAIL: ${msg}`); if (!cond) throw new Error(msg); }

async function runTests() {
  const db = new DB('test-spanish-learner');
  await db.init();

  // Test: save and retrieve progress
  await db.saveProgress('n0001', { easeFactor: 2.5, interval: 1, nextReview: '2026-02-09', repetitions: 1, history: [] });
  const p = await db.getProgress('n0001');
  assert(p.easeFactor === 2.5, 'Save/get progress');

  // Test: get all progress
  await db.saveProgress('n0002', { easeFactor: 2.0, interval: 2, nextReview: '2026-02-10', repetitions: 2, history: [] });
  const all = await db.getAllProgress();
  assert(all.length >= 2, 'Get all progress returns multiple');

  // Test: save and retrieve settings
  await db.saveSetting('newPerDay', 15);
  const s = await db.getSetting('newPerDay');
  assert(s === 15, 'Save/get setting');

  // Cleanup
  await db.clear();
  log('\nAll tests passed!');
}

runTests().catch(e => log('ERROR: ' + e.message));
</script>
</body></html>
```

**Step 2: Open test page to verify tests fail**

Run: `open http://localhost:8080/tests/db.test.html`
Expected: Errors because `db.js` doesn't exist yet.

**Step 3: Implement the DB module**

```javascript
// js/db.js
export class DB {
  constructor(name = 'spanish-learner') {
    this.name = name;
    this.db = null;
  }

  init() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.name, 1);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('progress')) {
          db.createObjectStore('progress', { keyPath: 'cardId' });
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };
      req.onsuccess = (e) => { this.db = e.target.result; resolve(); };
      req.onerror = (e) => reject(e.target.error);
    });
  }

  saveProgress(cardId, data) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('progress', 'readwrite');
      tx.objectStore('progress').put({ cardId, ...data });
      tx.oncomplete = resolve;
      tx.onerror = (e) => reject(e.target.error);
    });
  }

  getProgress(cardId) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('progress', 'readonly');
      const req = tx.objectStore('progress').get(cardId);
      req.onsuccess = () => resolve(req.result);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  getAllProgress() {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('progress', 'readonly');
      const req = tx.objectStore('progress').getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  saveSetting(key, value) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('settings', 'readwrite');
      tx.objectStore('settings').put({ key, value });
      tx.oncomplete = resolve;
      tx.onerror = (e) => reject(e.target.error);
    });
  }

  getSetting(key) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('settings', 'readonly');
      const req = tx.objectStore('settings').get(key);
      req.onsuccess = () => resolve(req.result?.value);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  clear() {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['progress', 'settings'], 'readwrite');
      tx.objectStore('progress').clear();
      tx.objectStore('settings').clear();
      tx.oncomplete = resolve;
      tx.onerror = (e) => reject(e.target.error);
    });
  }
}
```

**Step 4: Run tests again**

Open: `http://localhost:8080/tests/db.test.html`
Expected: All tests pass.

**Step 5: Commit**

```bash
git add js/db.js tests/db.test.html
git commit -m "feat: IndexedDB storage layer with tests"
```

---

### Task 5: Spaced Repetition Engine

**Files:**
- Create: `js/srs.js`
- Create: `tests/srs.test.html`

**Step 1: Write tests for the SRS module**

```html
<!-- tests/srs.test.html -->
<!DOCTYPE html>
<html><head><title>SRS Tests</title></head>
<body>
<pre id="output"></pre>
<script type="module">
import { SRS } from '../js/srs.js';

const out = document.getElementById('output');
function log(msg) { out.textContent += msg + '\n'; }
function assert(cond, msg) { log(cond ? `PASS: ${msg}` : `FAIL: ${msg}`); if (!cond) throw new Error(msg); }

// Test: new card defaults
const card = SRS.newCard('n0001');
assert(card.easeFactor === 2.5, 'New card ease factor is 2.5');
assert(card.interval === 0, 'New card interval is 0');
assert(card.repetitions === 0, 'New card repetitions is 0');

// Test: rating "again" resets interval
const afterAgain = SRS.review(card, 'again');
assert(afterAgain.interval === 1, 'Again sets interval to 1 minute (re-learn)');
assert(afterAgain.repetitions === 0, 'Again resets repetitions');
assert(afterAgain.easeFactor < 2.5, 'Again decreases ease factor');

// Test: rating "good" on new card
const afterGood = SRS.review(card, 'good');
assert(afterGood.interval === 1, 'First good sets interval to 1 day');
assert(afterGood.repetitions === 1, 'Good increments repetitions');

// Test: rating "good" twice increases interval
const afterGood2 = SRS.review(afterGood, 'good');
assert(afterGood2.interval > afterGood.interval, 'Second good increases interval');

// Test: rating "easy" gives bigger interval jump
const afterEasy = SRS.review(card, 'easy');
assert(afterEasy.interval > afterGood.interval, 'Easy gives bigger interval than good');
assert(afterEasy.easeFactor > 2.5, 'Easy increases ease factor');

// Test: nextReview is a valid date string
assert(afterGood.nextReview.match(/^\d{4}-\d{2}-\d{2}/), 'nextReview is date string');

// Test: getDueCards filters correctly
const today = new Date().toISOString().split('T')[0];
const cards = [
  { ...SRS.newCard('a'), nextReview: '2020-01-01' },
  { ...SRS.newCard('b'), nextReview: '2099-01-01' },
  { ...SRS.newCard('c'), nextReview: today },
];
const due = SRS.getDueCards(cards);
assert(due.length === 2, 'getDueCards returns past and today cards');
assert(due.find(c => c.cardId === 'b') === undefined, 'getDueCards excludes future cards');

log('\nAll tests passed!');
</script>
</body></html>
```

**Step 2: Verify tests fail**

Open: `http://localhost:8080/tests/srs.test.html`
Expected: Fails because `srs.js` doesn't exist.

**Step 3: Implement the SRS module (simplified SM-2)**

```javascript
// js/srs.js
export class SRS {
  static newCard(cardId) {
    return {
      cardId,
      easeFactor: 2.5,
      interval: 0,
      repetitions: 0,
      nextReview: new Date().toISOString().split('T')[0],
      history: [],
    };
  }

  static review(card, rating) {
    const updated = { ...card, history: [...card.history] };
    const today = new Date().toISOString().split('T')[0];

    updated.history.push({ date: today, rating });

    let { easeFactor, interval, repetitions } = updated;

    // Ease factor adjustments
    const easeDeltas = { again: -0.3, hard: -0.15, good: 0, easy: 0.15 };
    easeFactor = Math.max(1.3, easeFactor + (easeDeltas[rating] || 0));

    if (rating === 'again') {
      repetitions = 0;
      interval = 1;
    } else {
      repetitions += 1;
      if (repetitions === 1) {
        interval = 1;
      } else if (repetitions === 2) {
        interval = 3;
      } else {
        interval = Math.round(interval * easeFactor);
      }
      if (rating === 'easy') {
        interval = Math.round(interval * 1.3);
      }
    }

    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + interval);

    updated.easeFactor = easeFactor;
    updated.interval = interval;
    updated.repetitions = repetitions;
    updated.nextReview = nextDate.toISOString().split('T')[0];

    return updated;
  }

  static getDueCards(cards) {
    const today = new Date().toISOString().split('T')[0];
    return cards.filter(c => c.nextReview <= today);
  }
}
```

**Step 4: Run tests**

Open: `http://localhost:8080/tests/srs.test.html`
Expected: All tests pass.

**Step 5: Commit**

```bash
git add js/srs.js tests/srs.test.html
git commit -m "feat: spaced repetition engine (SM-2) with tests"
```

---

### Task 6: Card Generator

**Files:**
- Create: `js/cards.js`
- Create: `tests/cards.test.html`

**Step 1: Write tests for card generation**

```html
<!-- tests/cards.test.html -->
<!DOCTYPE html>
<html><head><title>Card Tests</title></head>
<body>
<pre id="output"></pre>
<script type="module">
import { generateNounCards, generateVerbCards } from '../js/cards.js';

const out = document.getElementById('output');
function log(msg) { out.textContent += msg + '\n'; }
function assert(cond, msg) { log(cond ? `PASS: ${msg}` : `FAIL: ${msg}`); if (!cond) throw new Error(msg); }

// Test noun card generation
const noun = { id: 'n0001', spanish: 'tiempo', english: 'time', gender: 'm', plural: 'tiempos' };
const nounCards = generateNounCards(noun);
assert(nounCards.length === 2, 'Noun generates 2 cards');
assert(nounCards[0].front.includes('tiempo'), 'First card shows Spanish');
assert(nounCards[0].back.includes('time'), 'First card back shows English');
assert(nounCards[1].front.includes('time'), 'Second card shows English');
assert(nounCards[1].back.includes('tiempo'), 'Second card back shows Spanish');
assert(nounCards[0].type === 'noun', 'Card type is noun');

// Test verb meaning card generation
const verb = {
  id: 'v0001', spanish: 'hablar', english: 'to speak',
  conjugations: {
    present: { yo: 'hablo', tú: 'hablas', él: 'habla', nosotros: 'hablamos', vosotros: 'habláis', ellos: 'hablan' },
    preterite: { yo: 'hablé', tú: 'hablaste', él: 'habló', nosotros: 'hablamos', vosotros: 'hablasteis', ellos: 'hablaron' },
    future: { yo: 'hablaré', tú: 'hablarás', él: 'hablará', nosotros: 'hablaremos', vosotros: 'hablaréis', ellos: 'hablarán' }
  }
};
const verbCards = generateVerbCards(verb);

// 2 meaning cards + 18 conjugation cards
assert(verbCards.length === 20, 'Verb generates 20 cards');

const meaningCards = verbCards.filter(c => c.subtype === 'meaning');
assert(meaningCards.length === 2, '2 meaning cards');

const conjCards = verbCards.filter(c => c.subtype === 'conjugation');
assert(conjCards.length === 18, '18 conjugation cards');
assert(conjCards[0].front.includes('hablar'), 'Conjugation card shows infinitive');
assert(conjCards[0].tense, 'Conjugation card has tense property');

log('\nAll tests passed!');
</script>
</body></html>
```

**Step 2: Verify tests fail, then implement**

```javascript
// js/cards.js
export function generateNounCards(noun) {
  return [
    {
      id: `${noun.id}-es`,
      wordId: noun.id,
      type: 'noun',
      subtype: 'meaning',
      front: `${noun.spanish} (${noun.gender === 'm' ? 'el' : 'la'})`,
      back: noun.english,
      direction: 'es-en',
    },
    {
      id: `${noun.id}-en`,
      wordId: noun.id,
      type: 'noun',
      subtype: 'meaning',
      front: noun.english,
      back: `${noun.spanish} (${noun.gender === 'm' ? 'el' : 'la'})`,
      direction: 'en-es',
    },
  ];
}

export function generateVerbCards(verb) {
  const cards = [
    {
      id: `${verb.id}-es`,
      wordId: verb.id,
      type: 'verb',
      subtype: 'meaning',
      front: verb.spanish,
      back: verb.english,
      direction: 'es-en',
    },
    {
      id: `${verb.id}-en`,
      wordId: verb.id,
      type: 'verb',
      subtype: 'meaning',
      front: verb.english,
      back: verb.spanish,
      direction: 'en-es',
    },
  ];

  const persons = ['yo', 'tú', 'él', 'nosotros', 'vosotros', 'ellos'];
  const tenses = ['present', 'preterite', 'future'];

  for (const tense of tenses) {
    for (const person of persons) {
      cards.push({
        id: `${verb.id}-${tense}-${person}`,
        wordId: verb.id,
        type: 'verb',
        subtype: 'conjugation',
        front: `${verb.spanish} — ${person} — ${tense}`,
        back: verb.conjugations[tense][person],
        tense,
        person,
        direction: 'conjugation',
      });
    }
  }

  return cards;
}
```

**Step 3: Run tests**

Open: `http://localhost:8080/tests/cards.test.html`
Expected: All tests pass.

**Step 4: Commit**

```bash
git add js/cards.js tests/cards.test.html
git commit -m "feat: card generator for nouns and verbs with tests"
```

---

### Task 7: Dashboard Screen

**Files:**
- Modify: `js/app.js`
- Create: `js/screens/dashboard.js`
- Modify: `css/styles.css`

**Step 1: Create the dashboard screen**

```javascript
// js/screens/dashboard.js
import { DB } from '../db.js';

export async function renderDashboard(app, router) {
  const db = new DB();
  await db.init();

  const allProgress = await db.getAllProgress();
  const today = new Date().toISOString().split('T')[0];

  const learned = allProgress.filter(p => p.repetitions > 0).length;
  const reviewedToday = allProgress.filter(p =>
    p.history.some(h => h.date === today)
  ).length;
  const dueNow = allProgress.filter(p => p.nextReview <= today).length;

  const totalAnswers = allProgress.reduce((sum, p) => sum + p.history.length, 0);
  const correctAnswers = allProgress.reduce((sum, p) =>
    sum + p.history.filter(h => h.rating === 'good' || h.rating === 'easy').length, 0
  );
  const accuracy = totalAnswers > 0 ? Math.round((correctAnswers / totalAnswers) * 100) : 0;

  app.innerHTML = `
    <div class="dashboard">
      <h1 class="dashboard-title">Spanish Learner</h1>
      <div class="stats-grid">
        <div class="stat-card">
          <span class="stat-value">${learned}</span>
          <span class="stat-label">Words Learned</span>
        </div>
        <div class="stat-card">
          <span class="stat-value">${reviewedToday}</span>
          <span class="stat-label">Reviewed Today</span>
        </div>
        <div class="stat-card">
          <span class="stat-value">${dueNow}</span>
          <span class="stat-label">Due for Review</span>
        </div>
        <div class="stat-card">
          <span class="stat-value">${accuracy}%</span>
          <span class="stat-label">Accuracy</span>
        </div>
      </div>
      <div class="dashboard-actions">
        <button class="btn-primary" id="btn-review">Start Review${dueNow > 0 ? ` (${dueNow})` : ''}</button>
        <button class="btn-secondary" id="btn-learn" style="margin-top: 12px;">Learn New Words</button>
      </div>
      <nav class="bottom-nav">
        <button class="nav-btn active" data-route="/">Home</button>
        <button class="nav-btn" data-route="/browse">Browse</button>
        <button class="nav-btn" data-route="/settings">Settings</button>
      </nav>
    </div>
  `;

  document.getElementById('btn-review').addEventListener('click', () => router.navigate('/practice?mode=review'));
  document.getElementById('btn-learn').addEventListener('click', () => router.navigate('/practice?mode=learn'));
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => router.navigate(btn.dataset.route));
  });
}
```

**Step 2: Add dashboard styles to `css/styles.css`**

```css
/* Append to css/styles.css */

.dashboard-title {
  text-align: center;
  font-size: 28px;
  margin: 24px 0 32px;
  font-weight: 700;
}

.stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 32px;
}

.stat-card {
  background: var(--bg-secondary);
  border-radius: var(--radius);
  padding: 20px 16px;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-value {
  font-size: 32px;
  font-weight: 700;
  color: var(--accent);
}

.stat-label {
  font-size: 13px;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.dashboard-actions {
  margin-bottom: 80px;
}

.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--bg-secondary);
  display: flex;
  justify-content: space-around;
  padding: 8px 0;
  padding-bottom: calc(8px + var(--safe-bottom));
  border-top: 1px solid rgba(255,255,255,0.05);
}

.nav-btn {
  background: none;
  color: var(--text-secondary);
  font-size: 13px;
  padding: 8px 16px;
  min-height: 44px;
}

.nav-btn.active {
  color: var(--accent);
}
```

**Step 3: Update `app.js` to use dashboard**

```javascript
// js/app.js
import { Router } from './router.js';
import { renderDashboard } from './screens/dashboard.js';

const app = document.getElementById('app');

const router = new Router({
  '/': () => renderDashboard(app, router),
});

router.resolve();
```

**Step 4: Verify visually**

Open: `http://localhost:8080` — should show dark dashboard with stats (all zeros) and two buttons.

**Step 5: Commit**

```bash
git add js/app.js js/screens/dashboard.js css/styles.css
git commit -m "feat: dashboard screen with stats and navigation"
```

---

### Task 8: Practice Screen — Flashcard Mode

**Files:**
- Create: `js/screens/practice.js`
- Create: `js/session.js`
- Modify: `js/app.js`
- Modify: `css/styles.css`

**Step 1: Create session manager that loads cards and manages practice flow**

```javascript
// js/session.js
import { DB } from './db.js';
import { SRS } from './srs.js';
import { generateNounCards, generateVerbCards } from './cards.js';

export class Session {
  constructor() {
    this.db = new DB();
    this.cards = [];
    this.current = 0;
  }

  async init(mode) {
    await this.db.init();

    const [nounsResp, verbsResp] = await Promise.all([
      fetch('data/nouns.json').then(r => r.json()),
      fetch('data/verbs.json').then(r => r.json()),
    ]);

    const allCards = [
      ...nounsResp.flatMap(generateNounCards),
      ...verbsResp.flatMap(generateVerbCards),
    ];

    const allProgress = await this.db.getAllProgress();
    const progressMap = Object.fromEntries(allProgress.map(p => [p.cardId, p]));

    if (mode === 'review') {
      // Get due cards
      const dueCards = allCards.filter(card => {
        const progress = progressMap[card.id];
        return progress && SRS.getDueCards([progress]).length > 0;
      });
      this.cards = this._shuffle(dueCards).slice(0, 30);
    } else {
      // Learn new cards — pick cards with no progress
      const newPerDay = (await this.db.getSetting('newPerDay')) || 10;
      const newCards = allCards.filter(card => !progressMap[card.id]);
      this.cards = newCards.slice(0, newPerDay);
    }
  }

  getCurrentCard() {
    return this.cards[this.current] || null;
  }

  async answer(rating) {
    const card = this.getCurrentCard();
    if (!card) return;

    let progress = await this.db.getProgress(card.id);
    if (!progress) {
      progress = SRS.newCard(card.id);
    }

    const updated = SRS.review(progress, rating);
    await this.db.saveProgress(card.id, updated);

    this.current++;
    return this.getCurrentCard();
  }

  getProgress() {
    return { current: this.current, total: this.cards.length };
  }

  _shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
}
```

**Step 2: Create the practice screen**

```javascript
// js/screens/practice.js
import { Session } from '../session.js';

export async function renderPractice(app, router, mode) {
  const session = new Session();
  await session.init(mode);

  function render() {
    const card = session.getCurrentCard();
    const progress = session.getProgress();

    if (!card) {
      app.innerHTML = `
        <div class="practice">
          <div class="practice-done">
            <h2>${mode === 'review' ? 'Review Complete!' : 'No More New Cards'}</h2>
            <p class="text-secondary">${progress.total > 0 ? `You reviewed ${progress.total} cards.` : 'Come back tomorrow for more.'}</p>
            <button class="btn-primary" id="btn-back" style="margin-top: 24px;">Back to Home</button>
          </div>
        </div>
      `;
      document.getElementById('btn-back').addEventListener('click', () => router.navigate('/'));
      return;
    }

    app.innerHTML = `
      <div class="practice">
        <div class="practice-header">
          <button class="practice-close" id="btn-close">&times;</button>
          <span class="practice-progress">${progress.current + 1} / ${progress.total}</span>
        </div>
        <div class="practice-card" id="card">
          <div class="card-front">
            <span class="card-label">${card.type}${card.subtype === 'conjugation' ? ' - ' + card.tense : ''}</span>
            <span class="card-text">${card.front}</span>
            <span class="card-hint">Tap to reveal</span>
          </div>
        </div>
        <div class="rating-buttons hidden" id="ratings">
          <button class="btn-rating btn-again" data-rating="again">Again</button>
          <button class="btn-rating btn-hard" data-rating="hard">Hard</button>
          <button class="btn-rating btn-good" data-rating="good">Good</button>
          <button class="btn-rating btn-easy" data-rating="easy">Easy</button>
        </div>
      </div>
    `;

    let revealed = false;

    document.getElementById('card').addEventListener('click', () => {
      if (revealed) return;
      revealed = true;
      const cardEl = document.getElementById('card');
      cardEl.innerHTML = `
        <div class="card-revealed">
          <span class="card-label">${card.type}${card.subtype === 'conjugation' ? ' - ' + card.tense : ''}</span>
          <span class="card-text">${card.front}</span>
          <hr class="card-divider">
          <span class="card-answer">${card.back}</span>
        </div>
      `;
      document.getElementById('ratings').classList.remove('hidden');
    });

    document.querySelectorAll('.btn-rating').forEach(btn => {
      btn.addEventListener('click', async () => {
        await session.answer(btn.dataset.rating);
        render();
      });
    });

    document.getElementById('btn-close').addEventListener('click', () => router.navigate('/'));
  }

  render();
}
```

**Step 3: Add practice styles to `css/styles.css`**

```css
/* Append to css/styles.css */

.practice {
  display: flex;
  flex-direction: column;
  min-height: calc(100vh - 32px);
}

.practice-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.practice-close {
  background: none;
  color: var(--text-secondary);
  font-size: 28px;
  padding: 4px 12px;
  min-height: 44px;
}

.practice-progress {
  color: var(--text-secondary);
  font-size: 14px;
}

.practice-card {
  background: var(--bg-secondary);
  border-radius: var(--radius);
  padding: 40px 24px;
  min-height: 280px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  margin-bottom: 24px;
}

.card-front, .card-revealed {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  width: 100%;
  text-align: center;
}

.card-label {
  font-size: 12px;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 1px;
}

.card-text {
  font-size: 32px;
  font-weight: 700;
}

.card-hint {
  font-size: 14px;
  color: var(--text-secondary);
  margin-top: 16px;
}

.card-divider {
  border: none;
  border-top: 1px solid rgba(255,255,255,0.1);
  width: 60%;
  margin: 8px 0;
}

.card-answer {
  font-size: 28px;
  font-weight: 600;
  color: var(--success);
}

.hidden { display: none !important; }

.rating-buttons {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 1fr;
  gap: 8px;
}

.btn-rating {
  padding: 14px 8px;
  font-size: 14px;
  font-weight: 600;
  border-radius: var(--radius);
  min-height: 48px;
}

.btn-again { background: var(--danger); color: white; }
.btn-hard { background: var(--warning); color: #1a1a2e; }
.btn-good { background: var(--success); color: #1a1a2e; }
.btn-easy { background: var(--bg-card); color: var(--text-primary); }

.practice-done {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.text-secondary { color: var(--text-secondary); }
```

**Step 4: Wire up routing in `app.js`**

```javascript
// js/app.js
import { Router } from './router.js';
import { renderDashboard } from './screens/dashboard.js';
import { renderPractice } from './screens/practice.js';

const app = document.getElementById('app');

const router = new Router({
  '/': () => renderDashboard(app, router),
  '/practice': () => {
    const params = new URLSearchParams(window.location.hash.split('?')[1]);
    renderPractice(app, router, params.get('mode') || 'review');
  },
});

router.resolve();
```

**Step 5: Verify visually**

Open: `http://localhost:8080` — click "Learn New Words" — should show flashcard with tap-to-reveal and rating buttons.

**Step 6: Commit**

```bash
git add js/session.js js/screens/practice.js js/app.js css/styles.css
git commit -m "feat: flashcard practice screen with spaced repetition"
```

---

### Task 9: Practice Screen — Multiple Choice Mode

**Files:**
- Modify: `js/screens/practice.js`
- Modify: `js/session.js`

**Step 1: Add distractor generation to session**

Add to `js/session.js`:

```javascript
// Add method to Session class
getDistractors(card, count = 3) {
  // Get other cards of same type for plausible wrong answers
  const others = this._allCards
    .filter(c => c.type === card.type && c.id !== card.id && c.direction === card.direction)
    .map(c => c.back);
  const shuffled = this._shuffle([...new Set(others)]);
  return shuffled.slice(0, count);
}
```

Also store `this._allCards` in the `init` method so distractors can be generated.

**Step 2: Add multiple choice rendering to practice screen**

When mode is 'mixed' or randomly chosen, render 4 answer buttons instead of tap-to-reveal. One correct + 3 distractors, shuffled.

Map correct answer to 'good' rating, incorrect to 'again'.

**Step 3: Update settings to store preferred mode**

The mode preference (flashcard/multiple-choice/mixed) will be read from settings and used to determine rendering.

**Step 4: Verify visually**

Test all three modes: flashcard only, multiple choice only, mixed.

**Step 5: Commit**

```bash
git add js/session.js js/screens/practice.js
git commit -m "feat: multiple choice quiz mode"
```

---

### Task 10: Browse / Word List Screen

**Files:**
- Create: `js/screens/browse.js`
- Modify: `js/app.js`
- Modify: `css/styles.css`

**Step 1: Create the browse screen**

Shows all nouns and verbs in a searchable, scrollable list. Each word shows:
- Spanish word + English translation
- Color-coded mastery dot (red = new/struggling, yellow = learning, green = mastered)
- Mastery is based on `easeFactor` and `repetitions` from progress data

Tap a word to expand and show:
- Full details (gender for nouns, conjugation table for verbs)
- Review history (last 5 attempts with ratings)

Include a search input at the top that filters by Spanish or English text.

**Step 2: Add browse styles**

```css
.word-list { list-style: none; }

.word-item {
  background: var(--bg-secondary);
  border-radius: var(--radius);
  padding: 14px 16px;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
}

.mastery-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.mastery-new { background: var(--danger); }
.mastery-learning { background: var(--warning); }
.mastery-mastered { background: var(--success); }

.search-input {
  width: 100%;
  padding: 12px 16px;
  border-radius: var(--radius);
  border: 1px solid rgba(255,255,255,0.1);
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 16px;
  margin-bottom: 16px;
}
```

**Step 3: Wire up routing in `app.js`**

Add `/browse` route.

**Step 4: Verify visually**

Open: `http://localhost:8080/#/browse` — should show searchable word list.

**Step 5: Commit**

```bash
git add js/screens/browse.js js/app.js css/styles.css
git commit -m "feat: browse screen with searchable word list and mastery indicators"
```

---

### Task 11: Settings Screen

**Files:**
- Create: `js/screens/settings.js`
- Modify: `js/app.js`

**Step 1: Create the settings screen**

Settings to include:
- **New words per day** — slider input (5-30, default 10), saves to IndexedDB
- **Practice mode** — radio buttons: Flashcard / Multiple Choice / Mixed
- **Reset progress** — button with confirmation dialog, clears all progress from IndexedDB

**Step 2: Wire up in `app.js`**

Add `/settings` route.

**Step 3: Verify**

Change settings, go back to dashboard, start practice — settings should be reflected.

**Step 4: Commit**

```bash
git add js/screens/settings.js js/app.js
git commit -m "feat: settings screen with daily limit, mode, and reset"
```

---

### Task 12: Service Worker & Offline Support

**Files:**
- Create: `sw.js`
- Modify: `index.html`

**Step 1: Create the service worker**

```javascript
// sw.js
const CACHE_NAME = 'spanish-learner-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/js/app.js',
  '/js/router.js',
  '/js/db.js',
  '/js/srs.js',
  '/js/cards.js',
  '/js/session.js',
  '/js/screens/dashboard.js',
  '/js/screens/practice.js',
  '/js/screens/browse.js',
  '/js/screens/settings.js',
  '/data/nouns.json',
  '/data/verbs.json',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});
```

**Step 2: Register service worker in `index.html`**

Add before closing `</body>`:

```html
<script>
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js');
  }
</script>
```

**Step 3: Test offline**

1. Load the app in browser
2. Open DevTools → Application → Service Workers — verify registered
3. Go to Network tab → check "Offline"
4. Reload page — app should still work

**Step 4: Commit**

```bash
git add sw.js index.html
git commit -m "feat: service worker for full offline support"
```

---

### Task 13: App Icons

**Files:**
- Create: `icons/icon-192.png`
- Create: `icons/icon-512.png`

**Step 1: Generate simple app icons**

Create a simple icon: dark background (#1a1a2e) with "ES" text in accent color (#e94560). Generate as SVG, then convert to PNG at 192x192 and 512x512.

Alternatively, use a canvas-based script to generate the PNGs.

**Step 2: Verify manifest**

Open DevTools → Application → Manifest — icons should show up.

**Step 3: Commit**

```bash
git add icons/
git commit -m "feat: add PWA app icons"
```

---

### Task 14: Final Polish & Testing

**Files:**
- Various touch-ups across all files

**Step 1: Cross-screen navigation test**

Manually test the full flow:
1. Dashboard loads with all zeros
2. "Learn New Words" shows flashcards
3. Rate a few cards, return to dashboard — stats update
4. "Start Review" shows due cards
5. Browse screen shows words with mastery colors
6. Settings changes persist after navigation
7. Bottom nav works on all screens

**Step 2: iOS Safari testing**

- Test on iPhone/iPad Safari (or simulator)
- Verify "Add to Home Screen" works
- Verify app launches full-screen
- Test touch targets are large enough
- Test landscape orientation

**Step 3: Offline test**

- Enable airplane mode
- App should work completely offline
- Progress should persist

**Step 4: Fix any issues found**

**Step 5: Final commit**

```bash
git add -A
git commit -m "feat: final polish and cross-platform testing"
```

---

## Task Summary

| Task | Description | Est. Cards |
|------|-------------|-----------|
| 1 | Project scaffolding & dev server | - |
| 2 | Nouns JSON data (1000 words) | - |
| 3 | Verbs JSON data (100 verbs) | - |
| 4 | IndexedDB storage layer | - |
| 5 | Spaced repetition engine (SM-2) | - |
| 6 | Card generator | - |
| 7 | Dashboard screen | - |
| 8 | Practice screen — flashcard mode | - |
| 9 | Practice screen — multiple choice | - |
| 10 | Browse / word list screen | - |
| 11 | Settings screen | - |
| 12 | Service worker & offline | - |
| 13 | App icons | - |
| 14 | Final polish & testing | - |

**Dependencies:** Tasks 2-3 (data) and 4-6 (engine) can be built in parallel. Tasks 7-11 (screens) depend on 4-6. Task 12 depends on all files being created. Task 14 is last.
